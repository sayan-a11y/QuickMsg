const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

const getUsers = (req, res) => {
    db.all(`SELECT id, name, username, avatar FROM users WHERE id != ?`, [req.user.id], (err, users) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ users });
    });
};

const searchUser = (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: 'Query is required' });

    db.all(
        `SELECT id, name, username, avatar FROM users WHERE (username LIKE ? OR name LIKE ?) AND id != ?`,
        [`%${query}%`, `%${query}%`, req.user.id],
        (err, users) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json({ users });
        }
    );
};

const getUser = (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id } = req.params;
    db.get(`SELECT id, name, avatar, username, online, last_seen, about, phone, links FROM users WHERE id = ?`, [id || req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ message: 'User not found' });
        res.json({ user });
    });
};

const updateName = (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    db.run(`UPDATE users SET name = ? WHERE id = ?`, [name, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Name updated' });
    });
};

const updateAbout = (req, res) => {
    const { about } = req.body;
    db.run(`UPDATE users SET about = ? WHERE id = ?`, [about, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'About updated' });
    });
};

const updatePhone = (req, res) => {
    const { phone } = req.body;
    db.run(`UPDATE users SET phone = ? WHERE id = ?`, [phone, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Phone updated' });
    });
};

const updateLinks = (req, res) => {
    const { links } = req.body;
    db.run(`UPDATE users SET links = ? WHERE id = ?`, [links, req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Links updated' });
    });
};

const getMessages = (req, res) => {
    const { contactId } = req.query;
    if (!contactId) return res.status(400).json({ message: 'contactId is required' });

    db.all(`
        SELECT m.*, r.text as reply_text, r.sender_id as reply_sender 
        FROM messages m
        LEFT JOIN messages r ON m.reply_to = r.id
        LEFT JOIN deleted_for d ON m.id = d.message_id AND d.user_id = ?
        WHERE d.id IS NULL AND (
            (m.sender_id = ? AND m.receiver_id = ?) OR 
            (m.sender_id = ? AND m.receiver_id = ?)
        )
        ORDER BY m.time ASC`,
        [req.user.id, req.user.id, contactId, contactId, req.user.id],
        (err, messages) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json({ messages });
        }
    );
};

const sendMessage = (req, res) => {
    const { receiverId, text, replyTo, forwarded, file, fileType } = req.body;
    if (!receiverId || (!text && !file)) return res.status(400).json({ message: 'receiverId and text/file are required' });

    const messageId = uuidv4();
    db.run(
        `INSERT INTO messages (id, sender_id, receiver_id, text, file, file_type, seen, reply_to, forwarded) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [messageId, req.user.id, receiverId, text || '', file || null, fileType || null, replyTo || null, forwarded ? 1 : 0],
        function (err) {
            if (err) {
                console.error("Database error in sendMessage:", err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({
                message: {
                    id: messageId,
                    sender_id: req.user.id,
                    receiver_id: receiverId,
                    text: text || '',
                    file: file || null,
                    file_type: fileType || null,
                    seen: 0,
                    reply_to: replyTo || null,
                    forwarded: forwarded ? 1 : 0,
                    time: new Date()
                }
            });
        }
    );
};

const getRecentChats = (req, res) => {
    db.all(`
        SELECT u.id, u.name, u.username, u.avatar, u.online,
               CASE WHEN m.deleted = 1 THEN 'This message was deleted' ELSE m.text END AS lastMessage, 
               m.time AS lastMessageTime,
               m.seen AS lastMessageSeen,
               m.sender_id AS lastMessageSender,
               IFNULL(unread.count, 0) as unreadCount
        FROM users u
        JOIN (
            SELECT 
                CASE 
                    WHEN sender_id = ? THEN receiver_id 
                    ELSE sender_id 
                END AS userId,
                MAX(time) AS maxTime
            FROM messages
            WHERE (sender_id = ? OR receiver_id = ?)
            AND id NOT IN (SELECT message_id FROM deleted_for WHERE user_id = ?)
            GROUP BY userId
        ) last_msgs ON u.id = last_msgs.userId
        JOIN messages m ON 
            ((m.sender_id = ? AND m.receiver_id = u.id) OR (m.sender_id = u.id AND m.receiver_id = ?))
            AND m.time = last_msgs.maxTime
        LEFT JOIN (
            SELECT sender_id, COUNT(*) as count 
            FROM messages 
            WHERE receiver_id = ? AND seen < 2
            GROUP BY sender_id
        ) unread ON u.id = unread.sender_id
        ORDER BY last_msgs.maxTime DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id], (err, chats) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ chats });
    });
};

