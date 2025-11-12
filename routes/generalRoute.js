// Needed Resources 
const express = require("express")
const router = new express.Router() 
const baseController = require("../controllers/baseController")
const util = require("../utilities")

// Routes

// Default Home Route
router.get("/", util.handleErrors(baseController.buildHome))

// Default Login Route
router.get("/login", util.handleErrors(baseController.buildLogin))

// Privacy Policy Route
router.get("/privacy", util.handleErrors(baseController.buildPrivacy))

// Verification Route
router.get("/verify", util.handleErrors(baseController.verifyGoogle))


// Dashboard Route
router.get("/dashboard", util.handleErrors(baseController.buildDashboard))

// Logout Route
router.get("/logout", (req, res) => {
    // Clear the JWT cookie
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    
    // Redirect to home
    res.redirect("/")
})

// Export
module.exports = router