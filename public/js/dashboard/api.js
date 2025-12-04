// Load events from API
async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE_URL}/events`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const events = await response.json();
        renderEventsList(events);
    } catch (err) {
        console.error('Error loading events:', err);
        document.getElementById('eventListContainer').innerHTML = '<p>Unable to load events. Please try refreshing the page.</p>';
    }
}

// Create schedule (submit all events)
async function createSchedule(events) {
    try {
        let newCalendarCreated = false;
        let newCalendarSemester = null;
        
        for (const event of events) {
            const response = await fetch(`${API_BASE_URL}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(event)
            });

            if (!response.ok) {
                const errorData = await response.json();
                
                // Check if it's an authentication error
                if (response.status === 401 && errorData.authError) {
                    const error = new Error(errorData.error);
                    error.authError = true;
                    throw error;
                }
                
                throw new Error(`Failed to create event: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            
            // Track if a new calendar was created
            if (data.newCalendarCreated) {
                newCalendarCreated = true;
                newCalendarSemester = data.newCalendarSemester;
            }
            
            // Check for Google Calendar sync warnings
            if (data.google_sync && data.google_sync.status === 'pending' && data.google_sync.error) {
                console.warn('⚠ Google Calendar sync warning:', data.google_sync.error);
                // Show warning to user but don't fail
                alert(`⚠ Note: ${data.message}\n\nReason: ${data.google_sync.error}`);
            }
        }
        
        return { 
            success: true, 
            message: '✓ Schedule created successfully!',
            newCalendarCreated,
            newCalendarSemester
        };
    } catch (err) {
        console.error('Error creating schedule:', err);
        throw err;
    }
}

// Check sync status after event creation (with delay for Google Calendar to process)
async function checkSyncStatusAfterDelay(delayMs = 7000) {
    try {
        // Wait for specified delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Check sync status
        if (typeof SyncStatusChecker !== 'undefined') {
            await SyncStatusChecker.init();
        }
        
        // Re-render events with updated status
        await loadEvents();
        
        console.log('✓ Events re-rendered with sync status');
    } catch (err) {
        console.error('Error checking sync status after creation:', err);
    }
}

// Delete event
async function deleteEventAPI(eventId) {
    try {
        const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to delete event: ${errorData.error || response.statusText}`);
        }

        return await response.json();
    } catch (err) {
        console.error('Error deleting event:', err);
        throw err;
    }
}
