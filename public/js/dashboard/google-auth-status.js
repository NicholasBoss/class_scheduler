// Google Calendar Authorization Status Module
const GoogleAuthStatus = (() => {
    
    // Check if user has valid Google Calendar authorization
    async function checkAuthStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google-access-token`, {
                credentials: 'include'
            });

            // console.log('Auth status response:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                // console.log('Auth token response:', data);
                if (data.access_token) {
                    // console.log('✓ Google Calendar access token found');
                    hideAuthWarning();
                    return true;
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.warn('⚠ Auth endpoint returned:', response.status, errorData);
            }
            
            console.warn('⚠ No Google Calendar access token found');
            showAuthWarning();
            return false;
        } catch (err) {
            console.error('Error checking auth status:', err);
            showAuthWarning();
            return false;
        }
    }

    // Show warning that Google Calendar is not authorized
    function showAuthWarning() {
        const section = document.getElementById('calendarStatusSection');
        const box = document.getElementById('calendarStatusBox');
        
        if (!section || !box) return;

        box.innerHTML = `
            <div class="warning-message">
                <strong>⚠ Google Calendar Not Authorized</strong>
                <p>Your classes won't be synced to Google Calendar. To enable syncing, please re-authorize Google Calendar access.</p>
                <button class="reauth-btn" onclick="GoogleAuthStatus.reauthorize()">Re-authorize Google Calendar</button>
            </div>
        `;
        section.style.display = 'block';
    }

    // Hide auth warning
    function hideAuthWarning() {
        const section = document.getElementById('calendarStatusSection');
        if (section) {
            section.style.display = 'none';
        }
    }

    // Redirect to OAuth authorization
    async function reauthorize() {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/oauth-url`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to get OAuth URL');
            }

            const data = await response.json();
            // console.log('✓ Redirecting to Google OAuth');
            window.location.href = data.url;
        } catch (err) {
            console.error('Error during re-authorization:', err);
            alert('Failed to start re-authorization: ' + err.message);
        }
    }

    return {
        checkAuthStatus,
        reauthorize
    };
})();
