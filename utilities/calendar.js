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
            // console.warn('⚠ No refresh token available, cannot refresh access token');
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
        
        // console.log('✓ Google access token refreshed');
        return newAccessToken;
    } catch (err) {
        // console.error('Error refreshing access token:', err.message);
        throw err;
    }
}

// Create recurring event in Google Calendar
async function createRecurringEvent(userAccessToken, eventDetails, calendarId = 'primary') {
    try {
        // console.log(`Creating event on calendar: ${calendarId}`);
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });

        // Parse start and end times
        const { class_name, location, time_slot, days, start_date, end_date, reminders } = eventDetails;
        const [startTime, endTime] = time_slot.split(' - ');

        // Parse times correctly for America/Denver timezone
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        // Format datetime without milliseconds for Google Calendar API
        const formatDateTimeForGoogle = (date) => {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        const event = {
            summary: class_name,
            location: location || '',
            start: {
                dateTime: formatDateTimeForGoogle(startDateTime),
                timeZone: 'America/Denver'
            },
            end: {
                dateTime: formatDateTimeForGoogle(endDateTime),
                timeZone: 'America/Denver'
            }
        };

        // Check if this is a single-day event
        if (start_date === end_date) {
            // Single day event - no recurrence
            console.log(`📅 Single day event on ${start_date}`);
        } else {
            // Multi-day recurring event
            // Map day names to getDay() values (0=Sunday, 1=Monday, etc.)
            const dayNameToGetDayValue = {
                'Monday': 1,
                'Tuesday': 2,
                'Wednesday': 3,
                'Thursday': 4,
                'Friday': 5
            };

            const dayNameToRRuleValue = {
                'Monday': 'MO',
                'Tuesday': 'TU',
                'Wednesday': 'WE',
                'Thursday': 'TH',
                'Friday': 'FR'
            };

            const recurringDays = days.split(',').map(day => dayNameToRRuleValue[day.trim()]).filter(Boolean);
            const selectedDayNumbers = days.split(',').map(day => dayNameToGetDayValue[day.trim()]).filter(d => d !== undefined);
            
            // Find the first occurrence date that matches one of the selected days
            // Start from the start_date and check if it matches, otherwise move forward
            const [startYear, startMonth, startDay] = start_date.split('-').map(Number);
            let firstOccurrenceDate = new Date(startYear, startMonth - 1, startDay);
            
            // Keep incrementing the date until we find a day that matches one of the selected days
            let daysChecked = 0;
            const maxDaysToCheck = 7; // Safety check to avoid infinite loops
            
            while (!selectedDayNumbers.includes(firstOccurrenceDate.getDay()) && daysChecked < maxDaysToCheck) {
                firstOccurrenceDate.setDate(firstOccurrenceDate.getDate() + 1);
                daysChecked++;
            }
            
            // Format the first occurrence date as YYYY-MM-DD
            const firstOccurrenceYear = firstOccurrenceDate.getFullYear();
            const firstOccurrenceMonth = String(firstOccurrenceDate.getMonth() + 1).padStart(2, '0');
            const firstOccurrenceDay = String(firstOccurrenceDate.getDate()).padStart(2, '0');
            const firstOccurrenceDateString = `${firstOccurrenceYear}-${firstOccurrenceMonth}-${firstOccurrenceDay}`;
            
            // console.log(`📅 Recurring event - Start date: ${start_date}, First occurrence: ${firstOccurrenceDateString}, Days: ${days}`);
            
            // Update the event to use the first occurrence date
            const firstOccurrenceStartDateTime = createDateInTimezone(firstOccurrenceDateString, startTime, 'America/Denver');
            const firstOccurrenceEndDateTime = createDateInTimezone(firstOccurrenceDateString, endTime, 'America/Denver');
            
            event.start = {
                dateTime: formatDateTimeForGoogle(firstOccurrenceStartDateTime),
                timeZone: 'America/Denver'
            };
            
            event.end = {
                dateTime: formatDateTimeForGoogle(firstOccurrenceEndDateTime),
                timeZone: 'America/Denver'
            };
            
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
            // console.log(`📅 Recurring RRULE: ${rrule}`);
            event.recurrence = [rrule];
        }

        // Always add default 15-minute reminder, plus any custom reminders selected
        const reminderOverrides = [
            {
                method: 'popup',
                minutes: 15
            }
        ];
        
        if (reminders && reminders.length > 0) {
            reminders.forEach(minutesBefore => {
                reminderOverrides.push({
                    method: 'popup',
                    minutes: parseInt(minutesBefore)
                });
            });
            // console.log(`🔔 Reminders added (15-min default + custom):`, reminderOverrides);
        } else {
            console.log(`🔔 Default 15-minute reminder added`);
        }
        
        event.reminders = {
            useDefault: false,
            overrides: reminderOverrides
        };

        // console.log('Event details being sent to Google Calendar:', JSON.stringify(event, null, 2));

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event
        });

        // console.log('✓ Event created in Google Calendar:', response.data.id);
        // console.log('Event link:', response.data.htmlLink);
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
        
        // Check if it's an authentication error
        if (err.response?.status === 401 || err.message?.includes('authentication')) {
            const authError = new Error('Google Calendar authentication failed. Invalid or expired credentials.');
            authError.statusCode = 401;
            throw authError;
        }
        throw err;
    }
}

