const Util = module.exports = {}
// const menuModel = require("../models/menuModel")
const jwt = require('jsonwebtoken')
require("dotenv").config()

/* **************************************
  * Middleware to check token validity
  * Supports: cookies, Authorization header
****************************************/
Util.checkJWTToken = (req, res, next) => {
    let token = null

    // Check for token in cookie (legacy)
    if (req.cookies.jwt) {
        token = req.cookies.jwt
    }
    // Check for token in Authorization header (API requests)
    else if (req.headers.authorization) {
        const authHeader = req.headers.authorization
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7)
        }
    }

    if (token) {
        jwt.verify(
            token,
            process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET,
            function (err, accountData){
                if (err) {
                    console.error('❌ JWT verification error for', req.path, ':', err.message)
                    req.flash('notice','Please Log In')
                    res.clearCookie('jwt')
                    return res.redirect('/login')
                }
                req.user = accountData
                res.locals.accountData = accountData
                res.locals.loggedin = 1
                next()
            })
    } else {
        console.log('⚠ No JWT token found for:', req.path)
        next()
    }
}

  /* **************************************
   * Check Login
  ****************************************/
Util.checkLogin = (req, res, next) => {
    if (res.locals.loggedin) {
    next()
    } else {
        req.flash('error','Permission Denied. You are not authorized to view this page.')
        return res.redirect('/')
    }
}

  /* **************************************
  * Check Authorization
  ****************************************/
Util.checkAuth = (req, res, next) => {
    if (res.locals.accountData.account_type !== 'Client') {
    next()
    } else {
        req.flash('error','Permission Denied. You are not authorized to view this page.')
        return res.redirect('/')
    }
}

  /* **************************************
   * Check Admin
  ****************************************/
Util.checkAdmin = (req, res, next) => {
    if (res.locals.accountData.account_type === 'Admin' || res.locals.accountData.account_type === 'DBA') {
    next()
    } else {
        req.flash('error','Permission Denied. You are not authorized to view this page.')
        return res.redirect('/')
    }
}

/* ****************************************
 * Middleware For Handling Errors
 * Wrap other function in this for 
 * General Error Handling
 **************************************** */
Util.handleErrors = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

module.exports = Util