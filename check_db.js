const db = require('./backend/models/database');
db.all("SELECT id, name, username, avatar FROM users", [], (err, rows) => {
    if (err) console.error(err);
    console.log(JSON.stringify(rows, null, 2));
    process.exit();
});
