from urllib import response
import msal
import os
from dotenv import load_dotenv
load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")
TENANT_ID = os.getenv("TENANT_ID")

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
# Note: Do NOT include 'offline_access', 'openid', 'profile' - MSAL handles these automatically
SCOPES = ["Calendars.ReadWrite", "User.Read"]
REDIRECT_URI = os.getenv("REDIRECT_URI")

def get_msal_app():
    # Using PublicClientApplication since the app is registered as a public client
    # Do NOT pass client_secret for public clients
    return msal.PublicClientApplication(
        CLIENT_ID,
        authority=AUTHORITY
    )

def get_auth_url():
    app = get_msal_app()
    return app.get_authorization_request_url(
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        response_mode="query"
    )

def get_token_from_code(auth_code):
    app = get_msal_app()
    result = app.acquire_token_by_authorization_code(
        code=auth_code,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )
    return result

def refresh_token(token_obj):
    """Refresh an expired token using the refresh token."""
    app = get_msal_app()
    
    if "refresh_token" not in token_obj:
        return None
    
    result = app.acquire_token_by_refresh_token(
        token_obj["refresh_token"],
        scopes=SCOPES
    )
    
    if "access_token" in result:
        return result
    else:
        return None

def schedule_outlook_event(token, event):
    """
    Schedule an event on Outlook calendar.
    Tries multiple endpoints to work around account type restrictions.
    """
    import requests
    import json

    # List of endpoints to try (in order of preference)
    endpoints = [
        "https://graph.microsoft.com/v1.0/me/events",  # Standard endpoint
        "https://graph.microsoft.com/v1.0/me/calendar/events",  # Calendar-specific
    ]
    
    # Debug: Check token format
    if not token or not isinstance(token, str):
        return {
            "status_code": 400,
            "error": f"Invalid token format. Expected string, got {type(token).__name__}"
        }
    
    if len(token) < 10:
        return {
            "status_code": 400,
            "error": f"Token appears too short ({len(token)} chars). Token may not be valid."
        }
    
    # Validate event payload
    if not event:
        return {
            "status_code": 400,
            "error": "Event payload is empty"
        }
    
    # Ensure required fields are present
    required_fields = ["subject", "start", "end"]
    for field in required_fields:
        if field not in event:
            return {
                "status_code": 400,
                "error": f"Missing required field: {field}",
                "event": event
            }
    
    # Validate start/end structure
    if not isinstance(event.get("start"), dict) or "dateTime" not in event["start"]:
        return {
            "status_code": 400,
            "error": "Invalid start format - must have dateTime",
            "start": event.get("start")
        }
    
    if not isinstance(event.get("end"), dict) or "dateTime" not in event["end"]:
        return {
            "status_code": 400,
            "error": "Invalid end format - must have dateTime",
            "end": event.get("end")
        }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Try each endpoint
    last_error = None
    for endpoint in endpoints:
        try:
            response = requests.post(endpoint, headers=headers, json=event, timeout=10)
            
            if response.status_code == 201:
                # Success!
                response_data = response.json()
                return response_data
            else:
                # Store this error but try next endpoint
                last_error = {
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "response": response.text if response.text else "(empty response body)"
                }
        except requests.exceptions.Timeout:
            last_error = {
                "endpoint": endpoint,
                "status_code": 408,
                "response": "Request timeout"
            }
        except requests.exceptions.RequestException as e:
            last_error = {
                "endpoint": endpoint,
                "status_code": 0,
                "response": str(e)
            }
    
    # All endpoints failed - return comprehensive error info
    try:
        error_json = response.json()
        error_text = json.dumps(error_json, indent=2)
    except:
        error_text = last_error.get("response", "Unknown error") if last_error else "All endpoints failed"
    
    error_info = {
        "status_code": last_error.get("status_code", 500) if last_error else 500,
        "error": error_text,
        "attempted_endpoints": endpoints,
        "last_error_details": last_error,
        "event_json": event
    }
    return error_info
    
