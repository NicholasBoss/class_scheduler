import datetime
import os.path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ["https://www.googleapis.com/auth/calendar"]


def authenticate_user():
  """Handles Google Calendar API authentication and returns credentials.
  
  Returns:
    Credentials object for Google Calendar API access.
  """
  creds = None
  # The file token.json stores the user's access and refresh tokens, and is
  # created automatically when the authorization flow completes for the first
  # time.
  if os.path.exists("token.json"):
    creds = Credentials.from_authorized_user_file("token.json", SCOPES)
  # If there are no (valid) credentials available, let the user log in.
  if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
      creds.refresh(Request())
    else:
      flow = InstalledAppFlow.from_client_secrets_file(
          "credentials.json", SCOPES
      )
      creds = flow.run_local_server(port=0)
    # Save the credentials for the next run
    with open("token.json", "w") as token:
      token.write(creds.to_json())
  
  return creds

def retrieve_schedule(creds, max_results=10):
  """Retrieves and prints upcoming events from the user's calendar.
  
  Args:
    creds: Authenticated credentials for Google Calendar API.
    max_results: Maximum number of events to retrieve (default: 10).
  """
  try:
    service = build("calendar", "v3", credentials=creds)

    # Call the Calendar API
    now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
    print(f"Getting the upcoming {max_results} events")
    events_result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])

    if not events:
      print("No upcoming events found.")
      return

    # Prints the start and name of the next events
    for event in events:
      start = event["start"].get("dateTime", event["start"].get("date"))
      print(start, event["summary"])

  except HttpError as error:
    print(f"An error occurred: {error}")

def main():
  """Shows basic usage of the Google Calendar API.
  Prints the start and name of the next 10 events on the user's calendar.
  """
  creds = authenticate_user()
  retrieve_schedule(creds)

def schedule_event(event_details):
    """Schedules an event on the user's primary calendar.
    
    Returns:
        dict: Event object containing event ID and other details, or None if failed.
    """
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    try:
        service = build("calendar", "v3", credentials=creds)
        event = service.events().insert(calendarId="primary", body=event_details).execute()
        print(f"Event created: {event.get('htmlLink')}")
        print(f"Event ID: {event.get('id')}")
        return event
    except HttpError as error:
        print(f"An error occurred: {error}")
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
    
def get_event_occurrences(event_id):
    """Retrieves occurrences of a recurring event from the user's primary calendar.
    
    Args:
        event_id (str): The ID of any event in the recurring series.
    
    Returns:
        list: List of occurrence start times, or None if failed.
    """
    creds = authenticate_user()
    
    try:
        service = build("calendar", "v3", credentials=creds)
        
        # First, get the event to check if it's part of a recurring series
        event = service.events().get(calendarId="primary", eventId=event_id).execute()
        
        # Check if this event has a recurring event ID (meaning it's part of a series)
        if 'recurringEventId' in event:
            master_event_id = event['recurringEventId']
            print(f"Master Event ID: {master_event_id}")
        elif 'recurrence' in event:
            master_event_id = event_id
            print(f"The provided event ID is the master event ID: {master_event_id}")
        else:
            print("The provided event ID does not belong to a recurring series.")
            return None
        
        # Now, retrieve all instances of the recurring event
        now = datetime.datetime.now(tz=datetime.timezone.utc).isoformat()
        events_result = (
            service.events()
            .list(
                calendarId="primary",
                timeMin=now,
                singleEvents=True,
                orderBy="startTime",
                q=master_event_id  # Filter by master event ID
            )
            .execute()
        )
        events = events_result.get("items", [])
        print(f"Found {len(events)} occurrences.")
        occurrences = []
        for evt in events:
            if 'recurringEventId' in evt and evt['recurringEventId'] == master_event_id:
                start = evt["start"].get("dateTime", evt["start"].get("date"))
                occurrences.append((evt['id'], start))
        
        return occurrences
    except HttpError as error:
        print(f"An error occurred while retrieving occurrences: {error}")
        return None


if __name__ == "__main__":
  main()