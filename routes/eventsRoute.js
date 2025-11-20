const express = require('express');
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');
const { createRecurringEvent, updateRecurringEvent, deleteGoogleEvent, getGoogleCalendarLink, createGoogleCalendar } = require('../utilities/calendar');

const router = express.Router();

// Valid building codes
const VALID_BUILDING_CODES = {
    'KIM': 'Kimball',
    'TAY': 'Taylor',
    'SPO': 'Spori',
    'ROM': 'Romney',
    'SNO': 'Snow',
    'HRT': 'Hart',
    'BCTR': 'BYU-I Center',
    'BEN': 'Benson',
    'MC': 'Manwaring Center',
    'STC': 'Science and Technology Center',
    'SMI': 'Smith',
    'HIN': 'Hinkley',
    'RKS': 'Ricks',
    'ETC': 'Engineering and Technology Center',
    'AUS': 'Austin',
    'CLK': 'Clarke'
};

// Validate location format and building code
function validateLocation(location) {
    if (!location || location.trim() === '') {
        return { valid: false, error: 'Location is required' };
    }

    const trimmed = location.trim().toUpperCase();
    
    // Parse location to extract building code
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
        return { 
            valid: false, 
            error: `Invalid location format. Expected: "BUILDING ROOM" (e.g., "KIM 101")` 
        };
    }

    const buildingCode = parts[0];
    const room = parts.slice(1).join(' ');

    if (!VALID_BUILDING_CODES[buildingCode]) {
        return { 
            valid: false, 
            error: `Invalid building code: "${buildingCode}". Valid codes: ${Object.keys(VALID_BUILDING_CODES).join(', ')}` 
        };
    }

    if (!room || !/^\d+/.test(room)) {
        return { 
            valid: false, 
            error: `Invalid room number. Format should be: "${buildingCode} ROOM_NUMBER"` 
        };
    }

    return { 
        valid: true, 
        formatted: `${buildingCode} ${room}`,
        building: VALID_BUILDING_CODES[buildingCode]
    };
}