// Update event in Google Calendar
async function updateRecurringEvent(userAccessToken, googleEventId, eventDetails, calendarId = 'primary') {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });
        
        const { class_name, location, time_slot, days, end_date, start_date, reminders } = eventDetails;

        const [startTime, endTime] = time_slot.split(' - ');
        const startDateTime = createDateInTimezone(start_date, startTime, 'America/Denver');
        const endDateTime = createDateInTimezone(start_date, endTime, 'America/Denver');

        // Format datetime without milliseconds for Google Calendar API
        const formatDateTimeForGoogle = (date) => {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };

        const event = {
            summary: class_name,
            location: location || '',
            start: {
                dateTime: formatDateTimeForGoogle(startDateTime),
                timeZone: 'America/Denver'
            },
            end: {
                dateTime: formatDateTimeForGoogle(endDateTime),
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

        // Always add default 15-minute reminder, plus any custom reminders selected
        const reminderOverrides = [
            {
                method: 'popup',
                minutes: 15
            }
        ];
        
        if (reminders && reminders.length > 0) {
            reminders.forEach(minutesBefore => {
                reminderOverrides.push({
                    method: 'popup',
                    minutes: parseInt(minutesBefore)
                });
            });
            console.log(`🔔 Reminders updated (15-min default + custom):`, reminderOverrides);
        } else {
            console.log(`🔔 Default 15-minute reminder (no custom reminders)`);
        }
        
        event.reminders = {
            useDefault: false,
            overrides: reminderOverrides
        };

        const response = await calendar.events.update({
            calendarId: calendarId,
            eventId: googleEventId,
            requestBody: event
        });

        // console.log('✓ Event updated in Google Calendar:', response.data.id);
        return response.data;
    } catch (err) {
        console.error('Error updating Google Calendar event:', err.message);
        // Check if it's an authentication error
        if (err.response?.status === 401 || err.message?.includes('authentication')) {
            const authError = new Error('Google Calendar authentication failed. Invalid or expired credentials.');
            authError.statusCode = 401;
            throw authError;
        }
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

        // console.log('✓ Event deleted from Google Calendar:', googleEventId);
        return true;
    } catch (err) {
        // If event not found on Google Calendar, that's okay - it was already deleted
        const status = err.response?.status || err.status;
        if (status === 404 || (err.message && err.message.includes('404'))) {
            // console.log('⚠ Event not found on Google Calendar (already deleted or never synced):', googleEventId);
            return true; // Treat as success since the event is gone
        }
        console.error('Error deleting Google Calendar event:', err.message);
        console.error('Full error:', err.response?.data || err);
        throw err;
    }
}

