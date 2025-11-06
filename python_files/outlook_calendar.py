import requests
import streamlit as st
from msal import PublicClientApplication
from datetime import datetime
import re
from dotenv import load_dotenv
import os

load_dotenv()
# --------------------------
# Config
# --------------------------
CLIENT_ID = os.getenv("CLIENT_ID")
TENANT_ID = os.getenv("TENANT_ID")
REDIRECT_URI = os.getenv("REDIRECT_URI")
SCOPES = ["User.Read", "Calendars.ReadWrite"]
AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# --------------------------
# MSAL PKCE app
# --------------------------
def get_msal_app():
    if "msal_app" not in st.session_state:
        st.session_state["msal_app"] = PublicClientApplication(
            client_id=CLIENT_ID,
            authority=AUTHORITY
        )
    return st.session_state["msal_app"]

# --------------------------
# Auth
# --------------------------
def get_auth_url():
    app = get_msal_app()
    return app.get_authorization_request_url(SCOPES, redirect_uri=REDIRECT_URI)

def exchange_code_for_token(auth_code):
    app = get_msal_app()
    result = app.acquire_token_by_authorization_code(
        auth_code,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    if "access_token" in result:
        st.session_state["access_token"] = result["access_token"]
        return result["access_token"]
    else:
        st.error(f"Authentication failed: {result.get('error_description')}")
        st.stop()

def get_access_token():
    if "access_token" in st.session_state:
        return st.session_state["access_token"]
    else:
        st.info("Please sign in")
        st.stop()

# --------------------------
# User info
# --------------------------
def get_user_info():
    token = get_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{GRAPH_BASE}/me", headers=headers)
    if r.status_code == 200:
        user = r.json()
        return {
            "name": user.get("displayName"),
            "email": user.get("mail") or user.get("userPrincipalName"),
        }
    else:
        st.error(f"Failed to fetch user info: {r.status_code} {r.text}")
        return None

# --------------------------
# Recurrence parser
# --------------------------
def parse_recurrence_rule(rrule, start_date):
    rule = rrule.replace("RRULE:", "")
    parts = dict(item.split("=") for item in rule.split(";") if "=" in item)
    pattern = {
        "type": parts.get("FREQ", "Weekly").capitalize(),
        "interval": int(parts.get("INTERVAL", 1)),
        "daysOfWeek": [d.capitalize() for d in parts.get("BYDAY", "").split(",")] if "BYDAY" in parts else []
    }
    range_ = {"startDate": start_date}
    if "COUNT" in parts:
        range_["type"] = "numbered"
        range_["numberOfOccurrences"] = int(parts["COUNT"])
    elif "UNTIL" in parts:
        range_["type"] = "endDate"
        until_str = re.sub(r"[^0-9]", "", parts["UNTIL"])[:8]
        range_["endDate"] = datetime.strptime(until_str, "%Y%m%d").strftime("%Y-%m-%d")
    else:
        range_["type"] = "noEnd"
    return {"pattern": pattern, "range": range_}

# --------------------------
# Create event
# --------------------------
def create_event(event_details):
    token = get_access_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    event_body = {
        "subject": event_details["summary"],
        "start": event_details["start"],
        "end": event_details["end"],
        "location": {"displayName": event_details.get("location", "")},
    }

    if "recurrence" in event_details and event_details["recurrence"]:
        event_body["recurrence"] = parse_recurrence_rule(
            event_details["recurrence"][0],
            event_details["start"]["dateTime"].split("T")[0]
        )

    response = requests.post(f"{GRAPH_BASE}/me/events", headers=headers, json=event_body)
    if response.status_code == 201:
        st.success("✅ Outlook event created successfully!")
        return response.json()
    else:
        st.error(f"Failed to create event ({response.status_code}): {response.text}")
        return None
