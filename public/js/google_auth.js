const API_BASE_URL = '<%= apiBaseUrl %>';

        // console.log('Login page script loaded');
        // console.log('API_BASE_URL:', API_BASE_URL);

        // Handle login button click
        document.getElementById('loginBtn').addEventListener('click', async () => {
            // console.log('Login button clicked');
            document.getElementById('loginBtn').disabled = true;
            document.getElementById('loadingText').style.display = 'block';

            try {
                // Get OAuth URL from backend
                const response = await fetch(`${API_BASE_URL}/auth/oauth-url`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                // console.log('✓ Received OAuth URL');

                // Redirect to Google OAuth
                window.location.href = data.url;
            } catch (err) {
                console.error('✗ Login error:', err);
                document.getElementById('loginBtn').disabled = false;
                document.getElementById('loadingText').style.display = 'none';
                
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = `Login failed: ${err.message}`;
                errorDiv.style.display = 'block';
            }
        });

        // Check if we're returning from OAuth callback with token
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = `Login error: ${decodeURIComponent(error)}`;
            errorDiv.style.display = 'block';
        }

        if (token) {
            // console.log('✓ Received token from callback, redirecting to dashboard');
            // Redirect to dashboard with token
            window.location.href = `/dashboard?token=${token}`;
        }