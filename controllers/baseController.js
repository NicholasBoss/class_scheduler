const baseController = {}
require('dotenv').config();

baseController.buildHome = async function(req, res){
    return res.render('index', {
        title: 'Home', 
        link: '', 
        errors: null,
        loggedin: res.locals.loggedin || false,
        accountData: res.locals.accountData || null
    })
}

baseController.buildLogin = async function(req, res){
    return res.render('login/login', {
        title: 'Login', 
        link: 'login', 
        errors: null,
        apiBaseUrl: process.env.REACT_APP_API_URL,
        loggedin: false
    })
}

baseController.buildDashboard = async function(req, res){
    // Check if user is authenticated via JWT
    // console.log('Dashboard - req.user:', req.user ? req.user.email : 'UNDEFINED')
    
    if (!req.user) {
        // console.log('❌ No user found on dashboard, redirecting to login')
        return res.redirect('/login')
    }

    // console.log('✓ User authenticated, rendering dashboard')
    return res.render('dashboard/dashboard', {
        title: 'Dashboard', 
        link: 'dashboard', 
        errors: null,
        user: req.user,
        apiBaseUrl: process.env.REACT_APP_API_URL
    })
}

baseController.buildPrivacy = async function(req, res){
    return res.render('privacy', {
        title: 'Privacy Policy', 
        link: 'privacy', 
        errors: null,
        loggedin: res.locals.loggedin || false,
        accountData: res.locals.accountData || null
    })
}

baseController.verifyGoogle = async function(req, res){
    // This function can be expanded to verify Google integration if needed
    return res.render('googlec5cea6684177558d', {
        title: 'Verify Google', 
        link: 'verify', 
        errors: null,
        loggedin: res.locals.loggedin || false,
        accountData: res.locals.accountData || null
    })
}

baseController.logout = async function(req, res) {
    // Clear the JWT cookie
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    
    // Redirect to home
    res.redirect("/")
}

module.exports = baseController