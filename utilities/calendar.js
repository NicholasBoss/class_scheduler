const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Initialize Google Calendar API
const calendar = google.calendar('v3');

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

// Create recurring event in Google Calendar
async function createRecurringEvent(userAccessToken, eventDetails) {
    try {
        const auth = await getCalendarClient(userAccessToken);

        // Parse start and end times
        const { class_name, location, time_slot, days, start_date, end_date } = eventDetails;
        const [startTime, endTime] = time_slot.split(' - ');

        // Parse times
        const startDateTime = new Date(`${start_date} ${startTime}`);
        const endDateTime = new Date(`${start_date} ${endTime}`);

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
            auth,
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
        const { class_name, location, time_slot, days, end_date, start_date } = eventDetails;

        const [startTime, endTime] = time_slot.split(' - ');
        const startDateTime = new Date(`${start_date} ${startTime}`);
        const endDateTime = new Date(`${start_date} ${endTime}`);

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
            auth,
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

        await calendar.events.delete({
            auth,
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
