const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    let token = null;

    // Check for token in cookie (from browser)
    if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    // Check for token in Authorization header (from API clients)
    else if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts[0] === 'Bearer' && parts[1]) {
            token = parts[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { verifyToken };