const markAsSeen = (req, res) => {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ message: 'contactId is required' });

    db.run(`UPDATE messages SET seen = 2 WHERE sender_id = ? AND receiver_id = ? AND seen < 2`, [contactId, req.user.id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Messages marked as seen' });
    });
};

const markAsDelivered = (req, res) => {
    db.run(`UPDATE messages SET seen = 1 WHERE receiver_id = ? AND seen = 0`, [req.user.id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Messages marked as delivered' });
    });
};

const editMessage = (req, res) => {
    const { messageId, text } = req.body;
    db.run(`UPDATE messages SET text = ?, edited = 1 WHERE id = ? AND sender_id = ?`, [text, messageId, req.user.id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (this.changes === 0) return res.status(403).json({ message: 'Not allowed' });
        res.json({ message: 'Message edited' });
    });
};

const starMessage = (req, res) => {
    const { messageId } = req.body;
    db.run(`UPDATE messages SET starred = 1 - starred WHERE id = ? AND (sender_id = ? OR receiver_id = ?)`, [messageId, req.user.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Star toggled' });
    });
};

const getUnreadCounts = (req, res) => {
    db.all(`SELECT sender_id, COUNT(*) as total FROM messages WHERE receiver_id = ? AND seen < 2 GROUP BY sender_id`, [req.user.id], (err, unread) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ unread });
    });
};

const getStories = (req, res) => {
    db.all(`SELECT s.*, u.name, u.username FROM status s JOIN users u ON s.user_id = u.id ORDER BY s.time DESC`, (err, stories) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ stories });
    });
};

const postStory = (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ message: 'Image is required' });

    db.run(`INSERT INTO status (user_id, file) VALUES (?, ?)`, [req.user.id, image], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: "Status posted" });
    });
};

const postCall = (req, res) => {
    const { receiver_id, type, status } = req.body;
    if (!receiver_id || !type) return res.status(400).json({ message: 'receiver_id and type are required' });

    db.run(
        `INSERT INTO calls (caller_id, receiver_id, type, status) VALUES (?, ?, ?, ?)`,
        [req.user.id, receiver_id, type, status || 'outgoing'],
        function (err) {
            if (err) {
                console.error("Database error in postCall:", err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.json({ call: { id: this.lastID, caller_id: req.user.id, receiver_id, type, status: status || 'outgoing', time: new Date() } });
        }
    );
};

const getCalls = (req, res) => {
    const userId = req.user.id;
    console.log("Fetching calls for user:", userId);
    db.all(`
        SELECT c.*, u.name, u.username, u.avatar 
        FROM calls c
        JOIN users u ON (c.caller_id = u.id AND c.caller_id != ?) OR (c.receiver_id = u.id AND c.receiver_id != ?)
        WHERE c.caller_id = ? OR c.receiver_id = ?
        ORDER BY c.time DESC LIMIT 100
    `, [userId, userId, userId, userId], (err, rows) => {
        if (err) {
            console.error("Database error in getCalls:", err);
            return res.status(500).json({ message: 'Database error' });
        }
        console.log(`Found ${rows ? rows.length : 0} calls`);
        const formattedCalls = rows.map(r => ({
            ...r,
            direction: r.caller_id === userId ? 'outgoing' : 'incoming'
        }));

        res.json({ calls: formattedCalls });
    });
};

const updateCall = (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.run(`UPDATE calls SET status = ? WHERE id = ?`, [status, id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Call updated' });
    });
};

const deleteCall = (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM calls WHERE id = ?`, [id], (err) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Call deleted' });
    });
};

const deleteForEveryone = (req, res) => {
    const id = req.body.id;
    if (!id) return res.status(400).json({ message: 'id is required' });

    db.run(`UPDATE messages SET deleted = 1 WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Deleted for everyone' });
    });
};

const deleteForMe = (req, res) => {
    const id = req.body.id;
    if (!id) return res.status(400).json({ message: 'id is required' });

    db.run(`INSERT INTO deleted_for (message_id, user_id) VALUES (?, ?)`, [id, req.user.id], function (err) {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json({ message: 'Deleted for me' });
    });
};

const clearChat = (req, res) => {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ message: 'contactId is required' });

    db.run(
        `DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
        [req.user.id, contactId, contactId, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json({ message: 'Chat cleared' });
        }
    );
};

module.exports = {
    getUsers, searchUser, getMessages, sendMessage, getRecentChats,
    getStories, postStory, postCall, getCalls, updateCall, deleteCall, deleteForEveryone, deleteForMe,
    markAsSeen, markAsDelivered, getUnreadCounts, editMessage, starMessage,
    clearChat, getUser, updateName, updateAbout, updatePhone, updateLinks
};