// Get all events for current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM events 
            WHERE account_id = $1 
            ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [req.user.account_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get single event
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM events 
            WHERE event_id = $1 AND account_id = $2
        `;
        const result = await pool.query(query, [req.params.id, req.user.account_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = result.rows[0];
        res.json(event);
    } catch (err) {
        console.error('Error fetching event:', err);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create new event
router.post('/', verifyToken, async (req, res) => {
    try {
        const { class_name, location, time_slot, days, start_date, end_date, create_separate_calendar, semester_name } = req.body;

        // Validate location
        const locationValidation = validateLocation(location);
        if (!locationValidation.valid) {
            return res.status(400).json({ error: locationValidation.error });
        }

        // Build recurrence rule
        const dayMap = {
            'Monday': 'MO',
            'Tuesday': 'TU',
            'Wednesday': 'WE',
            'Thursday': 'TH',
            'Friday': 'FR'
        };

        const daysArray = days.split(',').map(d => d.trim());
        const recurringDays = daysArray.map(day => dayMap[day]).filter(Boolean);
        const untilDate = new Date(end_date);
        untilDate.setHours(23, 59, 59, 0);
        const untilString = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;

        // FIRST: Create event in database (with null google_event_id initially)
        // This ensures we only create in Google Calendar if database insertion succeeds
        const insertQuery = `
            INSERT INTO events (account_id, class_name, location, time_slot, days, start_date, end_date, created_at, recurrence_rule, google_event_id, semester_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, NULL, $9)
            RETURNING *
        `;
        let result;
        try {
            result = await pool.query(insertQuery, [
                req.user.account_id,
                class_name,
                locationValidation.formatted,
                time_slot,
                days,
                start_date,
                end_date,
                rrule,
                semester_name || null
            ]);
            console.log('✓ Event created in database:', result.rows[0].event_id);
        } catch (dbErr) {
            console.error('ERROR: Failed to insert event into database:', dbErr.message);
            console.error('Query:', insertQuery);
            console.error('Values:', [
                req.user.account_id,
                class_name,
                locationValidation.formatted,
                time_slot,
                days,
                start_date,
                end_date,
                rrule,
                semester_name || null
            ]);
            throw dbErr;
        }

        const eventId = result.rows[0].event_id;
        let googleEventId = null;
        let googleLink = null;
        let googleError = null;
        let googleCalendarId = 'primary'; // Default to primary calendar

        // SECOND: Try to sync with Google Calendar
        try {
            const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
            const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
            
            if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                const accessToken = tokenResult.rows[0].google_access_token;
                
                // If user wants separate calendar, check if one exists for this semester
                if (create_separate_calendar && semester_name) {
                    try {
                        const calendarCheckQuery = `
                            SELECT google_calendar_id FROM semester_calendars 
                            WHERE account_id = $1 AND semester_name = $2
                        `;
                        const calendarCheckResult = await pool.query(calendarCheckQuery, [req.user.account_id, semester_name]);
                        
                        if (calendarCheckResult.rows.length > 0) {
                            // Calendar already exists, use it
                            googleCalendarId = calendarCheckResult.rows[0].google_calendar_id;
                            console.log(`✓ Using existing semester calendar: ${googleCalendarId}`);
                        } else {
                            // Create new calendar for this semester
                            const newCalendar = await createGoogleCalendar(
                                accessToken,
                                `${semester_name} Semester Classes`,
                                `Classes for ${semester_name} semester`
                            );
                            googleCalendarId = newCalendar.id;
                            
                            // Store the calendar mapping in database
                            const insertCalendarQuery = `
                                INSERT INTO semester_calendars (account_id, semester_name, google_calendar_id, created_at)
                                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                                ON CONFLICT (account_id, semester_name) DO UPDATE 
                                SET google_calendar_id = $3
                            `;
                            await pool.query(insertCalendarQuery, [req.user.account_id, semester_name, googleCalendarId]);
                            console.log(`✓ Created and stored new semester calendar: ${googleCalendarId}`);
                        }
                    } catch (calendarErr) {
                        console.error('Warning: Could not manage semester calendar:', calendarErr.message);
                        // Continue with primary calendar if semester calendar fails
                        googleCalendarId = 'primary';
                    }
                }
                
                const googleEvent = await createRecurringEvent(
                    accessToken,
                    { class_name, location: locationValidation.formatted, time_slot, days, start_date, end_date },
                    googleCalendarId
                );
                googleEventId = googleEvent.id;
                googleLink = googleEvent.htmlLink;
                console.log('✓ Event synced to Google Calendar:', googleEventId);
                
                // Update database with Google event ID
                try {
                    const updateResult = await pool.query(
                        'UPDATE events SET google_event_id = $1 WHERE event_id = $2',
                        [googleEventId, eventId]
                    );
                    console.log('✓ Database updated with Google event ID');
                } catch (updateErr) {
                    console.error('ERROR: Failed to update database with Google event ID:', updateErr.message);
                    console.error('Event was created in Google Calendar but database update failed!');
                    console.error('Google Event ID:', googleEventId);
                    console.error('Database Event ID:', eventId);
                    throw updateErr; // Re-throw to trigger cleanup
                }
            } else {
                console.log('⚠ No Google Calendar access token found for user');
                // If user has no token, event exists locally but not in Google Calendar
            }
        } catch (err) {
            console.error('Error creating Google Calendar event:', err.message);
            
            // If we created an event in Google Calendar but DB update failed, clean it up
            if (googleEventId) {
                console.error('Attempting cleanup: deleting event from Google Calendar due to DB sync failure');
                try {
                    const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
                    const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
                    
                    if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                        await deleteGoogleEvent(tokenResult.rows[0].google_access_token, googleEventId, googleCalendarId);
                        console.log('✓ Cleaned up Google Calendar event:', googleEventId);
                    }
                } catch (cleanupErr) {
                    console.error('CRITICAL: Failed to clean up Google Calendar event:', cleanupErr.message);
                    console.error('Orphaned event in Google Calendar - Google Event ID:', googleEventId);
                    console.error('Please manually delete from calendar:', googleLink);
                }
            }
            
            // Try to delete the event from local database if it was created
            if (eventId) {
                try {
                    await pool.query('DELETE FROM events WHERE event_id = $1', [eventId]);
                    console.log('✓ Cleaned up database event:', eventId);
                } catch (dbCleanupErr) {
                    console.error('Warning: Could not clean up database event:', dbCleanupErr.message);
                }
            }
            
            // Check if this is an authentication error
            if (err.message && (err.message.includes('Invalid') || err.message.includes('authentication') || err.message.includes('credentials'))) {
                // Authentication error - don't sync to Google Calendar
                console.log('⚠ Google Calendar authentication error - event saved locally only');
                googleError = err.message;
            } else {
                // For other errors, store the error
                googleError = err.message;
                // Re-throw to main error handler
                throw err;
            }
        }

        res.status(201).json({
            ...result.rows[0],
            google_event_id: googleEventId,
            google_calendar_link: googleLink,
            google_sync: googleEventId ? { status: 'synced' } : { status: 'pending', error: googleError || 'No Google Calendar access token' },
            message: googleEventId ? 'Event created and synced to Google Calendar' : 'Event created locally (not synced to Google Calendar)'
        });
    } catch (err) {
        console.error('Error creating event:', err.message);
        console.error('Full error:', err);
        res.status(500).json({ error: 'Failed to create event: ' + err.message });
    }
});

// Update event
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { class_name, location, time_slot, days, start_date, end_date } = req.body;

        // Validate location
        const locationValidation = validateLocation(location);
        if (!locationValidation.valid) {
            return res.status(400).json({ error: locationValidation.error });
        }

        // Get existing event to check if it has Google Calendar ID
        const getQuery = `
            SELECT * FROM events 
            WHERE event_id = $1 AND account_id = $2
        `;
        const getResult = await pool.query(getQuery, [req.params.id, req.user.account_id]);

        if (getResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const existingEvent = getResult.rows[0];

        // Try to update in Google Calendar if both event ID and access token exist
        if (existingEvent.google_event_id) {
            try {
                const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
                const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
                
                if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                    const accessToken = tokenResult.rows[0].google_access_token;
                    
                    // Determine which calendar to use - if event has semester_name, use that calendar
                    let calendarId = 'primary';
                    if (existingEvent.semester_name) {
                        const calendarCheckQuery = `
                            SELECT google_calendar_id FROM semester_calendars 
                            WHERE account_id = $1 AND semester_name = $2
                        `;
                        const calendarCheckResult = await pool.query(calendarCheckQuery, [req.user.account_id, existingEvent.semester_name]);
                        if (calendarCheckResult.rows.length > 0) {
                            calendarId = calendarCheckResult.rows[0].google_calendar_id;
                        }
                    }
                    
                    await updateRecurringEvent(
                        accessToken,
                        existingEvent.google_event_id,
                        { class_name, location: locationValidation.formatted, time_slot, days, start_date, end_date },
                        calendarId
                    );
                    console.log(`✓ Event updated in Google Calendar (${calendarId})`);
                }
            } catch (err) {
                console.error('Warning: Could not update in Google Calendar:', err.message);
                // Don't fail the request if Google Calendar update fails
            }
        }

        const query = `
            UPDATE events 
            SET class_name = $1, location = $2, time_slot = $3, days = $4, 
                start_date = $5, end_date = $6
            WHERE event_id = $7 AND account_id = $8
            RETURNING *
        `;
        const result = await pool.query(query, [
            class_name,
            locationValidation.formatted,
            time_slot,
            days,
            start_date,
            end_date,
            req.params.id,
            req.user.account_id
        ]);

        res.json({
            ...result.rows[0],
            message: 'Event updated successfully' + (existingEvent.google_event_id ? ' and synced to Google Calendar' : '')
        });
    } catch (err) {
        console.error('Error updating event:', err);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Delete event
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        // Get the event first to check for Google Calendar ID
        const getQuery = `
            SELECT * FROM events 
            WHERE event_id = $1 AND account_id = $2
        `;
        const getResult = await pool.query(getQuery, [req.params.id, req.user.account_id]);

        if (getResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = getResult.rows[0];

        // Try to delete from Google Calendar if both event ID and access token exist
        if (event.google_event_id) {
            try {
                const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
                const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
                
                if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                    const accessToken = tokenResult.rows[0].google_access_token;
                    
                    // Determine which calendar the event is on - if event has semester_name, use that calendar
                    let calendarId = 'primary';
                    if (event.semester_name) {
                        const calendarCheckQuery = `
                            SELECT google_calendar_id FROM semester_calendars 
                            WHERE account_id = $1 AND semester_name = $2
                        `;
                        const calendarCheckResult = await pool.query(calendarCheckQuery, [req.user.account_id, event.semester_name]);
                        if (calendarCheckResult.rows.length > 0) {
                            calendarId = calendarCheckResult.rows[0].google_calendar_id;
                        }
                    }
                    
                    await deleteGoogleEvent(
                        accessToken,
                        event.google_event_id,
                        calendarId
                    );
                    console.log(`✓ Event deleted from Google Calendar (${calendarId})`);
                } else {
                    // No Google Calendar access token - fail the delete
                    return res.status(401).json({ 
                        error: 'Google Calendar sync failed: No access token found. Please re-authenticate Google Calendar in your account settings.' 
                    });
                }
            } catch (err) {
                console.error('Error deleting from Google Calendar:', err.message);
                // Return error to prevent database deletion
                return res.status(500).json({ 
                    error: `Google Calendar sync failed: ${err.message}. Event was NOT deleted to prevent data loss.` 
                });
            }
        }

        // Delete from local database only after Google Calendar deletion succeeds
        const deleteQuery = `
            DELETE FROM events 
            WHERE event_id = $1 AND account_id = $2
            RETURNING event_id
        `;
        const deleteResult = await pool.query(deleteQuery, [req.params.id, req.user.account_id]);

        res.json({
            success: true,
            message: 'Event deleted' + (event.google_event_id ? ' from both local and Google Calendar' : ' locally'),
            event_id: deleteResult.rows[0].event_id
        });
    } catch (err) {
        console.error('Error deleting event:', err);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Helper function to convert time to ISO format
function convertTimeToISO(timeString) {
    // Convert "7:45 AM" to "07:45:00"
    const [time, period] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

module.exports = router;
