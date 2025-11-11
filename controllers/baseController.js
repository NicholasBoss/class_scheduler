const baseController = {}
require('dotenv').config();

baseController.buildHome = async function(req, res){
    res.render('index', {
        title: 'Home', 
        link: '', 
        errors: null,
        loggedin: false,
        accountData: null
    })
}

baseController.buildLogin = async function(req, res){
    res.render('login/login', {
        title: 'Login', 
        link: 'login', 
        errors: null,
        apiBaseUrl: process.env.REACT_APP_API_URL,
        loggedin: false
    })
}

baseController.buildDashboard = async function(req, res){
    // Check if user is authenticated via JWT
    console.log('Dashboard - req.user:', req.user ? req.user.email : 'UNDEFINED')
    
    if (!req.user) {
        console.log('❌ No user found on dashboard, redirecting to login')
        return res.redirect('/login')
    }

    console.log('✓ User authenticated, rendering dashboard')
    res.render('dashboard/dashboard', {
        title: 'Dashboard', 
        link: 'dashboard', 
        errors: null,
        user: req.user,
        apiBaseUrl: process.env.REACT_APP_API_URL
    })
}

module.exports = baseController