const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const socketIo = require('socket.io');
const apiRoutes = require('./backend/routes/api');
const callsRoutes = require('./backend/routes/calls');
const statusRoutes = require('./backend/routes/status');
const userRoutes = require('./backend/routes/user');
const multer = require('multer');
const authMiddleware = require('./backend/middleware/authMiddleware');
const db = require('./backend/models/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/update-profile', userRoutes); // Mounting at /api/update-profile or similar
app.use('/api/user-profile', userRoutes); // For fetching and other updates

// Auto-delete statuses older than 24h on Server Start
db.run(`DELETE FROM status WHERE time < datetime('now','-1 day')`, (err) => {
    if (err) console.error("Error deleting old statuses", err);
    else console.log("Cleared statuses older than 24 hours.");
});

// Reset all users to offline on Server Start to prevent stale 'online' states
db.run(`UPDATE users SET online = 0`, (err) => {
    if (err) console.error("Error resetting user statuses:", err);
    else console.log("All users set to offline on server start.");
});

app.use("/uploads", express.static("uploads"));

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname);
    }
});
const upload = multer({ storage });

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    res.json({ file: '/uploads/' + req.file.filename, filename: req.file.filename });
});

// Profile Updates (Simplified as per user request)
app.post("/api/avatar", authMiddleware, upload.single("avatar"), (req, res) => {
    res.set("Cache-Control", "no-store");
    const id = req.body.id || req.user.id;
    if (!req.file) return res.status(400).json({ ok: false });
    const file = req.file.filename;
    db.run("UPDATE users SET avatar = ? WHERE id = ?", [file, id], (err) => {
        if (err) return res.status(500).json({ ok: false });
        io.emit('profileUpdate', { userId: id, field: 'avatar', value: file });
        res.json({ ok: true });
    });
});

app.post("/api/about", authMiddleware, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, about } = req.body;
    const userId = id || req.user.id;
    db.run("UPDATE users SET about = ? WHERE id = ?", [about, userId], (err) => {
        if (err) return res.status(500).json({ ok: false });
        io.emit('profileUpdate', { userId: userId, field: 'about', value: about });
        res.json({ ok: true });
    });
});

app.post("/api/name", authMiddleware, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, name } = req.body;
    const userId = id || req.user.id;
    db.run("UPDATE users SET name = ? WHERE id = ?", [name, userId], (err) => {
        if (err) return res.status(500).json({ ok: false });
        io.emit('profileUpdate', { userId: userId, field: 'name', value: name });
        res.json({ ok: true });
    });
});

app.post("/api/phone", authMiddleware, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, phone } = req.body;
    const userId = id || req.user.id;
    db.run("UPDATE users SET phone = ? WHERE id = ?", [phone, userId], (err) => {
        if (err) return res.status(500).json({ ok: false });
        res.json({ ok: true });
    });
});

app.post("/api/links", authMiddleware, (req, res) => {
    res.set("Cache-Control", "no-store");
    const { id, links } = req.body;
    const userId = id || req.user.id;
    db.run("UPDATE users SET links = ? WHERE id = ?", [links, userId], (err) => {
        if (err) return res.status(500).json({ ok: false });
        res.json({ ok: true });
    });
});

// Socket.io for real-time features
const connectedUsers = new Map(); // userId -> Set of socketIds
const socketToUser = new Map(); // socketId -> userId

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register', (userId) => {
        socketToUser.set(socket.id, userId);
        socket.join(userId);

        if (!connectedUsers.has(userId)) {
            connectedUsers.set(userId, new Set());
            db.run(`UPDATE users SET online = 1 WHERE id = ?`, [userId], (err) => {
                if (err) console.error(`DB Error registering user ${userId}:`, err);
                else {
                    console.log(`User ${userId} marked online in DB`);
                    io.emit('user_status', { userId, status: 'online' });
                }
            });
        }
        connectedUsers.get(userId).add(socket.id);
        console.log(`User ${userId} registered with socket ${socket.id}. Total sockets: ${connectedUsers.get(userId).size}`);
    });

    socket.on('disconnect', () => {
        const userId = socketToUser.get(socket.id);
        if (userId && connectedUsers.has(userId)) {
            const userSockets = connectedUsers.get(userId);
            userSockets.delete(socket.id);
            socketToUser.delete(socket.id);

            if (userSockets.size === 0) {
                connectedUsers.delete(userId);
                const now = new Date().toISOString();
                db.run(`UPDATE users SET online = 0, last_seen = ? WHERE id = ?`, [now, userId], (err) => {
                    if (err) console.error(`DB Error disconnecting user ${userId}:`, err);
                    else {
                        console.log(`User ${userId} marked offline in DB`);
                        io.emit('user_status', { userId, status: 'offline', last_seen: now });
                    }
                });
                console.log(`User ${userId} is now completely offline.`);
            } else {
                console.log(`User ${userId} closed one tab. Remaining sockets: ${userSockets.size}`);
            }
        }
        console.log('Socket disconnected:', socket.id);
    });

    socket.on('send_message', (data) => {
        const { to, from, message } = data;
        io.to(to).emit('receive_message', message);
        io.to(to).emit('newMessage', { from });
        // Also notify other tabs of the sender
        socket.to(from).emit('receive_message', message);
    });

    // WebRTC signaling - Send to all of user's devices
    socket.on('callUser', (data) => {
        io.to(data.to).emit('incomingCall', { ...data, fromSocket: socket.id });
    });

    socket.on('acceptCall', (data) => {
        // Here we might want to target the specific device that made the offer, 
        // but for simplicity, io.to(data.to) works for all tabs.
        io.to(data.to).emit('callAccepted', data);
    });

    socket.on('rejectCall', (data) => {
        io.to(data.to).emit('callRejected', data);
    });

    socket.on('endCall', (data) => {
        io.to(data.to).emit('callEnded', data);
    });

    socket.on('offer', (data) => {
        io.to(data.to).emit('offer', data);
    });

    socket.on('answer', (data) => {
        io.to(data.to).emit('answer', data);
    });

    socket.on('ice', (data) => {
        io.to(data.to).emit('ice', data);
    });

    socket.on('callUpdate', (data) => {
        if (data && data.to) {
            io.to(data.to).emit('callUpdate');
        }
    });

    socket.on('statusUpdate', (data) => {
        socket.broadcast.emit('statusUpdate');
    });

    socket.on('statusDeleted', () => {
        socket.broadcast.emit('statusDeleted');
    });

    socket.on('deleteMessage', (data) => {
        const { to, messageId } = data;
        io.to(to).emit('deleteMessage', { messageId });
    });

    socket.on('typing', (data) => {
        const { to, from } = data;
        io.to(to).emit('user_typing', { from });
    });

    socket.on('stop_typing', (data) => {
        const { to, from } = data;
        io.to(to).emit('user_stop_typing', { from });
    });

    socket.on('edit_message', (data) => {
        const { to, messageId, text } = data;
        io.to(to).emit('message_edited', { messageId, text });
    });

    socket.on('seen_all', (data) => {
        const { to, from } = data;
        // Notify the SENDER that we saw their messages
        io.to(to).emit('messages_seen', { from });
        // Also notify our OWN other tabs to clear badges
        io.to(from).emit('messages_seen_self', { contactId: to });
    });

    socket.on('delivered_update', (data) => {
        const { to, from } = data;
        io.to(to).emit('messages_delivered', { from });
    });
});

// Serve frontend pages (though they can be static-served, let's explicitely route them for routing convenience)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
