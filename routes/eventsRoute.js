const express = require('express');
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');
const { createRecurringEvent, updateRecurringEvent, deleteGoogleEvent, getGoogleCalendarLink, createGoogleCalendar, refreshGoogleAccessToken, getGoogleColorIdFromHex, getEventColorHexFromId, updateCalendarColor, getCalendarClient, GOOGLE_CALENDAR_COLORS } = require('../utilities/calendar');
const { google } = require('googleapis');
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
};

// Get all events for current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT e.*, 
                   COALESCE(e.color_hex, sc.color_hex) as display_color_hex
            FROM events e
            LEFT JOIN semester_calendars sc ON e.semester_name = sc.semester_name AND e.account_id = sc.account_id
            WHERE e.account_id = $1 
            ORDER BY e.created_at DESC
        `;
        const result = await pool.query(query, [req.user.account_id]);
        
        // Map the display_color_hex back to color_hex for frontend compatibility
        const events = result.rows.map(event => ({
            ...event,
            color_hex: event.display_color_hex || event.color_hex
        }));
        
        res.json(events);
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Get existing semester calendars for current user
router.get('/calendars/semesters', verifyToken, async (req, res) => {
    try {
        console.log('\n📋 [GET /calendars/semesters] Fetching calendars for account:', req.user.account_id);
        
        const query = `
            SELECT calendar_id, semester_name, google_calendar_id, color_hex 
            FROM semester_calendars 
            WHERE account_id = $1 
            ORDER BY semester_name
        `;
        const result = await pool.query(query, [req.user.account_id]);
        console.log(`   Found ${result.rows.length} calendars in database`);
        
        // Add color ID for each calendar
        const calendars = result.rows.map(cal => {
            const colorId = getGoogleColorIdFromHex(cal.color_hex);
            const colorData = GOOGLE_CALENDAR_COLORS.calendar[colorId] || GOOGLE_CALENDAR_COLORS.calendar['1'];
            console.log(`   ✓ ${cal.semester_name}: colorHex=${cal.color_hex} -> colorId=${colorId}`);
            return {
                ...cal,
                color_id: colorId,
                color_foreground: colorData?.foreground || '#1d1d1d'
            };
        });
        
        console.log(`   Sending ${calendars.length} calendars to client`);
        res.json(calendars);
    } catch (err) {
        console.error('❌ Error fetching semester calendars:', err);
        res.status(500).json({ error: 'Failed to fetch semester calendars' });
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
        const { class_name, location, time_slot, days, start_date, end_date, create_separate_calendar, calendar_type, semester_name } = req.body;

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

        // Check if this is a one-time event (same start and end date)
        // Extract just the date portion (YYYY-MM-DD) for comparison, ignoring any time component
        const startDateOnly = start_date instanceof Date ? start_date.toISOString().split('T')[0] : String(start_date).split('T')[0];
        const endDateOnly = end_date instanceof Date ? end_date.toISOString().split('T')[0] : String(end_date).split('T')[0];
        const isOneTimeEvent = startDateOnly === endDateOnly;
        let rrule = null;
        
        if (!isOneTimeEvent) {
            const daysArray = days.split(',').map(d => d.trim());
            const recurringDays = daysArray.map(day => dayMap[day]).filter(Boolean);
            const untilDate = new Date(end_date);
            untilDate.setHours(23, 59, 59, 0);
            const untilString = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;
        }

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
            
            console.log(`Token query result: ${tokenResult.rows.length} rows`);
            console.log(`Account ID: ${req.user.account_id}`);
            
            if (tokenResult.rows.length > 0) {
                console.log(`Token exists: ${!!tokenResult.rows[0].google_access_token}`);
                console.log(`Token length: ${tokenResult.rows[0].google_access_token ? tokenResult.rows[0].google_access_token.length : 0}`);
            }
            
            if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                let accessToken = tokenResult.rows[0].google_access_token;
                
                // Try to refresh the access token in case it's expired
                try {
                    accessToken = await refreshGoogleAccessToken(req.user.account_id);
                    console.log('✓ Access token refreshed or verified');
                } catch (refreshErr) {
                    console.warn('⚠ Could not refresh access token, using existing token:', refreshErr.message);
                    // Continue with existing token - it might still be valid
                }
                
                // Determine which calendar to use
                if (calendar_type === 'primary') {
                    // User selected default/primary calendar
                    console.log('✓ Using primary calendar');
                    googleCalendarId = 'primary';
                } else if (create_separate_calendar && semester_name) {
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
                                `${semester_name} Semester`,
                                `Events for ${semester_name} semester`
                            );
                            googleCalendarId = newCalendar.id;
                            
                            // Store the calendar mapping in database with default color (colorId '16' = #4986e7)
                            const insertCalendarQuery = `
                                INSERT INTO semester_calendars (account_id, semester_name, google_calendar_id, color_hex, created_at)
                                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                                ON CONFLICT (account_id, semester_name) DO UPDATE 
                                SET google_calendar_id = $3, color_hex = $4
                            `;
                            await pool.query(insertCalendarQuery, [req.user.account_id, semester_name, googleCalendarId, '#4986e7']);
                            console.log(`✓ Created and stored new semester calendar: ${googleCalendarId}`);
                            
                            // Include flag that new calendar was created
                            res.locals.newCalendarCreated = true;
                            res.locals.newCalendarSemester = semester_name;
                        }
                    } catch (calendarErr) {
                        console.error('Warning: Could not manage semester calendar:', calendarErr.message);
                        // Continue with primary calendar if semester calendar fails
                        googleCalendarId = 'primary';
                    }
                } else if (calendar_type === 'use' && semester_name) {
                    // User selected an existing semester calendar
                    try {
                        const calendarCheckQuery = `
                            SELECT google_calendar_id FROM semester_calendars 
                            WHERE account_id = $1 AND semester_name = $2
                        `;
                        const calendarCheckResult = await pool.query(calendarCheckQuery, [req.user.account_id, semester_name]);
                        
                        if (calendarCheckResult.rows.length > 0) {
                            // Use the existing calendar
                            googleCalendarId = calendarCheckResult.rows[0].google_calendar_id;
                            console.log(`✓ Using existing semester calendar: ${googleCalendarId}`);
                        } else {
                            // Fallback to primary if calendar not found
                            console.warn(`⚠ Requested semester calendar not found, using primary calendar`);
                            googleCalendarId = 'primary';
                        }
                    } catch (calendarErr) {
                        console.error('Warning: Could not retrieve semester calendar:', calendarErr.message);
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
                    // Don't re-throw - the event still exists in DB and on Google Calendar
                    // Just log the error and continue
                    googleError = `Database sync error: ${updateErr.message}`;
                }
            } else {
                console.log('⚠ No Google Calendar access token found for user');
                // If user has no token, event exists locally but not in Google Calendar
            }
        } catch (err) {
            console.error('Error creating Google Calendar event:', err.message);
            console.error('Calendar ID used:', googleCalendarId);
            console.error('Calendar type:', calendar_type);
            
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
            
            // Check if this is an authentication error
            if (err.message && (err.message.includes('Invalid') || err.message.includes('authentication') || err.message.includes('credentials'))) {
                // Authentication error - don't sync to Google Calendar but keep local event
                console.log('⚠ Google Calendar authentication error - event saved locally only');
                googleError = err.message;
            } else {
                // For other errors, log but don't fail the entire request if the local event was saved
                console.warn('⚠ Failed to sync to Google Calendar, but local event was saved');
                googleError = err.message;
            }
        }

        res.status(201).json({
            ...result.rows[0],
            google_event_id: googleEventId,
            google_calendar_link: googleLink,
            google_sync: googleEventId ? { status: 'synced' } : { status: 'pending', error: googleError || 'No Google Calendar access token' },
            message: googleEventId ? 'Event created and synced to Google Calendar' : 'Event created locally (not synced to Google Calendar)',
            newCalendarCreated: res.locals.newCalendarCreated || false,
            newCalendarSemester: res.locals.newCalendarSemester || null
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
                const accessTokenQuery = 'SELECT google_access_token, google_refresh_token FROM account WHERE account_id = $1';
                const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
                
                if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                    let accessToken = tokenResult.rows[0].google_access_token;
                    
                    // Try to refresh token before update
                    try {
                        accessToken = await refreshGoogleAccessToken(req.user.account_id);
                        console.log('✓ Access token refreshed for update operation');
                    } catch (refreshErr) {
                        console.warn('⚠ Could not refresh token, using existing token:', refreshErr.message);
                    }
                    
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
                const accessTokenQuery = 'SELECT google_access_token, google_refresh_token FROM account WHERE account_id = $1';
                const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
                
                if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                    let accessToken = tokenResult.rows[0].google_access_token;
                    
                    // Try to refresh token before delete
                    try {
                        accessToken = await refreshGoogleAccessToken(req.user.account_id);
                        console.log('✓ Access token refreshed for delete operation');
                    } catch (refreshErr) {
                        console.warn('⚠ Could not refresh token, using existing token:', refreshErr.message);
                    }
                    
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

// Check sync status of all events with Google Calendar
router.get('/sync-status/check', verifyToken, async (req, res) => {
    try {
        console.log('📡 /sync-status/check endpoint called for user:', req.user.account_id);
        
        const getEventsQuery = `
            SELECT event_id, class_name, google_event_id, semester_name FROM events 
            WHERE account_id = $1
        `;
        const eventsResult = await pool.query(getEventsQuery, [req.user.account_id]);
        const events = eventsResult.rows;
        console.log('📊 Found', events.length, 'events in database');

        const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
        const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
        
        if (!tokenResult.rows.length || !tokenResult.rows[0].google_access_token) {
            console.log('⚠️ No Google access token found');
            return res.json({
                events: events.map(e => ({
                    event_id: e.event_id,
                    class_name: e.class_name,
                    google_event_id: e.google_event_id,
                    exists_on_google: null,
                    status: 'no_auth'
                }))
            });
        }

        const accessToken = tokenResult.rows[0].google_access_token;
        const google = require('googleapis').google;
        const { getCalendarClient } = require('../utilities/calendar');
        const auth = await getCalendarClient(accessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        // Check each event
        const syncStatus = await Promise.all(events.map(async (event) => {
            let exists = false;
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

            if (event.google_event_id) {
                try {
                    await calendar.events.get({
                        calendarId: calendarId,
                        eventId: event.google_event_id
                    });
                    exists = true;
                } catch (err) {
                    exists = err.response?.status !== 404;
                }
            }

            return {
                event_id: event.event_id,
                class_name: event.class_name,
                google_event_id: event.google_event_id,
                exists_on_google: exists,
                status: event.google_event_id ? (exists ? 'synced' : 'missing') : 'not_synced'
            };
        }));

        console.log('✅ Sync status check complete, returning', syncStatus.length, 'results');
        res.json({ events: syncStatus });
    } catch (err) {
        console.error('❌ Error checking sync status:', err);
        res.status(500).json({ error: 'Failed to check sync status' });
    }
});

// Get all available Google Calendar colors
router.get('/colors/list', verifyToken, (req, res) => {
    try {
        // console.log('\n🌈 [GET /colors/list] Fetching available colors');
        
        const colors = Object.entries(GOOGLE_CALENDAR_COLORS.calendar).map(([id, data]) => ({
            id,
            hex: data.background,
            foreground: data.foreground
        }));
        
        // console.log(`   Returning ${colors.length} colors:`);
        // colors.forEach(c => {
        //     console.log(`   ${c.id}: ${c.hex}`);
        // });
        
        res.json(colors);
    } catch (err) {
        console.error('❌ Error fetching colors:', err);
        res.status(500).json({ error: 'Failed to fetch colors' });
    }
});

// Get event colors (IDs 1-11)
router.get('/colors/event', verifyToken, (req, res) => {
    try {
        const colors = Object.entries(GOOGLE_CALENDAR_COLORS.event).map(([id, data]) => ({
            id,
            hex: data.background,
            foreground: data.foreground
        }));
        
        res.json(colors);
    } catch (err) {
        console.error('❌ Error fetching event colors:', err);
        res.status(500).json({ error: 'Failed to fetch event colors' });
    }
});

// Update calendar color
router.put('/calendars/:calendarId/color', verifyToken, async (req, res) => {
    try {
        const { calendarId } = req.params;
        const { colorId, colorHex } = req.body;

        // console.log('\n🎨 [PUT /calendars/:calendarId/color] Color update request');
        // console.log(`   Account: ${req.user.account_id}`);
        // console.log(`   Calendar ID: ${calendarId}`);
        // console.log(`   Requested colorId: ${colorId}, colorHex: ${colorHex}`);

        if (!colorId && !colorHex) {
            console.warn('   ⚠ No colorId or colorHex provided');
            return res.status(400).json({ error: 'Either colorId or colorHex is required' });
        }

        // Get user's Google access token
        const tokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
        const tokenResult = await pool.query(tokenQuery, [req.user.account_id]);

        if (!tokenResult.rows.length || !tokenResult.rows[0].google_access_token) {
            console.warn('   ⚠ No Google access token found');
            return res.status(401).json({ error: 'Google Calendar not connected' });
        }

        let accessToken = tokenResult.rows[0].google_access_token;
        console.log('   ✓ Google access token retrieved');

        // Try to refresh token
        try {
            accessToken = await refreshGoogleAccessToken(req.user.account_id);
            console.log('   ✓ Google access token refreshed');
        } catch (refreshErr) {
            console.warn('   ⚠ Could not refresh token, using existing:', refreshErr.message);
        }

        // Determine the color ID to use
        let finalColorId = colorId;
        if (colorHex && !colorId) {
            finalColorId = getGoogleColorIdFromHex(colorHex);
            // console.log(`   Converted hex ${colorHex} to colorId ${finalColorId}`);
        } else {
            console.log(`   Using provided colorId: ${finalColorId}`);
        }

        // Get the hex value for storage
        const hexValue = colorHex || GOOGLE_CALENDAR_COLORS.calendar[finalColorId]?.background || '#039be5';
        // console.log(`   Final hex value for storage: ${hexValue}`);

        // Update calendar color in Google Calendar
        // console.log(`   📡 Updating Google Calendar ${calendarId} with colorId ${finalColorId}...`);
        const response = await updateCalendarColor(accessToken, calendarId, finalColorId);
        // console.log(`   ✓ Google Calendar updated successfully`);

        // Save color to database for the semester calendar
        try {
            const updateColorQuery = `
                UPDATE semester_calendars 
                SET color_hex = $1 
                WHERE google_calendar_id = $2 AND account_id = $3
            `;
            const dbResult = await pool.query(updateColorQuery, [hexValue, calendarId, req.user.account_id]);
            // console.log(`   ✓ Database updated: ${dbResult.rowCount} row(s) modified`);
        } catch (dbErr) {
            console.warn('   ⚠ Could not save color to database:', dbErr.message);
            // Don't fail the request if database save fails, Google Calendar was updated
        }

        try {
            const updateEventColorQuery = `
                UPDATE events
                SET color_hex = NULL
                WHERE semester_name IN (
                    SELECT semester_name FROM semester_calendars 
                    WHERE google_calendar_id = $1 AND account_id = $2
                ) AND account_id = $2
            `;
            const eventDbResult = await pool.query(updateEventColorQuery, [calendarId, req.user.account_id]);
            // console.log(`   ✓ Event colors updated in database: ${eventDbResult.rowCount} row(s) modified`);
            
            // Also update events on Google Calendar to remove their individual colors
            try {
                const getEventsQuery = `
                    SELECT google_event_id FROM events
                    WHERE semester_name IN (
                        SELECT semester_name FROM semester_calendars 
                        WHERE google_calendar_id = $1 AND account_id = $2
                    ) AND account_id = $2 AND google_event_id IS NOT NULL
                `;
                const eventsResult = await pool.query(getEventsQuery, [calendarId, req.user.account_id]);
                
                if (eventsResult.rows.length > 0) {
                    const auth = await getCalendarClient(accessToken);
                    const calendar = google.calendar({ version: 'v3', auth });
                    
                    // Update each event to remove its color (colorId field)
                    for (const event of eventsResult.rows) {
                        try {
                            await calendar.events.update({
                                calendarId: calendarId,
                                eventId: event.google_event_id,
                                requestBody: {
                                    colorId: null  // Remove individual event color
                                }
                            });
                            console.log(`   ✓ Removed event color for ${event.google_event_id}`);
                        } catch (updateErr) {
                            console.warn(`   ⚠ Could not update event ${event.google_event_id}:`, updateErr.message);
                        }
                    }
                }
            } catch (googleErr) {
                console.warn('   ⚠ Could not update events on Google Calendar:', googleErr.message);
            }
        } catch (eventDbErr) {
            console.warn('   ⚠ Could not update event colors in database:', eventDbErr.message);
            // Don't fail the request if database save fails, Google Calendar was updated
        }

        // console.log(`   ✅ Color update complete: colorId=${finalColorId}, hex=${hexValue}`);
        res.json({
            success: true,
            message: 'Calendar and event colors updated successfully',
            colorId: finalColorId,
            colorHex: hexValue,
            calendar: response
        });
    } catch (err) {
        console.error('❌ Error updating calendar color:', err);
        res.status(500).json({ error: 'Failed to update calendar color', details: err.message });
    }
});

// Delete a calendar
router.delete('/calendars/:calendarId', verifyToken, async (req, res) => {
    try {
        const { calendarId } = req.params;

        console.log(`\n🗑️ [DELETE /calendars/:calendarId] Delete calendar request`);
        console.log(`   Account: ${req.user.account_id}`);
        console.log(`   Calendar ID: ${calendarId}`);

        // Get user's Google access token
        const tokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
        const tokenResult = await pool.query(tokenQuery, [req.user.account_id]);

        if (!tokenResult.rows.length || !tokenResult.rows[0].google_access_token) {
            console.warn('   ⚠ No Google access token found');
            return res.status(401).json({ error: 'Google Calendar not connected' });
        }

        let accessToken = tokenResult.rows[0].google_access_token;

        // Try to refresh token
        try {
            accessToken = await refreshGoogleAccessToken(req.user.account_id);
            console.log('   ✓ Google access token refreshed');
        } catch (refreshErr) {
            console.warn('   ⚠ Could not refresh token, using existing:', refreshErr.message);
        }

        // Delete calendar from Google Calendar
        try {
            const auth = await getCalendarClient(accessToken);
            const calendar = google.calendar({ version: 'v3', auth });
            
            await calendar.calendars.delete({
                calendarId: calendarId
            });
            console.log('   ✓ Calendar deleted from Google Calendar');
        } catch (googleErr) {
            console.warn('   ⚠ Could not delete from Google Calendar:', googleErr.message);
            // Continue - delete from database anyway
        }

        // Delete calendar and associated events from database
        try {
            // Get the semester name first
            const getCalendarQuery = `
                SELECT semester_name FROM semester_calendars 
                WHERE google_calendar_id = $1 AND account_id = $2
            `;
            const calendarResult = await pool.query(getCalendarQuery, [calendarId, req.user.account_id]);

            if (calendarResult.rows.length > 0) {
                const semesterName = calendarResult.rows[0].semester_name;

                // Delete all events for this semester
                const deleteEventsQuery = `
                    DELETE FROM events 
                    WHERE semester_name = $1 AND account_id = $2
                `;
                const eventsResult = await pool.query(deleteEventsQuery, [semesterName, req.user.account_id]);
                console.log(`   ✓ Deleted ${eventsResult.rowCount} events for ${semesterName}`);

                // Delete the calendar
                const deleteCalendarQuery = `
                    DELETE FROM semester_calendars 
                    WHERE google_calendar_id = $1 AND account_id = $2
                `;
                const dbResult = await pool.query(deleteCalendarQuery, [calendarId, req.user.account_id]);
                console.log(`   ✓ Calendar deleted from database: ${dbResult.rowCount} row(s) removed`);
            }
        } catch (dbErr) {
            console.error('   ❌ Error deleting from database:', dbErr.message);
            return res.status(500).json({ error: 'Failed to delete calendar from database', details: dbErr.message });
        }

        console.log(`   ✅ Calendar delete complete`);
        res.json({
            success: true,
            message: 'Calendar and associated events deleted successfully'
        });
    } catch (err) {
        console.error('❌ Error deleting calendar:', err);
        res.status(500).json({ error: 'Failed to delete calendar', details: err.message });
    }
});

module.exports = router;
