const express = require('express');
const pool = require('../database/');
const { verifyToken } = require('../utilities/auth');

const router = express.Router();

// Get current user
router.get('/me', verifyToken, async (req, res) => {
    try {
        const query = 'SELECT user_id, email, name, created_at, last_login FROM users WHERE user_id = $1';
        const result = await pool.query(query, [req.user.user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user profile
router.put('/me', verifyToken, async (req, res) => {
    try {
        const { name } = req.body;

        const query = `
            UPDATE users 
            SET name = COALESCE($1, name)
            WHERE user_id = $2
            RETURNING user_id, email, name, created_at, last_login
        `;
        const result = await pool.query(query, [name, req.user.user_id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
