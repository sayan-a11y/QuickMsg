const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const apiController = require('../controllers/apiController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname);
    }
});
const upload = multer({ storage });
const db = require('../models/database');

// Auth routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.getMe);

// API routes
router.get('/users', authMiddleware, apiController.getUsers);
router.get('/search', authMiddleware, apiController.searchUser);
router.get('/messages', authMiddleware, apiController.getMessages);
router.post('/send', authMiddleware, apiController.sendMessage);
router.get('/chats', authMiddleware, apiController.getRecentChats);
router.get('/unread', authMiddleware, apiController.getUnreadCounts);
router.post('/seen', authMiddleware, apiController.markAsSeen);
router.post('/delete-everyone', authMiddleware, apiController.deleteForEveryone);
router.post('/delete-me', authMiddleware, apiController.deleteForMe);
router.post('/edit', authMiddleware, apiController.editMessage);
router.post('/star', authMiddleware, apiController.starMessage);
router.post('/delivered', authMiddleware, apiController.markAsDelivered);
router.post('/story', authMiddleware, apiController.postStory);
router.get('/calls', authMiddleware, apiController.getCalls);
router.post('/call-history', authMiddleware, apiController.postCall);
router.put('/calls/:id', authMiddleware, apiController.updateCall);
router.post('/delete-call', authMiddleware, apiController.deleteCall);
router.post('/clear-chat', authMiddleware, apiController.clearChat);
router.get('/user/:id', authMiddleware, apiController.getUser);

module.exports = router;
