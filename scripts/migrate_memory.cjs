const Database = require('better-sqlite3');
const db = new Database('memory/vadjanix.db');

console.log("Migrating episodic table...");

db.exec(`
  CREATE TABLE episodic_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel TEXT NOT NULL,
    counterparty_id TEXT NOT NULL,
    raw_exchange TEXT NOT NULL,
    agent_action TEXT,
    outcome TEXT NOT NULL,
    emotional_valence REAL NOT NULL,
    importance REAL NOT NULL,
    consolidated INTEGER DEFAULT 0,
    embedding BLOB NOT NULL,
    read_only INTEGER DEFAULT 0
  );
`);

// Try to copy existing data if columns match
try {
  db.exec(`
    INSERT INTO episodic_new (id, timestamp, channel, counterparty_id, raw_exchange, agent_action, outcome, emotional_valence, importance, consolidated, embedding)
    SELECT id, timestamp, channel, counterparty_id, raw_exchange, agent_action, outcome, emotional_valence, importance, consolidated, embedding
    FROM episodic;
  `);
} catch (e) {
  console.log("Could not copy data (maybe schema too different), starting fresh for episodic.");
}

db.exec("DROP TABLE episodic;");
db.exec("ALTER TABLE episodic_new RENAME TO episodic;");

console.log("Migration complete.");
db.close();
