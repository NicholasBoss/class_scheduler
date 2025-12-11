// Sync Status Checker Module
const SyncStatusChecker = (() => {
    const SYNC_MODAL_ID = 'syncStatusModal';
    const SYNC_LIST_ID = 'syncStatusList';

    async function checkSyncStatus() {
        try {
            const token = localStorage.getItem('token');
            // console.log('🔍 Checking sync status...');
            const response = await fetch(`${API_BASE_URL}/events/sync-status/check`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                console.error('Failed to check sync status:', response.status);
                return null;
            }

            const data = await response.json();
            // console.log('📊 Sync status response:', data);
            return data.events;
        } catch (err) {
            console.error('Error checking sync status:', err);
            return null;
        }
    }

    function displaySyncStatus(events) {
        // console.log('📋 Displaying sync status for', events ? events.length : 0, 'events');
        
        const modal = document.getElementById(SYNC_MODAL_ID);
        if (!modal) {
            console.error('❌ Sync status modal not found with id:', SYNC_MODAL_ID);
            return;
        }

        const listContainer = document.getElementById(SYNC_LIST_ID);
        if (!listContainer) {
            console.error('❌ Sync status list container not found with id:', SYNC_LIST_ID);
            return;
        }

        // Clear previous list
        listContainer.innerHTML = '';

        if (!events || events.length === 0) {
            // console.log('✓ No events to display');
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'sync-status-summary';
            emptyMessage.innerHTML = '<p>No events to check for sync status.</p>';
            listContainer.appendChild(emptyMessage);
            modal.style.display = 'block';
            return;
        }

        // Count sync statuses
        const syncedCount = events.filter(e => e.status === 'synced').length;
        const missingCount = events.filter(e => e.status === 'missing').length;
        const notSyncedCount = events.filter(e => e.status === 'not_synced').length;
        const noAuthCount = events.filter(e => e.status === 'no_auth').length;

        // Add summary
        const summary = document.createElement('div');
        summary.className = 'sync-status-summary';
        summary.innerHTML = `
            <p><strong>Sync Status Summary:</strong></p>
            <ul>
                <li>✓ Synced: ${syncedCount}</li>
                ${missingCount > 0 ? `<li>✗ Missing from Google Calendar: ${missingCount}</li>` : ''}
                ${notSyncedCount > 0 ? `<li>⊘ Not synced to Google Calendar: ${notSyncedCount}</li>` : ''}
                ${noAuthCount > 0 ? `<li>⚠ No Google authorization: ${noAuthCount}</li>` : ''}
            </ul>
        `;
        listContainer.appendChild(summary);

        // Add event list
        const eventList = document.createElement('div');
        eventList.className = 'sync-status-event-list';
        
        events.forEach(event => {
            const item = document.createElement('div');
            item.className = `sync-status-item status-${event.status}`;
            
            let statusBadge = '';
            let statusText = '';
            
            switch (event.status) {
                case 'synced':
                    statusBadge = '✓';
                    statusText = 'Synced';
                    break;
                case 'missing':
                    statusBadge = '✗';
                    statusText = 'Missing from Google Calendar';
                    break;
                case 'not_synced':
                    statusBadge = '⊘';
                    statusText = 'Not synced to Google Calendar';
                    break;
                case 'no_auth':
                    statusBadge = '⚠';
                    statusText = 'No Google authorization';
                    break;
            }
            
            item.innerHTML = `
                <span class="status-badge">${statusBadge}</span>
                <span class="event-name">${event.class_name}</span>
                <span class="status-text">${statusText}</span>
            `;
            
            eventList.appendChild(item);
        });
        
        listContainer.appendChild(eventList);

        // Show modal
        modal.style.display = 'block';
    }

    function closeModal() {
        const modal = document.getElementById(SYNC_MODAL_ID);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    let cachedStatusMap = {};

    async function init() {
        const events = await checkSyncStatus();
        if (events) {
            // Cache status map for use in event list
            cachedStatusMap = {};
            events.forEach(event => {
                cachedStatusMap[event.event_id] = event.status;
            });
            // Don't display modal - just cache the status
            // console.log('✓ Sync status cached for event list display');
        }
    }

    function getStatusMap() {
        return cachedStatusMap;
    }

    return {
        init,
        closeModal,
        getStatusMap
    };
})();
