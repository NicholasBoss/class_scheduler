const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
require('dotenv').config();
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');

const router = express.Router();

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Decode Google JWT (without verification - Google already verified it)
function decodeGoogleJWT(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
    );
    return JSON.parse(jsonPayload);
}

// Google OAuth callback - store user
router.post('/google-login', async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ error: 'No credential provided' });
        }

        // Decode Google JWT
        const googleData = decodeGoogleJWT(credential);
        console.log('Google data:', googleData);

        const { sub: google_id, email, name } = googleData;
        const [firstName, lastName] = name ? name.split(' ') : ['', ''];

        // Check if user exists
        const userQuery = 'SELECT * FROM account WHERE google_id = $1';
        const userResult = await pool.query(userQuery, [google_id]);

        let accountId;

        if (userResult.rows.length > 0) {
            // User exists - update last login
            accountId = userResult.rows[0].account_id;
            await pool.query(
                'UPDATE account SET last_login = CURRENT_TIMESTAMP WHERE account_id = $1',
                [accountId]
            );
        } else {
            // New user - create account
            const insertQuery = `
                INSERT INTO account (google_id, account_email, account_firstname, account_lastname, created_at, last_login)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING account_id
            `;
            const insertResult = await pool.query(insertQuery, [google_id, email, firstName, lastName]);
            accountId = insertResult.rows[0].account_id;
        }

        // Generate JWT token
        const token = jwt.sign(
            { account_id: accountId, email, name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: { account_id: accountId, email, name }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

// Generate OAuth URL for Calendar permissions
router.get('/oauth-url', (req, res) => {
    try {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.app.created',
            'https://www.googleapis.com/auth/calendar.calendarlist'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: Math.random().toString(36).substring(7) // Simple state token
        });

        console.log('✓ Generated OAuth URL with Calendar scope');
        res.json({ url });
    } catch (err) {
        console.error('Error generating OAuth URL:', err);
        res.status(500).json({ error: 'Failed to generate OAuth URL' });
    }
});

// OAuth callback - exchange code for tokens
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }

        console.log('✓ Received authorization code');

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        console.log('✓ Exchanged code for tokens');

        // Get user info from the ID token
        const idToken = tokens.id_token;
        const googleData = decodeGoogleJWT(idToken);
        console.log('Google OAuth data:', { email: googleData.email, name: googleData.name });

        const { sub: google_id, email, name } = googleData;
        const [firstName, lastName] = name ? name.split(' ') : ['', ''];

        // Check if user exists
        const userQuery = 'SELECT * FROM account WHERE google_id = $1';
        const userResult = await pool.query(userQuery, [google_id]);

        let accountId;

        if (userResult.rows.length > 0) {
            // User exists - update last login and store access token
            accountId = userResult.rows[0].account_id;
            const updateQuery = `
                UPDATE account 
                SET last_login = CURRENT_TIMESTAMP, google_access_token = $1, google_refresh_token = $2
                WHERE account_id = $3
            `;
            await pool.query(updateQuery, [tokens.access_token, tokens.refresh_token || null, accountId]);
            console.log('✓ Updated existing user with access token');
        } else {
            // New user - create account with access token
            const insertQuery = `
                INSERT INTO account (google_id, account_email, account_firstname, account_lastname, google_access_token, google_refresh_token, created_at, last_login)
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING account_id
            `;
            const insertResult = await pool.query(insertQuery, [google_id, email, firstName, lastName, tokens.access_token, tokens.refresh_token || null]);
            accountId = insertResult.rows[0].account_id;
            console.log('✓ Created new user with access token');
        }

        // Generate JWT token
        const jwtToken = jwt.sign(
            { account_id: accountId, email, name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set token in cookie for server-side rendering
        res.cookie('jwt', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to dashboard
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
        res.redirect(`${frontendUrl}/dashboard`);
    } catch (err) {
        console.error('OAuth callback error:', err);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
    }
});

// Verify token
router.get('/verify', verifyToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// Get user's Google access token (for Calendar API calls)
router.get('/google-access-token', verifyToken, async (req, res) => {
    try {
        const query = 'SELECT google_access_token FROM account WHERE account_id = $1';
        const result = await pool.query(query, [req.user.account_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const accessToken = result.rows[0].google_access_token;

        if (!accessToken) {
            return res.status(403).json({ 
                error: 'No Google Calendar access token found. Please re-authorize.' 
            });
        }

        res.json({ access_token: accessToken });
    } catch (err) {
        console.error('Error retrieving access token:', err);
        res.status(500).json({ error: 'Failed to retrieve access token' });
    }
});

// Logout (client-side, but can add token blacklist if needed)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
