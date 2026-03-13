const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, apiController.getCalls);
router.get('/:userId', authMiddleware, apiController.getCalls);
router.post('/delete', authMiddleware, apiController.deleteCall);

module.exports = router;
