import { db } from './db.js';

// Accountability log: who did what with personal data, and when. Stores field NAMES, never values.
db.exec(`
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor_id INTEGER,
    actor TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    ip TEXT
  );
  CREATE INDEX IF NOT EXISTS audit_at ON audit(at);
`);

const insert = db.prepare('INSERT INTO audit (at, actor_id, actor, action, target, detail, ip) VALUES (?,?,?,?,?,?,?)');

export function audit(req, action, target = '', detail = '') {
  const u = req?.user;
  try {
    insert.run(new Date().toISOString(), u?.id ?? null, u?.username ?? (req?.auditActor || null), action,
      String(target ?? ''), typeof detail === 'string' ? detail : JSON.stringify(detail), req?.ip || null);
  } catch (e) {
    console.error('[audit]', e.message);
  }
}

export function listAudit({ q = '', limit = 200, before = null } = {}) {
  const like = `%${String(q).toLowerCase()}%`;
  return db.prepare(`SELECT * FROM audit WHERE (? = '%%' OR lower(action || ' ' || ifnull(actor,'') || ' ' || ifnull(target,'') || ' ' || ifnull(detail,'')) LIKE ?)
    AND (? IS NULL OR id < ?) ORDER BY id DESC LIMIT ?`).all(like, like, before, before, Math.min(500, Number(limit) || 200));
}

export function memberAudit(memberId) {
  return db.prepare("SELECT at, actor, action, detail FROM audit WHERE target = ? ORDER BY id DESC LIMIT 500").all(`member:${memberId}`);
}

// Retention: audit entries are kept for 2 years.
export function purgeAudit(days = 730) {
  const cutoff = new Date(Date.now() - days * 864e5).toISOString();
  return Number(db.prepare('DELETE FROM audit WHERE at < ?').run(cutoff).changes);
}
