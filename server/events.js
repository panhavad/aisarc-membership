import { db, getMember } from './db.js';
import { requireUser, requireStaff } from './auth.js';

const nowIso = () => new Date().toISOString();
const isStaff = (u) => ['admin', 'moderator'].includes(u.role);

const countStmt = () => db.prepare('SELECT COUNT(*) AS n FROM event_participants WHERE event_id = ?');

// Events without an end time are treated as lasting 3 hours.
const endOf = (e) => new Date(e.ends_at || new Date(new Date(e.starts_at).getTime() + 3 * 3600e3));
function phaseOf(e, now = new Date()) {
  if (now < new Date(e.starts_at)) return 'upcoming';
  return now <= endOf(e) ? 'ongoing' : 'past';
}

// Exact Google Maps link if the organiser gave one, otherwise a Maps search for the location text.
const mapLink = (e) => e.map_url || (e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : '');
const MAP_URL = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)([/?][^\s"'<>]*)?$/i;

function eventView(e, user) {
  const joined = countStmt().get(e.id).n;
  const mine = user.member_id
    ? !!db.prepare('SELECT 1 FROM event_participants WHERE event_id = ? AND member_id = ?').get(e.id, user.member_id)
    : false;
  const phase = phaseOf(e);
  return {
    ...e,
    joined_count: joined,
    seats_left: e.seats > 0 ? Math.max(0, e.seats - joined) : null,
    joined: mine,
    phase,
    past: phase === 'past',
    map_link: mapLink(e),
  };
}

function participants(eventId) {
  return db.prepare(`SELECT p.joined_at, m.id AS member_id, m.member_no, m.data FROM event_participants p
    JOIN members m ON m.id = p.member_id WHERE p.event_id = ? ORDER BY p.joined_at`).all(eventId)
    .map((r) => {
      const d = JSON.parse(r.data);
      return { member_id: r.member_id, member_no: r.member_no, name_kh: d.name_kh || '', name_en: d.name_en || '', phone: d.phone || '', photo: d.photo || '', joined_at: r.joined_at };
    });
}

function cleanEvent(body) {
  const title = String(body?.title || '').trim().slice(0, 200);
  const location = String(body?.location || '').trim().slice(0, 300);
  const description = String(body?.description || '').trim().slice(0, 5000);
  const seats = Math.max(0, parseInt(body?.seats, 10) || 0);
  const map_url = String(body?.map_url || '').trim().slice(0, 1000);
  if (map_url && !MAP_URL.test(map_url)) throw new Error('Map link must be a Google Maps link (https://maps.app.goo.gl/… or https://www.google.com/maps/…)');
  const starts = new Date(body?.starts_at);
  const ends = body?.ends_at ? new Date(body.ends_at) : null;
  if (!title) throw new Error('Event name is required');
  if (isNaN(starts)) throw new Error('Start date and time are required');
  if (ends && (isNaN(ends) || ends < starts)) throw new Error('End time must be after the start time');
  return { title, location, map_url: map_url || null, description, seats, starts_at: starts.toISOString(), ends_at: ends ? ends.toISOString() : null };
}

export function registerEvents(app) {
  app.get('/api/events', requireUser, (req, res) => {
    const rows = db.prepare('SELECT * FROM events ORDER BY starts_at').all().map((e) => eventView(e, req.user));
    // On now and upcoming: soonest first; past: most recent first.
    const by = (p) => rows.filter((e) => e.phase === p);
    res.json([...by('ongoing'), ...by('upcoming'), ...by('past').reverse()]);
  });

  app.get('/api/events/:id', requireUser, (req, res) => {
    const e = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(req.params.id));
    if (!e) return res.status(404).json({ error: 'Event not found' });
    const view = eventView(e, req.user);
    // Members see who joined by name; staff also get phone numbers and member numbers.
    const list = participants(e.id);
    view.participants = isStaff(req.user) ? list : list.map(({ name_kh, name_en, member_id }) => ({ name_kh, name_en, member_id }));
    res.json(view);
  });

  app.post('/api/events', requireStaff, (req, res) => {
    try {
      const e = cleanEvent(req.body);
      const r = db.prepare(`INSERT INTO events (title, location, map_url, starts_at, ends_at, description, seats, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(e.title, e.location, e.map_url, e.starts_at, e.ends_at, e.description, e.seats, req.user.username, nowIso(), nowIso());
      res.json({ id: Number(r.lastInsertRowid) });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.put('/api/events/:id', requireStaff, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM events WHERE id = ?').get(id)) return res.status(404).json({ error: 'Event not found' });
    try {
      const e = cleanEvent(req.body);
      const joined = countStmt().get(id).n;
      if (e.seats > 0 && e.seats < joined) throw new Error(`${joined} members already joined – seats cannot be fewer than that`);
      db.prepare('UPDATE events SET title=?, location=?, map_url=?, starts_at=?, ends_at=?, description=?, seats=?, updated_at=? WHERE id=?')
        .run(e.title, e.location, e.map_url, e.starts_at, e.ends_at, e.description, e.seats, nowIso(), id);
      res.json({ id });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/events/:id', requireStaff, (req, res) => {
    db.prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/events/:id/join', requireUser, (req, res) => {
    const id = Number(req.params.id);
    if (!req.user.member_id) return res.status(400).json({ error: 'Only members can join events' });
    const m = getMember(req.user.member_id);
    if (m.status !== 'ACTIVE') return res.status(403).json({ error: 'Only ACTIVE members can join events' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const e = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
      if (!e) throw Object.assign(new Error('Event not found'), { status: 404 });
      if (new Date(e.starts_at) < new Date()) throw new Error('This event has already started');
      const n = countStmt().get(id).n;
      if (e.seats > 0 && n >= e.seats) throw new Error('Sorry, this event is full');
      db.prepare('INSERT OR IGNORE INTO event_participants (event_id, member_id, joined_at) VALUES (?,?,?)').run(id, m.id, nowIso());
      db.exec('COMMIT');
      res.json(eventView(e, req.user));
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  app.delete('/api/events/:id/join', requireUser, (req, res) => {
    const id = Number(req.params.id);
    const e = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!e) return res.status(404).json({ error: 'Event not found' });
    if (new Date(e.starts_at) < new Date()) return res.status(400).json({ error: 'This event has already started' });
    db.prepare('DELETE FROM event_participants WHERE event_id = ? AND member_id = ?').run(id, req.user.member_id ?? 0);
    res.json(eventView(e, req.user));
  });
}
