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
function createDateInTimezone(dateStr, timeStr, timezone) {
    // Parse time string (12-hour format) to 24-hour format
    const time24 = parseTime12to24(timeStr);
    const [hours, minutes] = time24.split(':').map(Number);
    
    // Create date in UTC, but we'll adjust for timezone
    // The dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    
    // Create a date object - this creates it in local time
    const date = new Date(year, month - 1, day, hours, minutes, 0);
    
    // Now we need to adjust for timezone offset
    // Get the offset for Denver time
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
    
    // Create the same datetime and see what the UTC offset is
    const tempDate = new Date(year, month - 1, day, hours, minutes, 0);
    const parts = formatter.formatToParts(tempDate);
    
    // Get local time according to the formatter
    let localYear, localMonth, localDay, localHour, localMinute, localSecond;
    parts.forEach(part => {
        if (part.type === 'year') localYear = parseInt(part.value);
        if (part.type === 'month') localMonth = parseInt(part.value) - 1;
        if (part.type === 'day') localDay = parseInt(part.value);
        if (part.type === 'hour') localHour = parseInt(part.value);
        if (part.type === 'minute') localMinute = parseInt(part.value);
        if (part.type === 'second') localSecond = parseInt(part.value);
    });
    
    // Calculate the offset
    const utcDate = new Date(year, month - 1, day, hours, minutes, 0);
    const offset = new Date(localYear, localMonth, localDay, localHour, localMinute, localSecond) - utcDate;
    
    // Adjust the date by the offset
    const adjustedDate = new Date(tempDate.getTime() - offset);
    
    return adjustedDate;
}

// Get OAuth2 client for the user with Calendar scope
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

// Create recurring event in Google Calendar
async function createRecurringEvent(userAccessToken, eventDetails) {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        // Parse start and end times
        const { class_name, location, time_slot, days, start_date, end_date } = eventDetails;
        const [startTime, endTime] = time_slot.split(' - ');

        // Parse times correctly for America/Denver timezone
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        // Create recurrence rule
        const dayMap = {
            'Monday': 'MO',
            'Tuesday': 'TU',
            'Wednesday': 'WE',
            'Thursday': 'TH',
            'Friday': 'FR'
        };

        const recurringDays = days.split(',').map(day => dayMap[day.trim()]).filter(Boolean);
        const untilDate = new Date(end_date);
        untilDate.setHours(23, 59, 59, 0);
        const untilString = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;

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
            },
            recurrence: [rrule]
        };

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event
        });

        console.log('✓ Event created in Google Calendar:', response.data.id);
        return response.data;
    } catch (err) {
        console.error('Error creating Google Calendar event:', err.message);
        throw err;
    }
}

// Update event in Google Calendar
async function updateRecurringEvent(userAccessToken, googleEventId, eventDetails) {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });
        
        const { class_name, location, time_slot, days, end_date, start_date } = eventDetails;

        const [startTime, endTime] = time_slot.split(' - ');
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        const dayMap = {
            'Monday': 'MO',
            'Tuesday': 'TU',
            'Wednesday': 'WE',
            'Thursday': 'TH',
            'Friday': 'FR'
        };

        const recurringDays = days.split(',').map(day => dayMap[day.trim()]).filter(Boolean);
        const untilDate = new Date(end_date);
        untilDate.setHours(23, 59, 59, 0);
        const untilString = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${recurringDays.join(',')};UNTIL=${untilString}`;

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
            },
            recurrence: [rrule]
        };

        const response = await calendar.events.update({
            calendarId: 'primary',
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
async function deleteGoogleEvent(userAccessToken, googleEventId) {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: googleEventId
        });

        console.log('✓ Event deleted from Google Calendar:', googleEventId);
        return true;
    } catch (err) {
        console.error('Error deleting Google Calendar event:', err.message);
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
    getGoogleCalendarLink
};
