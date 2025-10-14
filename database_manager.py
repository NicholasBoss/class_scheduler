import sqlite3
import streamlit as st

# Database configuration
DB_NAME = 'scheduled_events.db'

def init_database():
    """Initialize the SQLite database with proper schema"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY,
                class_name TEXT NOT NULL,
                location TEXT,
                time_slot TEXT NOT NULL,
                days TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                created_at TEXT NOT NULL
                )''')
    conn.commit()
    conn.close()

def store_event_in_db(event_info):
    """Store event information in the database"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("""INSERT INTO events 
                    (event_id, class_name, location, time_slot, days, start_date, end_date, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                  (event_info['event_id'], event_info['class_name'], event_info['location'], 
                   event_info['time_slot'], ','.join(event_info['days']), 
                   event_info['start_date'], event_info['end_date'], event_info['created_at']))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_events_from_db():
    """Retrieve all events from the database"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("SELECT * FROM events")
        rows = c.fetchall()
        events = []
        for row in rows:
            event = {
                'event_id': row[0],
                'class_name': row[1],
                'location': row[2],
                'time_slot': row[3],
                'days': row[4].split(',') if row[4] else [],
                'start_date': row[5],
                'end_date': row[6],
                'created_at': row[7]
            }
            events.append(event)
        return events
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()

def delete_event_from_db(event_id):
    """Delete an event from the database"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM events WHERE event_id = ?", (event_id,))
    conn.commit()
    conn.close()

def update_event_in_db(event_id, updated_info):
    """Update an event in the database"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""UPDATE events SET 
                class_name = ?, location = ?, time_slot = ?, days = ? 
                WHERE event_id = ?""",
              (updated_info['class_name'], updated_info['location'], 
               updated_info['time_slot'], ','.join(updated_info['days']), event_id))
    conn.commit()
    conn.close()

def get_all_events():
    """Get events from both session state and database, merge and deduplicate"""
    # Initialize database
    init_database()
    
    # Get events from database
    db_events = get_events_from_db()
    
    # Get events from session state
    session_events = st.session_state.get('scheduled_events', [])
    
    # Create a dictionary to store unique events (using event_id as key)
    all_events = {}
    
    # Add database events
    for event in db_events:
        all_events[event['event_id']] = event
    
    # Add/update with session state events (session state takes priority)
    for event in session_events:
        all_events[event['event_id']] = event
    
    return list(all_events.values())

def get_database_stats():
    """Get database statistics"""
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM events")
        event_count = c.fetchone()[0]
        conn.close()
        return {
            'total_events': event_count,
            'database_file': DB_NAME
        }
    except sqlite3.OperationalError:
        return {
            'total_events': 0,
            'database_file': DB_NAME
        }

def clear_database():
    """Clear all events from the database (use with caution)"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM events")
    conn.commit()
    conn.close()
    return True