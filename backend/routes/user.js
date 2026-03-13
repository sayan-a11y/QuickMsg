const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../models/database');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + "_" + sanitized);
    }
});
const upload = multer({ storage });

router.get('/:id', authMiddleware, apiController.getUser);
router.post('/update-name', authMiddleware, apiController.updateName);
router.post('/update-about', authMiddleware, apiController.updateAbout);
router.post('/update-phone', authMiddleware, apiController.updatePhone);
router.post('/update-links', authMiddleware, apiController.updateLinks);

router.post('/avatar', authMiddleware, upload.single('avatar'), (req, res) => {
    console.log("Avatar upload request received");
    if (!req.file) {
        console.error("No file in request");
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const avatarUrl = '/uploads/' + req.file.filename;
    console.log("Saving avatar URL to DB:", avatarUrl);
    
    db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.user.id], (err) => {
        if (err) {
            console.error("Database error updating avatar:", err);
            return res.status(500).json({ message: 'Database error' });
        }
        console.log("Avatar updated successfully for user:", req.user.id);
        res.json({ message: 'Avatar updated', avatar: avatarUrl });
    });
});

module.exports = router;
