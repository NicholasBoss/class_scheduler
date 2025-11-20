const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Helper function to parse time in 12-hour format to 24-hour
function parseTime12to24(timeStr) {
    const regex = /(\d{1,2}):(\d{2})\s(AM|PM)/i;
    const match = timeStr.trim().match(regex);
    
    if (!match) {
        throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
        hours += 12;
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

// Helper function to create a Date object in a specific timezone
// This works by creating an ISO string in the desired timezone
function createDateInTimezone(dateStr, timeStr, timezone) {
    // Parse time string (12-hour format) to 24-hour format
    const time24 = parseTime12to24(timeStr);
    const [hours, minutes] = time24.split(':').map(Number);
    
    // dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a date object representing midnight UTC on that date
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    
    // Get what time it is in the target timezone when it's midnight UTC on that date
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const parts = formatter.formatToParts(utcDate);
    let tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond;
    parts.forEach(part => {
        if (part.type === 'year') tzYear = parseInt(part.value);
        if (part.type === 'month') tzMonth = parseInt(part.value) - 1;
        if (part.type === 'day') tzDay = parseInt(part.value);
        if (part.type === 'hour') tzHour = parseInt(part.value);
        if (part.type === 'minute') tzMinute = parseInt(part.value);
        if (part.type === 'second') tzSecond = parseInt(part.value);
    });
    
    // Calculate the offset between UTC midnight and the timezone's midnight
    const tzMidnight = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond));
    const offsetMs = utcDate.getTime() - tzMidnight.getTime();
    
    // Now create the actual time we want (hours:minutes in that timezone)
    const targetUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    const adjustedDate = new Date(targetUtc.getTime() + offsetMs);
    
    return adjustedDate;
}

// Get OAuth2 client for the user
async function getCalendarClient(userAccessToken) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials with user's access token
    oauth2Client.setCredentials({ access_token: userAccessToken });
    return oauth2Client;
}

// Refresh Google access token if needed
async function refreshGoogleAccessToken(accountId) {
    try {
        const pool = require('../database/');
        
        // Get current tokens from database
        const query = 'SELECT google_access_token, google_refresh_token FROM account WHERE account_id = $1';
        const result = await pool.query(query, [accountId]);
        
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        
        const { google_access_token, google_refresh_token } = result.rows[0];
        
        if (!google_refresh_token) {
            console.warn('⚠ No refresh token available, cannot refresh access token');
            return google_access_token;
        }
        
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        
        oauth2Client.setCredentials({ refresh_token: google_refresh_token });
        
        // Refresh the access token
        const { credentials } = await oauth2Client.refreshAccessToken();
        const newAccessToken = credentials.access_token;
        
        // Update database with new access token
        await pool.query(
            'UPDATE account SET google_access_token = $1 WHERE account_id = $2',
            [newAccessToken, accountId]
        );
        
        console.log('✓ Google access token refreshed');
        return newAccessToken;
    } catch (err) {
        console.error('Error refreshing access token:', err.message);
        throw err;
    }
}

// Create recurring event in Google Calendar
async function createRecurringEvent(userAccessToken, eventDetails, calendarId = 'primary') {
    try {
        console.log(`Creating event on calendar: ${calendarId}`);
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        // Parse start and end times
        const { class_name, location, time_slot, days, start_date, end_date } = eventDetails;
        const [startTime, endTime] = time_slot.split(' - ');

        // Parse times correctly for America/Denver timezone
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        const event = {
            summary: class_name,
            location: location || '',
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Denver'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Denver'
            }
        };

        // Check if this is a single-day event
        if (start_date === end_date) {
            // Single day event - no recurrence
            console.log(`📅 Single day event on ${start_date}`);
        } else {
            // Multi-day recurring event
            const dayMap = {
                'Monday': 'MO',
                'Tuesday': 'TU',
                'Wednesday': 'WE',
                'Thursday': 'TH',
                'Friday': 'FR'
            };

            const recurringDays = days.split(',').map(day => dayMap[day.trim()]).filter(Boolean);
            
            // Parse end_date as a local date string (YYYY-MM-DD) without timezone conversion
            // Add 1 day to UNTIL date because RRULE UNTIL is exclusive, not inclusive
            const [year, month, day] = end_date.split('-').map(Number);
            const endDateObj = new Date(year, month - 1, day);
            endDateObj.setDate(endDateObj.getDate() + 1); // Add 1 day
            
            const untilYear = endDateObj.getFullYear();
            const untilMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
            const untilDay = String(endDateObj.getDate()).padStart(2, '0');
            const untilString = `${untilYear}${untilMonth}${untilDay}`;
            
            const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;
            console.log(`📅 Recurring event - Original end_date: ${end_date}, RRULE: ${rrule}`);
            event.recurrence = [rrule];
        }

        console.log('Event details being sent to Google Calendar:', JSON.stringify(event, null, 2));

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event
        });

        console.log('✓ Event created in Google Calendar:', response.data.id);
        console.log('Event link:', response.data.htmlLink);
        return response.data;
    } catch (err) {
        console.error('Error creating Google Calendar event:', err.message);
        console.error('Error details:', err.response?.data || err);
        console.error('Full error object:', {
            message: err.message,
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data
        });
        throw err;
    }
}

