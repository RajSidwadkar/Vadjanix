const Database = require('better-sqlite3');
const db = new Database('memory/vadjanix.db');
const columns = db.prepare("PRAGMA table_info(episodic)").all();
console.log(JSON.stringify(columns, null, 2));
db.close();
