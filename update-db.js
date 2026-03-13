const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run(`ALTER TABLE users ADD COLUMN avatar TEXT;`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
        console.error(err);
    } else {
        console.log("Column 'avatar' added or already exists.");
    }
    db.close();
});