// Create a new calendar for a semester
async function createGoogleCalendar(userAccessToken, calendarName, calendarDescription, colorId = '16') {
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

        // console.log('✓ Calendar created in Google Calendar:', response.data.id);
        
        // Set the calendar color after creation
        try {
            await calendar.calendarList.update({
                calendarId: response.data.id,
                requestBody: {
                    colorId: String(colorId)
                }
            });
            // console.log(`✓ Calendar color set to colorId ${colorId}`);
        } catch (colorErr) {
            console.warn('⚠ Could not set calendar color:', colorErr.message);
            // Continue - calendar was created even if color setting failed
        }

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

// Google Calendar color definitions from the API
const GOOGLE_CALENDAR_COLORS = {
    calendar: {
        '1': { background: '#ac725e', foreground: '#1d1d1d' },
        '2': { background: '#d06b64', foreground: '#1d1d1d' },
        '3': { background: '#f83a22', foreground: '#1d1d1d' },
        '4': { background: '#fa573c', foreground: '#1d1d1d' },
        '5': { background: '#ff7537', foreground: '#1d1d1d' },
        '6': { background: '#ffad46', foreground: '#1d1d1d' },
        '7': { background: '#42d692', foreground: '#1d1d1d' },
        '8': { background: '#16a765', foreground: '#1d1d1d' },
        '9': { background: '#7bd148', foreground: '#1d1d1d' },
        '10': { background: '#b3dc6c', foreground: '#1d1d1d' },
        '11': { background: '#fbe983', foreground: '#1d1d1d' },
        '12': { background: '#fad165', foreground: '#1d1d1d' },
        '13': { background: '#92e1c0', foreground: '#1d1d1d' },
        '14': { background: '#9fe1e7', foreground: '#1d1d1d' },
        '15': { background: '#9fc6e7', foreground: '#1d1d1d' },
        '16': { background: '#4986e7', foreground: '#1d1d1d' },
        '17': { background: '#9a9cff', foreground: '#1d1d1d' },
        '18': { background: '#b99aff', foreground: '#1d1d1d' },
        '19': { background: '#c2c2c2', foreground: '#1d1d1d' },
        '20': { background: '#cabdbf', foreground: '#1d1d1d' },
        '21': { background: '#cca6ac', foreground: '#1d1d1d' },
        '22': { background: '#f691b2', foreground: '#1d1d1d' },
        '23': { background: '#cd74e6', foreground: '#1d1d1d' },
        '24': { background: '#a47ae2', foreground: '#1d1d1d' }
    },
    event: {
        '1': { background: '#a4bdfc', foreground: '#1d1d1d' },
        '2': { background: '#7ae7bf', foreground: '#1d1d1d' },
        '3': { background: '#dbadff', foreground: '#1d1d1d' },
        '4': { background: '#ff887c', foreground: '#1d1d1d' },
        '5': { background: '#fbd75b', foreground: '#1d1d1d' },
        '6': { background: '#ffb878', foreground: '#1d1d1d' },
        '7': { background: '#46d6db', foreground: '#1d1d1d' },
        '8': { background: '#e1e1e1', foreground: '#1d1d1d' },
        '9': { background: '#5484ed', foreground: '#1d1d1d' },
        '10': { background: '#51b749', foreground: '#1d1d1d' },
        '11': { background: '#dc2127', foreground: '#1d1d1d' }
    }
};

// Map hex color to Google Calendar color ID
function getGoogleColorIdFromHex(hexColor) {
    if (!hexColor) {
        return '1'; // Default to first color
    }
    
    const normalizedInput = hexColor.toLowerCase();
    const palette = GOOGLE_CALENDAR_COLORS.calendar;
    
    for (const [colorId, colorData] of Object.entries(palette)) {
        if (colorData.background.toLowerCase() === normalizedInput) {
            return colorId;
        }
    }
    
    // Return default if not found
    return '1';
}

// Get color hex from color ID
function getColorHexFromId(colorId) {
    const palette = GOOGLE_CALENDAR_COLORS.calendar;
    if (palette[colorId]) {
        return palette[colorId].background;
    }
    return '#ac725e'; // Default
}

// Get event color hex from event color ID (1-11)
function getEventColorHexFromId(colorId) {
    const palette = GOOGLE_CALENDAR_COLORS.event;
    if (palette[colorId]) {
        return palette[colorId].background;
    }
    return '#a4bdfc'; // Default (color 1)
}

// Update calendar color in Google Calendar
async function updateCalendarColor(userAccessToken, calendarId, colorId) {
    try {
        const auth = await getCalendarClient(userAccessToken);
        const calendar = google.calendar({ version: 'v3', auth });
        
        const response = await calendar.calendarList.update({
            calendarId: calendarId,
            requestBody: {
                colorId: String(colorId)
            }
        });
        
        // console.log(`✓ Calendar color updated to colorId ${colorId}`);
        return response.data;
    } catch (err) {
        console.error('Error updating calendar color:', err.message);
        throw err;
    }
}

module.exports = {
    createRecurringEvent,
    updateRecurringEvent,
    deleteGoogleEvent,
    getGoogleCalendarLink,
    createGoogleCalendar,
    refreshGoogleAccessToken,
    getCalendarClient,
    getGoogleColorIdFromHex,
    getColorHexFromId,
    getEventColorHexFromId,
    updateCalendarColor,
    GOOGLE_CALENDAR_COLORS
};
