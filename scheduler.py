import streamlit as st
import pandas as pd
from google_api_connection_v2 import *
from database_manager import *

st.set_page_config(page_title="Scheduler", page_icon="⏰")
st.title("⏰ Scheduler")

#  Create a button that allows user to authenticate with Google Calendar
if st.button("Authenticate with Google Calendar"):
    st.write("Authenticating...")
    authenticate_user()

# create a tab that allows the user to select a semester (Fall, Winter, Spring) and then select a date range within that semester. The date range should be limited to the dates of the selected semester. For example, if the user selects Fall, the date range should be limited to September 1 to December 31. If the user selects Winter, the date range should be limited to January 1 to April 30. If the user selects Spring, the date range should be limited to April 1 to July 31.

tabs = st.tabs(["Create", "Manage"])


with tabs[0]:
    st.header("Create")
    st.write("This tab will allow you to create a new schedule and add it to your Google Calendar.")
    st.write("Select the Semester and Date Range for scheduling.")

    semester = st.selectbox("Select a semester", ["Fall", "Winter", "Spring"])

    if semester == "Fall":
        st.write("You selected Fall semester.")
        st.write("Fine tune your date range to be within the semester dates.")
        # make the default date range from September 1 to December 31 of the current year (ex 2025) (I want it to be dynamic)
        current_year = pd.to_datetime("today").year
        if pd.to_datetime("today") < pd.to_datetime(f"{current_year}-09-01") or pd.to_datetime("today") > pd.to_datetime(f"{current_year}-12-31"):
            current_year += 1
        begin_date = st.date_input("Select a start date", value=pd.to_datetime(f"{current_year}-09-01").date(), min_value=pd.to_datetime(f"{current_year}-09-01").date(), max_value=pd.to_datetime(f"{current_year}-12-31").date())
        end_date = st.date_input("Select an end date", value=pd.to_datetime(f"{current_year}-12-31").date(), min_value=pd.to_datetime(f"{current_year}-09-01").date(), max_value=pd.to_datetime(f"{current_year}-12-31").date())

    elif semester == "Winter":
        st.write("You selected Winter semester.")
        st.write("Fine tune your date range to be within the semester dates.")
        # I want to check to see if we are in the range of Jan 1 to apr 30 of the current year. If not, then set it to be the next year
        current_year = pd.to_datetime("today").year
        if pd.to_datetime("today") < pd.to_datetime(f"{current_year}-01-01") or pd.to_datetime("today") > pd.to_datetime(f"{current_year}-04-30"):
            current_year += 1
        begin_date = st.date_input("Select a start date", value=pd.to_datetime(f"{current_year}-01-01").date(), min_value=pd.to_datetime(f"{current_year}-01-01").date(), max_value=pd.to_datetime(f"{current_year}-04-30").date())
        end_date = st.date_input("Select an end date", value=pd.to_datetime(f"{current_year}-04-30").date(), min_value=pd.to_datetime(f"{current_year}-01-01").date(), max_value=pd.to_datetime(f"{current_year}-04-30").date())

    elif semester == "Spring":
        st.write("You selected Spring semester.")
        st.write("Fine tune your date range to be within the semester dates.")
        # I want to check to see if we are in the range of Apr 1 to Jul 31 of the current year. If not, then set it to be the next year
        current_year = pd.to_datetime("today").year
        if pd.to_datetime("today") < pd.to_datetime(f"{current_year}-04-01") or pd.to_datetime("today") > pd.to_datetime(f"{current_year}-07-31"):
            current_year += 1
        begin_date = st.date_input("Select a start date", value=pd.to_datetime(f"{current_year}-04-01").date(), min_value=pd.to_datetime(f"{current_year}-04-01").date(), max_value=pd.to_datetime(f"{current_year}-07-31").date())
        end_date = st.date_input("Select an end date", value=pd.to_datetime(f"{current_year}-07-31").date(), min_value=pd.to_datetime(f"{current_year}-04-01").date(), max_value=pd.to_datetime(f"{current_year}-07-31").date())


    num_class = st.number_input("How many classes do you want to schedule?", key="num_classes", min_value=1, max_value=10, value=1, step=1)

    for i in range(num_class):
        st.divider()
        st.text_input(f"Enter class {i+1} name or code:", key=f"class_{i+1}")

        st.text_input(f"Enter class {i+1} location (optional):", key=f"location_{i+1}")
        # Options for days of the week: Monday, Tuesday, Wednesday, Thursday, Friday
        days_of_week = st.multiselect(f"Select days for class {i+1}", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], key=f"days_{i+1}")
        #  Time slots staring at 7:45AM and end at 5:30PM each lasting 60 minutes with a 15 minute break in between. I only need one time slot per class

        time_slots = st.multiselect(f"Select time slot for class {i+1}", ["7:45 AM - 8:45 AM", "9:00 AM - 10:00 AM", "10:15 AM - 11:15 AM", "11:30 AM - 12:30 PM", "12:45 PM - 1:45 PM", "2:00 PM - 3:00 PM", "3:15 PM - 4:15 PM", "4:30 PM - 5:30 PM"], key=f"time_{i+1}")    

    # Write the days and time slots selected for each class
    for i in range(num_class):
        class_name = st.session_state.get(f"class_{i+1}", "")
        location = st.session_state.get(f"location_{i+1}", "")
        days = st.session_state.get(f"days_{i+1}", [])
        time = st.session_state.get(f"time_{i+1}", [])
        if class_name and days and time:
            st.write(f"Class {i+1}: {class_name} on {'s, '.join(days)}s at {', '.join(time)} in {location}")


    st.write("Once you have entered all your classes, click the button below to generate your schedule. This will add the classes to your Google Calendar.")
    if st.button("Generate Schedule"):
        st.write("Generating your schedule...")
        # Display the classes, days, and time slots selected
        for i in range(num_class):
            class_name = st.session_state.get(f"class_{i+1}", "")
            location = st.session_state.get(f"location_{i+1}", "")
            days = st.session_state.get(f"days_{i+1}", [])
            time = st.session_state.get(f"time_{i+1}", [])

            if class_name and days and time:
                st.write(f"Class {i+1}: {class_name} on {'s, '.join(days)}s at {', '.join(time)} in {location}")

