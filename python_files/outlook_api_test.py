import streamlit as st
from outlook_calendar import get_auth_url, exchange_code_for_token, get_user_info, create_event

st.title("📅 Class Scheduler")

# Handle OAuth redirect
query_params = st.query_params
if "code" in query_params and "access_token" not in st.session_state:
    auth_code = query_params["code"][0]
    exchange_code_for_token(auth_code)
    st.query_params.clear()  # clear URL

# Show login button if not signed in
if "access_token" not in st.session_state:
    auth_url = get_auth_url()
    st.markdown(f"[🔐 Sign in with Microsoft]({auth_url})")
    st.stop()

# Display user info
user = get_user_info()
if user:
    st.success(f"✅ Signed in as {user['email']}")

    # Create example event
    if st.button("Create Example Event"):
        event = {
            "summary": "Math 101",
            "start": {"dateTime": "2025-11-01T09:00:00", "timeZone": "America/Denver"},
            "end": {"dateTime": "2025-11-01T10:00:00", "timeZone": "America/Denver"},
            "recurrence": ["RRULE:FREQ=WEEKLY;COUNT=10;BYDAY=MO,WE,FR;UNTIL=20251215T000000Z"],
            "location": "Room 101",
        }
        create_event(event)

# Optional: reset token
if st.button("Sign out / Reset token"):
    st.session_state.pop("access_token", None)
    st.experimental_rerun()
