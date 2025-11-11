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
                throw new Error(`Failed to create event: ${errorData.error || response.statusText}`);
            }
        }
        
        return { success: true, message: '✓ Schedule created successfully!' };
    } catch (err) {
        console.error('Error creating schedule:', err);
        throw err;
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
