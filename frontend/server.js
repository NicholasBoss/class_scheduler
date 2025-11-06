const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - MUST be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security and CORS headers for Google Sign-In
app.use((req, res, next) => {
  // Allow Google domains
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Content Security Policy - Allow Google Sign-In
  res.header(
    'Content-Security-Policy',
    "script-src 'self' 'unsafe-inline' https://accounts.google.com; " +
    "frame-src 'self' https://accounts.google.com; " +
    "connect-src 'self' https://accounts.google.com https://*.google.com http://localhost:5000"
  );
  
  next();
});

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'templates'));

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'src', 'css')));
app.use('/images', express.static(path.join(__dirname, 'src', 'images')));

// Routes
app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/login', (req, res) => {
  console.log('Rendering login page with:', {
    googleClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    apiBaseUrl: process.env.REACT_APP_API_URL
  });
  res.render('login', {
    googleClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    apiBaseUrl: process.env.REACT_APP_API_URL
  });
});

app.get('/dashboard', (req, res) => {
  // Dashboard will check for token in localStorage on client side
  res.render('dashboard', {
    apiBaseUrl: process.env.REACT_APP_API_URL
  });
});

// OAuth callback from Google - proxy to backend
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state, scope } = req.query;
    
    console.log('✓ OAuth callback received');
    console.log('  Code:', code ? code.substring(0, 20) + '...' : 'missing');
    console.log('  Scopes requested:', scope);
    
    if (!code) {
      return res.status(400).send('<html><body>Authorization code missing<br/><a href="/login">Back to login</a></body></html>');
    }

    // Exchange code for tokens via backend
    const backendUrl = `${process.env.REACT_APP_API_URL}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    
    console.log('Redirecting to backend:', backendUrl);
    res.redirect(backendUrl);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`<html><body>Callback processing failed: ${err.message}<br/><a href="/login">Back to login</a></body></html>`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Frontend running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
  console.log(`✅ Frontend server running on http://localhost:${PORT}`);
  console.log(`📚 Environment variables loaded:`);
  console.log(`   - REACT_APP_GOOGLE_CLIENT_ID: ${process.env.REACT_APP_GOOGLE_CLIENT_ID ? '✓' : '✗'}`);
  console.log(`   - REACT_APP_API_URL: ${process.env.REACT_APP_API_URL}`);
});