#  based on the selected start and end date, create a list of all the dates that fall within that range and are on the selected days of the week for each class. For example, if the user selects Fall semester and the date range is September 1 to December 31, and the user selects Monday and Wednesday for class 1, then the list of dates for class 1 should include all Mondays and Wednesdays between September 1 and December 31.
#  Then, for each date in the list, create an event in Google Calendar with the class name, start time, and end time.

        for i in range(num_class):
            class_name = st.session_state.get(f"class_{i+1}", "")
            location = st.session_state.get(f"location_{i+1}", "")
            days = st.session_state.get(f"days_{i+1}", [])
            time = st.session_state.get(f"time_{i+1}", [])

            if class_name and days and time:
                # Create a list of all the dates that fall within the selected date range and are on the selected days of the week
                date_range = pd.date_range(start=begin_date, end=end_date)
                selected_dates = []
                for single_date in date_range:
                    if single_date.strftime("%A") in days:
                        selected_dates.append(single_date.strftime("%Y-%m-%d"))

                # Create recurring events using recurrence rule instead of individual events for each date
                # Map day names to RFC 5545 day codes for recurrence rule
                day_codes = {
                    "Monday": "MO", 
                    "Tuesday": "TU", 
                    "Wednesday": "WE", 
                    "Thursday": "TH", 
                    "Friday": "FR", 
                    "Saturday": "SA", 
                    "Sunday": "SU"
                }
                
                # Convert selected days to day codes
                recurring_days = [day_codes[day] for day in days if day in day_codes]
                
                # Create one recurring event for each time slot
                for time_slot in time:
                    start_time = time_slot.split(' - ')[0]
                    end_time = time_slot.split(' - ')[1]
                    
                    # Use the first occurrence date (earliest date in selected range that matches a selected day)
                    first_occurrence = None
                    for single_date in pd.date_range(start=begin_date, end=end_date):
                        if single_date.strftime("%A") in days:
                            first_occurrence = single_date.strftime("%Y-%m-%d")
                            break
                    
                    if first_occurrence:
                        start_datetime = pd.to_datetime(f"{first_occurrence} {start_time}").strftime("%Y-%m-%dT%H:%M:%S-06:00")
                        end_datetime = pd.to_datetime(f"{first_occurrence} {end_time}").strftime("%Y-%m-%dT%H:%M:%S-06:00")
                        
                        # Create recurrence rule: weekly on selected days until end date
                        until_date = pd.to_datetime(end_date).strftime("%Y%m%dT235959Z")
                        recurrence_rule = f"RRULE:FREQ=WEEKLY;BYDAY={','.join(recurring_days)};UNTIL={until_date}"
                        
                        st.write(f"Creating recurring event: {class_name}")
                        st.write(f"Time: {time_slot}")
                        st.write(f"Days: {', '.join(days)}")
                        st.write(f"Recurrence: {recurrence_rule}")
                        
                        event_details = {
                            "summary": class_name,
                            "start": {"dateTime": start_datetime, "timeZone": "America/Denver"},
                            "end": {"dateTime": end_datetime, "timeZone": "America/Denver"},
                            "recurrence": [recurrence_rule],
                            "location": location
                        }
                        st.write(event_details)
                        
                        # Schedule the event and capture the event ID
                        created_event = schedule_event(event_details)
                        if created_event:
                            event_id = created_event.get('id')
                            
                            # Store event information for later use
                            if 'scheduled_events' not in st.session_state:
                                st.session_state.scheduled_events = []
                            
                            event_info = {
                                'event_id': event_id,
                                'class_name': class_name,
                                'location': location,
                                'time_slot': time_slot,
                                'days': days,
                                'start_date': first_occurrence,
                                'end_date': end_date.strftime("%Y-%m-%d"),
                                'created_at': pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                            st.session_state.scheduled_events.append(event_info)
                            
                            st.success(f"✅ Event created successfully!")
                            st.write(f"Event ID: `{event_id}`")
                            
                            # Store in database
                            if store_event_in_db(event_info):
                                st.write("Event stored in local database.")
                            else:
                                st.warning("Event already exists in database.")
                        else:
                            st.error("❌ Failed to create event")

# Display scheduled events management section
with tabs[1]:
    st.header("📋 Manage Scheduled Events")
    
    # Get all events from both session state and database
    all_events = get_all_events()
    
    if all_events:
        st.write("Here are your scheduled events:")
        
        # Show data source information
        session_count = len(st.session_state.get('scheduled_events', []))
        db_count = len(get_events_from_db())
        total_unique_count = len(all_events)
        
        col_info1, col_info2, col_info3 = st.columns(3)
        with col_info1:
            st.metric("Session Events", session_count)
        with col_info2:
            st.metric("Database Events", db_count)
        with col_info3:
            st.metric("Total Unique", total_unique_count)
        
        # Create a DataFrame for better display
        events_df = pd.DataFrame(all_events)
        st.dataframe(events_df, width='content')
        
        # Allow user to select an event to manage
        event_options = [f"{event['class_name']} - {event['time_slot']} ({event['event_id'][:8]}...)" 
                        for event in all_events]
        
        selected_event_index = st.selectbox(
            "Select an event to manage:",
            range(len(event_options)),
            format_func=lambda x: event_options[x]
        )
        
        if selected_event_index is not None:
            selected_event = all_events[selected_event_index]
            # st.write(f"--- {selected_event['location'][3]}")
            if selected_event['location'][3] == ' ':
                # st.write(f"--- space found")
                building = selected_event['location'][:3]
                room = selected_event['location'][4:].strip()
                campus_location = f"{building} {room}"
            else:
                # st.write(f"--- no space found")
                building = selected_event['location'][:3]
                room = selected_event['location'][3:]
                campus_location = f"{building} {room}"
            # st.write(f"**Location:** {building} {room}")
            campus_map_url = f"https://maps.byui.edu/interactive-map/index.html?building={building}&room={room}"
            
            # Show event details
            st.write("**Selected Event Details:**")
            st.write(f"- **Class:** {selected_event['class_name']}")
            st.write(f"- **Time:** {selected_event['time_slot']}")
            # create a link to the campus map for the building and room
            # st.write(f"- **Location:** {selected_event['location']}")
            st.markdown(f"- **Location:** [{campus_location}]({campus_map_url})")
            st.write(f"- **Days:** {', '.join(selected_event['days'])}")
            st.write(f"- **Date Range:** {selected_event['start_date']} to {selected_event['end_date']}")

            # Update Options
            st.write("**Update Options:**")
            
            # Use session state to track if update form should be shown
            if f"show_update_form_{selected_event_index}" not in st.session_state:
                st.session_state[f"show_update_form_{selected_event_index}"] = False
            
            col_update1, col_update2 = st.columns(2)
            with col_update1:
                if st.button("✏️ Show Update Form", type="primary", help="Show form to update event details"):
                    st.session_state[f"show_update_form_{selected_event_index}"] = True
            
            with col_update2:
                if st.button("❌ Cancel Update", type="secondary", help="Hide update form"):
                    st.session_state[f"show_update_form_{selected_event_index}"] = False
            
            # Show the form if the session state indicates it should be shown
            if st.session_state[f"show_update_form_{selected_event_index}"]:
                st.write("---")
                st.write("**Update Event Form:**")
                with st.form("update_event_form"):
                    new_class_name = st.text_input("Class Name", value=selected_event['class_name'])
                    
                    # Handle location field safely (it might not exist in older stored events)
                    current_location = selected_event.get('location', '')
                    new_location = st.text_input("Location", value=current_location)
                    
                    new_days = st.multiselect("Days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], default=selected_event['days'])
                    
                    # Handle time slot selection more robustly
                    time_options = ["7:45 AM - 8:45 AM", "9:00 AM - 10:00 AM", "10:15 AM - 11:15 AM", "11:30 AM - 12:30 PM", "12:45 PM - 1:45 PM", "2:00 PM - 3:00 PM", "3:15 PM - 4:15 PM", "4:30 PM - 5:30 PM"]
                    current_time_slot = selected_event['time_slot']
                    
                    # Find the index of the current time slot, default to 0 if not found
                    try:
                        current_index = time_options.index(current_time_slot)
                    except ValueError:
                        current_index = 0
                        st.warning(f"Current time slot '{current_time_slot}' not found in options. Defaulting to first option.")
                    
                    new_time_slot = st.selectbox("Time Slot", time_options, index=current_index)
                    
                    submitted = st.form_submit_button("Submit Updates")
                    if submitted:
                        # Create updated event details
                        st.write("**Processing Update...**")
                        
                        start_time = new_time_slot.split(' - ')[0]
                        end_time = new_time_slot.split(' - ')[1]
                        
                        st.write(f"Parsed start time: {start_time}")
                        st.write(f"Parsed end time: {end_time}")
                        st.write(f"Start date: {selected_event['start_date']}")
                        
                        try:
                            start_datetime = pd.to_datetime(f"{selected_event['start_date']} {start_time}").strftime("%Y-%m-%dT%H:%M:%S-06:00")
                            end_datetime = pd.to_datetime(f"{selected_event['start_date']} {end_time}").strftime("%Y-%m-%dT%H:%M:%S-06:00")
                            
                            st.write(f"Formatted start datetime: {start_datetime}")
                            st.write(f"Formatted end datetime: {end_datetime}")
                        except Exception as e:
                            st.error(f"Error formatting datetime: {str(e)}")
                            st.stop()
                        
                        # Create recurrence rule
                        day_codes = {
                            "Monday": "MO", 
                            "Tuesday": "TU", 
                            "Wednesday": "WE", 
                            "Thursday": "TH", 
                            "Friday": "FR"
                        }
                        recurring_days = [day_codes[day] for day in new_days if day in day_codes]
                        until_date = pd.to_datetime(selected_event['end_date']).strftime("%Y%m%dT235959Z")
                        recurrence_rule = f"RRULE:FREQ=WEEKLY;BYDAY={','.join(recurring_days)};UNTIL={until_date}"
                        updated_event_details = {
                            "summary": new_class_name,
                            "location": new_location,
                            "start": {"dateTime": start_datetime, "timeZone": "America/Denver"},
                            "end": {"dateTime": end_datetime, "timeZone": "America/Denver"},
                            "recurrence": [recurrence_rule]
                        }
                        
                        # Show the details for verification
                        st.write("**Updated Event Details (for verification):**")
                        st.json(updated_event_details)
                        
                        # Attempt to update the event
                        try:
                            updated_event = update_event(selected_event['event_id'], updated_event_details)
                            if updated_event:
                                st.success("Event updated successfully!")
                                
                                # Update database
                                updated_info = {
                                    'class_name': new_class_name,
                                    'location': new_location,
                                    'days': new_days,
                                    'time_slot': new_time_slot
                                }
                                update_event_in_db(selected_event['event_id'], updated_info)
                                
                                # Update session state if it exists
                                if 'scheduled_events' in st.session_state:
                                    for i, event in enumerate(st.session_state.scheduled_events):
                                        if event['event_id'] == selected_event['event_id']:
                                            st.session_state.scheduled_events[i]['class_name'] = new_class_name
                                            st.session_state.scheduled_events[i]['location'] = new_location
                                            st.session_state.scheduled_events[i]['days'] = new_days
                                            st.session_state.scheduled_events[i]['time_slot'] = new_time_slot
                                            break
                                
                                st.write("Updated event info:", updated_event.get('htmlLink'))
                                
                                # Close the form after successful update
                                st.session_state[f"show_update_form_{selected_event_index}"] = False
                                
                                # Show success message and rerun
                                st.balloons()
                                st.rerun()
                            else:
                                st.error("Failed to update event - API returned None")
                        except Exception as e:
                            st.error(f"Error updating event: {str(e)}")
                            st.write("Please check the details above and try again.")
            # Delete options
            st.write("**Delete Options:**")
            
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("🗑️ Delete Single Occurrence", type="secondary", help="Delete only this specific occurrence"):
                    if delete_event(selected_event['event_id']):
                        st.success("Single occurrence deleted successfully!")
                        st.info("Note: Other occurrences in the series will remain.")
                    else:
                        st.error("Failed to delete single occurrence")
            
            with col2:
                if st.button("🗑️ Delete Entire Series", type="primary", help="Delete all occurrences of this recurring event"):
                    if delete_recurring_series(selected_event['event_id']):
                        # Remove from database
                        delete_event_from_db(selected_event['event_id'])
                        
                        # Remove from session state if it exists
                        if 'scheduled_events' in st.session_state:
                            st.session_state.scheduled_events = [
                                event for event in st.session_state.scheduled_events 
                                if event['event_id'] != selected_event['event_id']
                            ]
                        
                        st.success("Entire recurring series deleted successfully!")
                        st.rerun()
                    else:
                        st.error("Failed to delete recurring series")
            
            st.divider()
            
            # Other management options
            col3, col4, col5 = st.columns(3)
            
            with col3:
                if st.button("📋 Copy Event ID", type="secondary"):
                    st.code(selected_event['event_id'])
                    st.info("Event ID copied above - you can use this for external operations")
            
            with col4:
                if st.button("🔄 Refresh Status", type="secondary"):
                    st.info("Event information refreshed")
            
            with col5:
                if st.button("ℹ️ Event Info", type="secondary"):
                    st.json(selected_event)
    
        # Data management section
        st.divider()
        st.write("**Data Management:**")
        
        col_data1, col_data2, col_data3 = st.columns(3)
        
        with col_data1:
            if st.button("🔄 Sync Session to Database", help="Save all session events to database"):
                if 'scheduled_events' in st.session_state:
                    synced_count = 0
                    for event in st.session_state.scheduled_events:
                        if store_event_in_db(event):
                            synced_count += 1
                    st.success(f"Synced {synced_count} events to database!")
                else:
                    st.info("No session events to sync.")
        
        with col_data2:
            if st.button("📥 Load from Database", help="Load all events from database to session"):
                db_events = get_events_from_db()
                if db_events:
                    st.session_state.scheduled_events = db_events
                    st.success(f"Loaded {len(db_events)} events from database!")
                    st.rerun()
                else:
                    st.info("No events found in database.")
        
        with col_data3:
            if st.button("🗄️ View Database Info", help="Show database statistics"):
                db_stats = get_database_stats()
                db_events = get_events_from_db()
                session_events = st.session_state.get('scheduled_events', [])
                
                st.write("**Database Info:**")
                st.write(f"- Database file: `{db_stats['database_file']}`")
                st.write(f"- Database events: {db_stats['total_events']}")
                st.write(f"- Session events: {len(session_events)}")
                st.write(f"- Total unique events: {len(get_all_events())}")
        
    else:
        st.info("No scheduled events found in session state or database.")
        st.write("Create some events in the 'Create' tab")
        
        # Show database status even when no events
        db_events = get_events_from_db()
        if db_events:
            st.info(f"Found {len(db_events)} events in database. Click 'Load from Database' above to load them.")
            if st.button("📥 Load Database Events"):
                st.session_state.scheduled_events = db_events
                st.success(f"Loaded {len(db_events)} events from database!")
                st.rerun()