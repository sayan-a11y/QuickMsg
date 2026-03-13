const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../database/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            about TEXT DEFAULT 'Hey there! I am using QuickMsg.',
            phone TEXT,
            links TEXT,
            online INTEGER DEFAULT 0,
            last_seen DATETIME,
            created DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Migrations for existing users table
            db.run("ALTER TABLE users ADD COLUMN about TEXT DEFAULT 'Hey there! I am using QuickMsg.'", () => { });
            db.run("ALTER TABLE users ADD COLUMN phone TEXT", () => { });
            db.run("ALTER TABLE users ADD COLUMN links TEXT", () => { });
        });

        // Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            text TEXT,
            file TEXT,
            file_type TEXT,
            seen INTEGER DEFAULT 0,
            deleted INTEGER DEFAULT 0,
            edited INTEGER DEFAULT 0,
            reply_to TEXT,
            forwarded INTEGER DEFAULT 0,
            starred INTEGER DEFAULT 0,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )`, () => {
            // Safe alter to add columns to existing table
            db.run("ALTER TABLE messages ADD COLUMN file TEXT", () => { });
            db.run("ALTER TABLE messages ADD COLUMN file_type TEXT", () => { });
        });

        // Deleted for me table
        db.run(`CREATE TABLE IF NOT EXISTS deleted_for (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Status / Stories table
        db.run(`CREATE TABLE IF NOT EXISTS status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            file TEXT,
            type TEXT,
            caption TEXT,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Status Views table
        db.run(`CREATE TABLE IF NOT EXISTS status_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status_id INTEGER NOT NULL,
            viewer_id TEXT NOT NULL,
            FOREIGN KEY (status_id) REFERENCES status(id),
            FOREIGN KEY (viewer_id) REFERENCES users(id)
        )`);

        // Status Reply table
        db.run(`CREATE TABLE IF NOT EXISTS status_reply (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status_id INTEGER NOT NULL,
            sender_id TEXT NOT NULL,
            message TEXT,
            FOREIGN KEY (status_id) REFERENCES status(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        )`);

        // Calls table
        db.run(`CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caller_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            type TEXT, -- voice or video
            status TEXT, -- incoming, outgoing, missed, ended
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (caller_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )`);

        // Notifications table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            title TEXT,
            body TEXT,
            time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
    });
}

module.exports = db;
