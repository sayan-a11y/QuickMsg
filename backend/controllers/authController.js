const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const { SECRET_KEY } = require('../middleware/authMiddleware');

const signup = (req, res) => {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userId = uuidv4();

    db.run(
        `INSERT INTO users (id, name, username, email, password) VALUES (?, ?, ?, ?, ?)`,
        [userId, name, username, email, hashedPassword],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Username or email already exists' });
                }
                return res.status(500).json({ message: 'Internal server error during user creation' });
            }

            const token = jwt.sign({ id: userId, username, name }, SECRET_KEY, { expiresIn: '7d' });
            res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
            res.status(201).json({ message: 'User created successfully', user: { id: userId, name, username, email } });
        }
    );
};

const login = (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET_KEY, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ message: 'Logged in successfully', user: { id: user.id, name: user.name, username: user.username, email: user.email } });
    });
};

const logout = (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
};

const getMe = (req, res) => {
    // Current authenticated user (from token)
    db.get('SELECT id, name, username, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    });
};

module.exports = { signup, login, logout, getMe };
