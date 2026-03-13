const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../models/database');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname);
    }
});

const upload = multer({ storage });

// Upload status
router.post('/', authMiddleware, upload.single('status_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'File is required' });

    const fileUrl = `/uploads/${req.file.filename}`;
    const type = req.file.mimetype.startsWith('video') ? 'video' : 'photo';
    const caption = req.body.caption || '';

    db.run(`INSERT INTO status (user_id, file, type, caption) VALUES (?, ?, ?, ?)`,
        [req.user.id, fileUrl, type, caption],
        function (err) {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json({ message: 'Status uploaded successfully', id: this.lastID });
        }
    );
});

// Get statuses for user
router.get('/:userId', authMiddleware, (req, res) => {
    // Only users you chatted with
    db.all(`
        SELECT DISTINCT u.id, u.name, u.avatar 
        FROM users u
        JOIN messages m ON (m.sender_id = u.id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = u.id)
        WHERE u.id != ?
    `, [req.user.id, req.user.id, req.user.id], (err, contacts) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        const contactIds = contacts.map(c => c.id);
        contactIds.push(req.user.id); // Add self to view own status

        if (contactIds.length === 0) return res.json({ statuses: [] });

        const placeholders = contactIds.map(() => '?').join(',');

        db.all(`
            SELECT s.*, u.name, u.avatar
            FROM status s
            JOIN users u ON s.user_id = u.id
            WHERE s.user_id IN (${placeholders})
            AND s.time >= datetime('now', '-1 day')
            ORDER BY s.time ASC
        `, contactIds, (err, statuses) => {
            if (err) return res.status(500).json({ message: 'Database error fetching status' });
            res.json({ statuses, contacts });
        });
    });
});

// View Status
router.post('/view', authMiddleware, (req, res) => {
    const { status_id } = req.body;
    db.get('SELECT * FROM status_views WHERE status_id = ? AND viewer_id = ?', [status_id, req.user.id], (err, row) => {
        if (!row) {
            db.run('INSERT INTO status_views (status_id, viewer_id) VALUES (?, ?)', [status_id, req.user.id], (err) => {
                if (err) return res.status(500).json({ message: 'Database error' });
                res.json({ message: 'View recorded' });
            });
        } else {
            res.json({ message: 'Already viewed' });
        }
    });
});

// Get viewers
router.get('/viewers/:statusId', authMiddleware, (req, res) => {
    db.all(`
        SELECT v.*, u.name, u.avatar, u.username
        FROM status_views v
        JOIN users u ON v.viewer_id = u.id
        WHERE v.status_id = ?
    `, [req.params.statusId], (err, viewers) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ viewers });
    });
});

// Reply Status
router.post('/reply', authMiddleware, (req, res) => {
    const { status_id, message, receiver_id } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

    db.run(`INSERT INTO status_reply (status_id, sender_id, message) VALUES (?, ?, ?)`,
        [status_id, req.user.id, message],
        function (err) {
            if (err) return res.status(500).json({ message: 'Database error' });

            const id = uuidv4();
            const replyMsg = `Replying to status: ${message}`;
            db.run(`INSERT INTO messages (id, sender_id, receiver_id, text) VALUES (?, ?, ?, ?)`,
                [id, req.user.id, receiver_id, replyMsg],
                (err) => {
                    res.json({ message: 'Reply sent' });
                }
            );
        }
    );
});

// Delete Status
router.post('/delete', authMiddleware, (req, res) => {
    const { statusId } = req.body;
    if (!statusId) return res.status(400).json({ message: 'statusId is required' });

    // Verify owner
    db.get(`SELECT file, user_id FROM status WHERE id = ?`, [statusId], (err, row) => {
        if (err || !row) return res.status(404).json({ message: 'Status not found' });

        if (row.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Unauthorized to delete this status' });
        }

        const filePath = path.join(__dirname, '../../', row.file);

        // Delete file
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) { console.error('Error deleting status file', e); }
        }

        // Delete from DB (cascade manual simulation as simple approach)
        db.run(`DELETE FROM status_views WHERE status_id = ?`, [statusId]);
        db.run(`DELETE FROM status_reply WHERE status_id = ?`, [statusId]);

        db.run(`DELETE FROM status WHERE id = ?`, [statusId], function (err) {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json({ message: 'Status deleted successfully' });
        });
    });
});

module.exports = router;
