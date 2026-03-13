const jwt = require('jsonwebtoken');
const SECRET_KEY = 'quickmsg_ultra_secret_key_123'; // In production, use env variables

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
module.exports.SECRET_KEY = SECRET_KEY;
