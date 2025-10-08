import Database from "better-sqlite3";
const db = new Database("bridge.db");

db.exec(`
CREATE TABLE IF NOT EXISTS mappings (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  target TEXT NOT NULL,
  target_event_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_map_pair ON mappings(source, source_event_id);
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT);
`);

export function getState(key) {
  const row = db.prepare("SELECT value FROM state WHERE key = ?").get(key);
  return row ? row.value : null;
}
export function setState(key, value) {
  db.prepare(
    "INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}
export function getMapping(source, sourceEventId) {
  return db
    .prepare("SELECT * FROM mappings WHERE source=? AND source_event_id=?")
    .get(source, sourceEventId);
}
export function upsertMapping({
  source,
  source_event_id,
  target,
  target_event_id,
  updated_at,
}) {
  db.prepare(
    `INSERT INTO mappings(source,source_event_id,target,target_event_id,updated_at)
     VALUES(@source,@source_event_id,@target,@target_event_id,@updated_at)
     ON CONFLICT(source,source_event_id)
     DO UPDATE SET target_event_id=excluded.target_event_id,updated_at=excluded.updated_at`
  ).run({ source, source_event_id, target, target_event_id, updated_at });
}
export default db;