def update_outlook_event(event_id, updated_event, token):
    import requests

    endpoint = f"https://graph.microsoft.com/v1.0/me/events/{event_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    response = requests.patch(endpoint, headers=headers, json=updated_event)
    if response.status_code == 200:
        response_data = response.json()
        return response_data
    else:
        error_info = {
            "status_code": response.status_code,
            "error": response.text
        }
        return error_info


from datetime import datetime

def convert_google_event_to_outlook(event_details):
    """
    Convert a Google Calendar-style event dict into an Outlook Calendar (Microsoft Graph) event dict.
    Supports recurrence conversion from basic RRULEs, including UNTIL.
    """

    def parse_rrule(rrule_str, start_datetime):
        """Convert an RRULE string into an Outlook recurrence object."""
        if not rrule_str:
            return None

        rrule_str = rrule_str.replace("RRULE:", "")
        parts = dict(item.split("=") for item in rrule_str.split(";") if "=" in item)

        freq = parts.get("FREQ", "").lower()
        count = int(parts.get("COUNT", 0)) if "COUNT" in parts else None
        until = parts.get("UNTIL")
        byday = parts.get("BYDAY", "")
        bymonthday = parts.get("BYMONTHDAY", "")
        bymonth = parts.get("BYMONTH", "")

        # Map days of week
        days_map = {
            "MO": "monday", "TU": "tuesday", "WE": "wednesday",
            "TH": "thursday", "FR": "friday", "SA": "saturday", "SU": "sunday"
        }
        days_of_week = [days_map[d] for d in byday.split(",") if d in days_map]

        # Build pattern - NOTE: type must be capitalized for Outlook API
        pattern = {}
        if freq == "daily":
            pattern = {"type": "daily", "interval": 1}
        elif freq == "weekly":
            pattern = {
                "type": "weekly",
                "interval": 1,
                "daysOfWeek": days_of_week if days_of_week else ["monday"]
            }
            # Note: firstDayOfWeek is optional and can cause issues on some accounts
        elif freq == "monthly":
            if bymonthday:
                pattern = {
                    "type": "absoluteMonthly",
                    "interval": 1,
                    "dayOfMonth": int(bymonthday)
                }
            else:
                pattern = {"type": "relativeMonthly", "interval": 1}
        elif freq == "yearly":
            pattern = {"type": "absoluteYearly", "interval": 1}
            if bymonthday:
                pattern["dayOfMonth"] = int(bymonthday)
            if bymonth:
                pattern["month"] = int(bymonth)
        else:
            return None  # Unsupported frequency

        # Build range
        range_block = {"startDate": start_datetime.split("T")[0]}

        if until:
            # UNTIL format: 20251215T235959Z → 2025-12-15
            end_date = datetime.strptime(until[:8], "%Y%m%d").strftime("%Y-%m-%d")
            range_block["type"] = "endDate"
            range_block["endDate"] = end_date
        elif count:
            range_block["type"] = "numbered"
            range_block["numberOfOccurrences"] = count
        else:
            range_block["type"] = "noEnd"

        return {"pattern": pattern, "range": range_block}

    # --- Build the Outlook event object ---
    summary = event_details.get("summary", "Untitled Event")
    start = event_details.get("start", {})
    end = event_details.get("end", {})
    location = event_details.get("location", "")
    recurrence_list = event_details.get("recurrence", [])

    outlook_event = {
        "subject": summary,
        "body": {"contentType": "HTML", "content": summary},
        "start": {"dateTime": start.get("dateTime"), "timeZone": start.get("timeZone", "UTC")},
        "end": {"dateTime": end.get("dateTime"), "timeZone": end.get("timeZone", "UTC")},
        "location": {"displayName": location}
    }

    if recurrence_list:
        outlook_event["recurrence"] = parse_rrule(recurrence_list[0], start.get("dateTime"))

    return outlook_event
