/* ******************************************
 * This server.js file is the primary file of the 
 * application. It is used to control the project.
 *******************************************/
/* ***********************
 * Require Statements
 *************************/
const express = require("express")
const expressLayouts = require("express-ejs-layouts")
const env = require("dotenv").config()
const app = express()
const static = require("./routes/static")
const utilities = require("./utilities/")
const session = require("express-session")
const pool = require("./database/")
const generalRoute = require("./routes/generalRoute")
// const ordersRoute = require("./routes/ordersRoute")
// const contactRoute = require("./routes/messageRoute")
// const accountRoute = require("./routes/accountRoute")
// const aboutRoute = require("./routes/aboutRoute")
// const menuRoute = require("./routes/menuRoute")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const cors = require("cors")

/* ***********************
 * API Routes
*************************/
const authRoute = require("./routes/authRoute")
const eventsRoute = require("./routes/eventsRoute")
const usersRoute = require("./routes/usersRoute")

/* ***********************
 * Middleware
 *************************/
app.use(cors())

app.use(session({
    store: new (require("connect-pg-simple")(session))({
      createTableIfMissing: true,
      pool,
    }),
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    name: 'sessionId',
  }))

// Express Messages Middleware
app.use(require("connect-flash")())
app.use(function(req, res, next){
  res.locals.messages = require("express-messages")(req, res)
  next()
})

// Body Parser Middleware
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true})) // for parsing application/x-www-form-urlencoded

// Cookie Parser Middleware
app.use(cookieParser())

// Check token
app.use(utilities.checkJWTToken)

/* ***********************
 * View Engine and Templates
 *************************/
app.set("view engine", "ejs")
app.use(expressLayouts)
app.set("layout", "./layouts/layout") // not at views root

/* ***********************
 * Routes
 *************************/
app.use(static)

// General Routes (home, login, dashboard, logout)
app.use(generalRoute)

// API Routes
app.use("/api/auth", authRoute)
app.use("/api/events", eventsRoute)
app.use("/api/users", usersRoute)

// // Contact Route
// app.use("/contact", contactRoute)

// Account Route
// app.use("/account", accountRoute)

// About Route
// app.get("/about", generalRoute)

// Orders Route
// app.use("/orders", ordersRoute)

// // Menu Route
// app.use("/menu", menuRoute)

// File Not Found Route - must be last route in list
app.use(async (req, res, next) => {
    next({status: 404, message: 'Oh No! You found our secret vacation plans.'})
  })
  

/* ***********************
* Express Error Handler
* Place after all other middleware
*************************/
app.use(async (err, req, res, next) => {
    // Don't try to send a response if headers have already been sent
    if (res.headersSent) {
        console.error(`Response already sent for ${req.originalUrl}, suppressing error:`, err.message)
        return
    }

    console.error(`Error at: "${req.originalUrl}": ${err.message}`)
    console.error(err.stack)
    
    const message = (err.status == 404) ? err.message : 'Oh no! There was a crash. Maybe try a different route?'
    
    try {
        res.render("errors/error", {
          title: err.status || 'Server Error',
          link: err.link || '/',
          message,
        })
    } catch (renderErr) {
        console.error('Error rendering error page:', renderErr.message)
        res.status(err.status || 500).send(message)
    }
  })

/* ***********************
 * Local Server Information
 * Values from .env (environment) file
 *************************/
const port = process.env.PORT
const host = process.env.HOST

/* ***********************
 * Log statement to confirm server operation
 *************************/
app.listen(port, () => {
  console.log(`app listening on http://${host}:${port}`)
})