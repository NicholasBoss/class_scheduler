const express = require('express');
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');
const usersController = require('../controllers/usersController');
const util = require("../utilities")

const router = express.Router();

// Get current user
router.get('/me', verifyToken, util.handleErrors(usersController.getUser));

// Update user profile
router.put('/me', verifyToken, util.handleErrors(usersController.updateUser));

module.exports = router;
