const Database = require('better-sqlite3');
const db = new Database('memory/vadjanix.db');

console.log("Migrating causal_graph table...");
db.exec(`
  CREATE TABLE causal_graph_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cause TEXT NOT NULL,
    effect TEXT NOT NULL,
    probability REAL NOT NULL,
    conditions TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    evidence TEXT NOT NULL,
    verified INTEGER DEFAULT 0
  );
`);
try {
  db.exec(`
    INSERT INTO causal_graph_new (id, cause, effect, probability, conditions, mechanism, evidence, verified)
    SELECT id, cause, effect, probability, conditions, mechanism, evidence_episodes, verified
    FROM causal_graph;
  `);
} catch (e) {
  console.log("Causal graph migration: starting fresh.");
}
db.exec("DROP TABLE causal_graph;");
db.exec("ALTER TABLE causal_graph_new RENAME TO causal_graph;");

console.log("Migrating procedural table...");
db.exec(`
  CREATE TABLE procedural_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condition_text TEXT NOT NULL,
    action_text TEXT NOT NULL,
    source TEXT NOT NULL,
    success_rate REAL DEFAULT 0.5,
    version INTEGER DEFAULT 1
  );
`);
try {
  db.exec(`
    INSERT INTO procedural_new (id, condition_text, action_text, source, success_rate, version)
    SELECT id, condition_text, action_text, source, success_rate, version
    FROM procedural;
  `);
} catch (e) {
  console.log("Procedural migration: starting fresh.");
}
db.exec("DROP TABLE procedural;");
db.exec("ALTER TABLE procedural_new RENAME TO procedural;");

console.log("Migration complete.");
db.close();
