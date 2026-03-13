const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all("PRAGMA table_info(calls)", (err, rows) => {
        if (err) console.error(err);
        else console.log("Table info for calls:", rows);
    });
});
db.close();