// Update event in Google Calendar
async function updateRecurringEvent(userAccessToken, googleEventId, eventDetails, calendarId = 'primary') {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });
        
        const { class_name, location, time_slot, days, end_date, start_date } = eventDetails;

        const [startTime, endTime] = time_slot.split(' - ');
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        const event = {
            summary: class_name,
            location: location || '',
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'America/Denver'
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'America/Denver'
            }
        };

        // Check if this is a single-day event
        if (start_date === end_date) {
            // Single day event - no recurrence
            console.log(`📅 Updating single day event on ${start_date}`);
        } else {
            // Multi-day recurring event
            const dayMap = {
                'Monday': 'MO',
                'Tuesday': 'TU',
                'Wednesday': 'WE',
                'Thursday': 'TH',
                'Friday': 'FR'
            };

            const recurringDays = days.split(',').map(day => dayMap[day.trim()]).filter(Boolean);
            
            // Parse end_date as a local date string (YYYY-MM-DD) without timezone conversion
            // Add 1 day to UNTIL date because RRULE UNTIL is exclusive, not inclusive
            const [year, month, day] = end_date.split('-').map(Number);
            const endDateObj = new Date(year, month - 1, day);
            endDateObj.setDate(endDateObj.getDate() + 1); // Add 1 day
            
            const untilYear = endDateObj.getFullYear();
            const untilMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
            const untilDay = String(endDateObj.getDate()).padStart(2, '0');
            const untilString = `${untilYear}${untilMonth}${untilDay}`;
            
            const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;
            console.log(`📅 Updating recurring event - Original end_date: ${end_date}, RRULE: ${rrule}`);
            event.recurrence = [rrule];
        }

        const response = await calendar.events.update({
            calendarId: calendarId,
            eventId: googleEventId,
            requestBody: event
        });

        console.log('✓ Event updated in Google Calendar:', response.data.id);
        return response.data;
    } catch (err) {
        console.error('Error updating Google Calendar event:', err.message);
        throw err;
    }
}

// Delete event from Google Calendar
async function deleteGoogleEvent(userAccessToken, googleEventId, calendarId = 'primary') {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: calendarId,
            eventId: googleEventId
        });

        console.log('✓ Event deleted from Google Calendar:', googleEventId);
        return true;
    } catch (err) {
        // If event not found on Google Calendar, that's okay - it was already deleted
        if (err.message && err.message.includes('404')) {
            console.log('⚠ Event not found on Google Calendar (already deleted or never synced):', googleEventId);
            return true; // Treat as success since the event is gone
        }
        console.error('Error deleting Google Calendar event:', err.message);
        console.error('Full error:', err.response?.data || err);
        throw err;
    }
}

// Create a new calendar for a semester
async function createGoogleCalendar(userAccessToken, calendarName, calendarDescription) {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        const calendarResource = {
            summary: calendarName,
            description: calendarDescription || `Calendar for ${calendarName}`,
            timeZone: 'America/Denver'
        };

        const response = await calendar.calendars.insert({
            requestBody: calendarResource
        });

        console.log('✓ Calendar created in Google Calendar:', response.data.id);
        return response.data; // Returns { id, summary, description, etc. }
    } catch (err) {
        console.error('Error creating Google Calendar:', err.message);
        throw err;
    }
}

// Get Google Calendar link for event
function getGoogleCalendarLink(googleEventId) {
    return `https://calendar.google.com/calendar/u/0/r/eventedit/${googleEventId}`;
}

module.exports = {
    createRecurringEvent,
    updateRecurringEvent,
    deleteGoogleEvent,
    getGoogleCalendarLink,
    createGoogleCalendar,
    refreshGoogleAccessToken
};
