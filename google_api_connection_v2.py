import streamlit as st
import json
import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# -------------------------------------
# CONFIG
# -------------------------------------
SCOPES = ["https://www.googleapis.com/auth/calendar"]
CLIENT_SECRETS_FILE = "credentials2.json"  # Keep private
REDIRECT_URI = "http://localhost:8501"  # Change to your deployed URL when live


# -------------------------------------
# AUTHENTICATION (for Streamlit)
# -------------------------------------
def authenticate_user():
    """Run Google OAuth2 flow inside Streamlit and return user credentials."""

    if "credentials" in st.session_state and st.session_state.credentials:
        creds_info = st.session_state.credentials
        creds = Credentials.from_authorized_user_info(creds_info, SCOPES)
        return creds

    # Create an OAuth2 flow
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

    auth_url, _ = flow.authorization_url(prompt="consent")

    st.markdown(f"[Click here to sign in with Google]({auth_url})")

    # Check if we got ?code=XYZ from Google redirect
    code = st.query_params.get("code")
    if code:
        flow.fetch_token(code=code)
        creds = flow.credentials
        st.session_state.credentials = json.loads(creds.to_json())
        st.success("✅ Authentication successful!")
        st.rerun()

    return None


# -------------------------------------
# API SERVICE BUILDERS
# -------------------------------------
def get_calendar_service(creds):
    """Build a Google Calendar API service from credentials."""
    try:
        service = build("calendar", "v3", credentials=creds)
        return service
    except HttpError as e:
        st.error(f"Error creating Calendar service: {e}")
        return None


# Example function using creds (unchanged structure)
def schedule_event(event_details):
    """Create a new event in the user's primary calendar."""
    creds = authenticate_user()
    if not creds:
        st.warning("Please authenticate before scheduling events.")
        return None

    service = get_calendar_service(creds)
    if not service:
        return None

    try:
        event = service.events().insert(calendarId="primary", body=event_details).execute()
        return event
    except HttpError as e:
        st.error(f"Error creating event: {e}")
        return None

def update_event(event_id, updated_event_details):
    """Updates an existing event on the user's primary calendar.
    
    Args:
        event_id (str): The ID of the event to update.
        updated_event_details (dict): Updated event details.
    
    Returns:
        dict: Updated event object, or None if failed.
    """
    creds = authenticate_user()
    
    try:
        service = build("calendar", "v3", credentials=creds)
        print(f"Updating event ID: {event_id}")
        print(f"Updated event details: {updated_event_details}")
        event = service.events().update(
            calendarId="primary", 
            eventId=event_id, 
            body=updated_event_details
        ).execute()
        print(f"Event updated: {event.get('htmlLink')}")
        return event
    except HttpError as error:
        print(f"An error occurred while updating event: {error}")
        return None

def delete_event(event_id):
    """Deletes an event from the user's primary calendar.
    
    Args:
        event_id (str): The ID of the event to delete.
    
    Returns:
        bool: True if successful, False otherwise.
    """
    creds = authenticate_user()
    
    try:
        service = build("calendar", "v3", credentials=creds)
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        print(f"Event deleted successfully. Event ID: {event_id}")
        return True
    except HttpError as error:
        print(f"An error occurred while deleting event: {error}")
        return False

def delete_recurring_series(event_id):
    """Deletes an entire recurring event series from the user's primary calendar.
    
    Args:
        event_id (str): The ID of any event in the recurring series.
    
    Returns:
        bool: True if successful, False otherwise.
    """
    creds = authenticate_user()
    
    try:
        service = build("calendar", "v3", credentials=creds)
        
        # First, get the event to check if it's part of a recurring series
        event = service.events().get(calendarId="primary", eventId=event_id).execute()
        
        # Check if this event has a recurring event ID (meaning it's part of a series)
        if 'recurringEventId' in event:
            # This is an instance of a recurring event, delete the master event
            master_event_id = event['recurringEventId']
            service.events().delete(calendarId="primary", eventId=master_event_id).execute()
            print(f"Recurring series deleted successfully. Master Event ID: {master_event_id}")
        else:
            # This might be the master event itself, or a single event
            # Check if it has recurrence rules
            if 'recurrence' in event:
                # This is a master recurring event
                service.events().delete(calendarId="primary", eventId=event_id).execute()
                print(f"Master recurring event deleted successfully. Event ID: {event_id}")
            else:
                # This is a single event, just delete it normally
                service.events().delete(calendarId="primary", eventId=event_id).execute()
                print(f"Single event deleted successfully. Event ID: {event_id}")
        
        return True
    except HttpError as error:
        print(f"An error occurred while deleting recurring series: {error}")
        return False