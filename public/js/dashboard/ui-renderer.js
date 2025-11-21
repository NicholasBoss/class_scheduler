// Render events list
function renderEventsList(events) {
    const container = document.getElementById('eventListContainer');
    
    if (events.length === 0) {
        container.innerHTML = '<p>No events yet. Create one to get started!</p>';
        return;
    }

    // Get sync status map if available
    const statusMap = (typeof SyncStatusChecker !== 'undefined') ? SyncStatusChecker.getStatusMap() : {};

    let html = '<div class="events-list">';
    events.forEach(event => {
        // Create a clickable location link (BYU-I Campus Map)
        let locationLink = event.location;
        if (event.location) {
            // Parse building code and room number
            let building = '';
            let room = '';
            
            // Try to parse building and room from location string
            if (event.location.length > 3 && event.location[3] === ' ') {
                building = event.location.substring(0, 3);
                room = event.location.substring(4).trim();
            } else if (event.location.length > 4 && event.location[4] === ' ') {
                building = event.location.substring(0, 4);
                room = event.location.substring(5).trim();
            } else {
                building = event.location.replace(/[0-9]/g, '').trim();
                room = event.location.replace(/[^0-9]/g, '').trim();
            }
            
            if (building && room) {
                const mapUrl = `https://maps.byui.edu/interactive-map/index.html?building=${encodeURIComponent(building)}&room=${encodeURIComponent(room)}`;
                locationLink = `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer" title="Open on BYU-I Campus Map">${event.location} 🗺️</a>`;
            }
        }
        
        // Determine status badge and text
        let statusBadge = '';
        let statusClass = '';
        const eventStatus = statusMap[event.event_id];
        
        if (eventStatus) {
            statusClass = `status-badge-${eventStatus}`;
            switch (eventStatus) {
                case 'synced':
                    statusBadge = '<span class="event-status synced" data-symbol="✓">✓ Synced</span>';
                    break;
                case 'missing':
                    statusBadge = '<span class="event-status missing" data-symbol="✗">✗ Missing</span>';
                    break;
                case 'not_synced':
                    statusBadge = '<span class="event-status not-synced" data-symbol="⊘">⊘ Not Synced</span>';
                    break;
                case 'no_auth':
                    statusBadge = '<span class="event-status no-auth" data-symbol="⚠">⚠ No Auth</span>';
                    break;
            }
        }
        
        // Determine if this is a recurring event or one-time event
        const isRecurring = event.recurrence_rule && event.recurrence_rule.trim().length > 0;
        
        let dateOrDaysDisplay = '';
        if (isRecurring) {
            // Show days for recurring events
            dateOrDaysDisplay = `<p><strong>Days:</strong> ${event.days}</p>`;
        } else {
            // Show date for one-time events
            // Parse the date string directly to avoid timezone issues
            // start_date comes as ISO string, extract just the date part
            let displayDate = event.start_date;
            if (typeof displayDate === 'string') {
                // Handle ISO datetime string format
                displayDate = displayDate.split('T')[0];
            }
            
            // Parse the YYYY-MM-DD format directly
            const [year, month, day] = displayDate.split('-').map(Number);
            const eventDate = new Date(year, month - 1, day);
            
            const formattedDate = eventDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            dateOrDaysDisplay = `<p><strong>Date:</strong> ${formattedDate}</p>`;
        }
        
        html += `
            <div class="event-card ${statusClass}">
                <div class="event-card-header">
                    <h3>${event.class_name}</h3>
                    <div class="event-actions">
                        ${statusBadge}
                        <button class="btn-edit" onclick="editEvent(${event.event_id})">Edit</button>
                        <button class="btn-delete" onclick="deleteEvent(${event.event_id})">Delete</button>
                    </div>
                </div>
                <p><strong>Location:</strong> ${locationLink}</p>
                ${dateOrDaysDisplay}
                <p><strong>Time:</strong> ${event.time_slot}</p>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}
