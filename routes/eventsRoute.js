const express = require('express');
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');
const { createRecurringEvent, updateRecurringEvent, deleteGoogleEvent, getGoogleCalendarLink } = require('../utilities/calendar');

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
        
        // Get deleted occurrences for all events
        const deletedQuery = `
            SELECT event_id, deleted_date FROM deleted_occurrences
            WHERE account_id = $1
        `;
        const deletedResult = await pool.query(deletedQuery, [req.user.account_id]);
        
        // Group deleted dates by event_id
        const deletedOccurrences = {};
        deletedResult.rows.forEach(row => {
            if (!deletedOccurrences[row.event_id]) {
                deletedOccurrences[row.event_id] = [];
            }
            deletedOccurrences[row.event_id].push(row.deleted_date);
        });
        
        // Add deleted occurrences to each event
        const eventsWithDeleted = result.rows.map(event => ({
            ...event,
            deleted_occurrences: deletedOccurrences[event.event_id] || []
        }));
        
        res.json(eventsWithDeleted);
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
        
        // Get deleted occurrences for this event
        const deletedQuery = `
            SELECT deleted_date FROM deleted_occurrences
            WHERE event_id = $1 AND account_id = $2
        `;
        const deletedResult = await pool.query(deletedQuery, [req.params.id, req.user.account_id]);
        const deleted_occurrences = deletedResult.rows.map(row => row.deleted_date);
        
        res.json({
            ...event,
            deleted_occurrences
        });
    } catch (err) {
        console.error('Error fetching event:', err);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

// Create new event
router.post('/', verifyToken, async (req, res) => {
    try {
        const { class_name, location, time_slot, days, start_date, end_date } = req.body;

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

        let googleEventId = null;
        let googleLink = null;
        let googleError = null;

        // Try to get user's Google access token and create in Google Calendar
        try {
            const accessTokenQuery = 'SELECT google_access_token FROM account WHERE account_id = $1';
            const tokenResult = await pool.query(accessTokenQuery, [req.user.account_id]);
            
            if (tokenResult.rows.length > 0 && tokenResult.rows[0].google_access_token) {
                const accessToken = tokenResult.rows[0].google_access_token;
                const googleEvent = await createRecurringEvent(
                    accessToken,
                    { class_name, location: locationValidation.formatted, time_slot, days, start_date, end_date }
                );
                googleEventId = googleEvent.id;
                googleLink = googleEvent.htmlLink;
                console.log('✓ Event synced to Google Calendar');
            } else {
                console.log('⚠ No Google Calendar access token found for user');
            }
        } catch (err) {
            console.error('Warning: Could not sync to Google Calendar:', err.message);
            googleError = err.message;
            // Don't fail the entire request if Google Calendar fails
        }

        const query = `
            INSERT INTO events (account_id, class_name, location, time_slot, days, start_date, end_date, created_at, recurrence_rule, google_event_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9)
            RETURNING *
        `;
        const result = await pool.query(query, [
            req.user.account_id,
            class_name,
            locationValidation.formatted,
            time_slot,
            days,
            start_date,
            end_date,
            rrule,
            googleEventId
        ]);

        res.status(201).json({
            ...result.rows[0],
            google_calendar_link: googleLink,
            google_sync: googleError ? { status: 'pending', error: googleError } : { status: 'synced' },
            message: googleError ? 'Event created locally (Google Calendar sync failed - will retry on next sync)' : 'Event created and synced to Google Calendar'
        });
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ error: 'Failed to create event' });
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
                    await updateRecurringEvent(
                        accessToken,
                        existingEvent.google_event_id,
                        { class_name, location: locationValidation.formatted, time_slot, days, start_date, end_date }
                    );
                    console.log('✓ Event updated in Google Calendar');
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
                    await deleteGoogleEvent(
                        accessToken,
                        event.google_event_id
                    );
                    console.log('✓ Event deleted from Google Calendar');
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

// Delete specific occurrences of a recurring event
router.post('/:id/delete-occurrences', verifyToken, async (req, res) => {
    try {
        const { dates } = req.body;

        if (!dates || !Array.isArray(dates) || dates.length === 0) {
            return res.status(400).json({ error: 'No dates provided for deletion' });
        }

        // Get the event first to verify ownership and get details
        const getQuery = `
            SELECT * FROM events 
            WHERE event_id = $1 AND account_id = $2
        `;
        const getResult = await pool.query(getQuery, [req.params.id, req.user.account_id]);

        if (getResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = getResult.rows[0];

        // Note: Deleting specific occurrences from Google Calendar recurring events is complex
        // and requires special handling. For now, we'll just track deletions in the local database.
        // When the calendar is fetched, deleted occurrences will be filtered out.
        console.log(`Recording deletion of ${dates.length} occurrence(s) for event ${req.params.id}`);

        // Store deleted occurrences in local database
        // Create a table to track deleted occurrences if it doesn't exist (only once)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deleted_occurrences (
                id SERIAL PRIMARY KEY,
                event_id INT NOT NULL,
                deleted_date DATE NOT NULL,
                deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                account_id INT NOT NULL,
                FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
                UNIQUE(event_id, deleted_date)
            )
        `);

        // Insert the deleted occurrences
        const deleteOccurrenceQuery = `
            INSERT INTO deleted_occurrences (event_id, deleted_date, account_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (event_id, deleted_date) DO NOTHING
        `;

        let successCount = 0;
        for (const date of dates) {
            try {
                const result = await pool.query(deleteOccurrenceQuery, [
                    req.params.id,
                    date,
                    req.user.account_id
                ]);
                if (result.rowCount > 0) {
                    successCount++;
                }
            } catch (err) {
                console.error(`Error recording deleted occurrence on ${date}:`, err);
            }
        }

        res.json({
            success: true,
            message: `Successfully deleted ${successCount} occurrence(s)`,
            deleted_count: successCount,
            total_requested: dates.length
        });
    } catch (err) {
        console.error('Error deleting occurrences:', err);
        res.status(500).json({ error: 'Failed to delete occurrences' });
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
