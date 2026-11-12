import * as XLSX from 'xlsx';
import { db, getMember, getAssociation } from './db.js';
import { requireUser, requireStaff } from './auth.js';
import { audit } from './audit.js';

const nowIso = () => new Date().toISOString();
const isStaff = (u) => ['admin', 'moderator'].includes(u.role);

const countStmt = () => db.prepare('SELECT COUNT(*) AS n FROM event_participants WHERE event_id = ?');

// Events without an end time are treated as lasting 3 hours.
const endOf = (e) => new Date(e.ends_at || new Date(new Date(e.starts_at).getTime() + 3 * 3600e3));
function phaseOf(e, now = new Date()) {
  if (now < new Date(e.starts_at)) return 'upcoming';
  return now <= endOf(e) ? 'ongoing' : 'past';
}
// Registration closes `close_days` days before the start (0 = open until the event starts).
const closesAt = (e) => new Date(new Date(e.starts_at).getTime() - (e.close_days || 0) * 864e5);
const registrationOpen = (e) => new Date() < closesAt(e);

// Exact Google Maps link if the organiser gave one, otherwise a Maps search for the location text.
const mapLink = (e) => e.map_url || (e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : '');
const MAP_URL = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)([/?][^\s"'<>]*)?$/i;
const local = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '');

function eventView(e, user) {
  const joined = countStmt().get(e.id).n;
  const mine = user.member_id
    ? db.prepare('SELECT joined_at, bill, bill_at FROM event_participants WHERE event_id = ? AND member_id = ?').get(e.id, user.member_id)
    : null;
  const phase = phaseOf(e);
  return {
    ...e,
    price: Number(e.price) || 0,
    currency: getAssociation().currency || 'USD',
    joined_count: joined,
    seats_left: e.seats > 0 ? Math.max(0, e.seats - joined) : null,
    joined: !!mine,
    my_bill: mine?.bill || null,
    my_bill_at: mine?.bill_at || null,
    phase,
    past: phase === 'past',
    registration_closes_at: closesAt(e).toISOString(),
    registration_open: registrationOpen(e),
    map_link: mapLink(e),
  };
}

// Details organisers need about each person who joined (staff only).
function participants(eventId) {
  return db.prepare(`SELECT p.joined_at, p.bill, p.bill_at, m.id AS member_id, m.member_no, m.data FROM event_participants p
    JOIN members m ON m.id = p.member_id WHERE p.event_id = ? ORDER BY p.joined_at`).all(eventId)
    .map((r) => {
      const d = JSON.parse(r.data);
      return {
        member_id: r.member_id, member_no: r.member_no, name_kh: d.name_kh || '', name_en: d.name_en || '',
        gender: d.gender || '', workplace: d.workplace || '', training: d.training || '', phone: d.phone || '',
        joined_at: r.joined_at, bill: r.bill || null, bill_at: r.bill_at || null,
      };
    });
}

function cleanEvent(body) {
  const title = String(body?.title || '').trim().slice(0, 200);
  const location = String(body?.location || '').trim().slice(0, 300);
  const description = String(body?.description || '').trim().slice(0, 5000);
  const seats = Math.max(0, parseInt(body?.seats, 10) || 0);
  const price = Math.round(Math.max(0, Number(String(body?.price ?? '').replace(/[^0-9.]/g, '')) || 0) * 100) / 100;
  const closeDays = Math.max(0, Math.min(365, parseInt(body?.close_days, 10) || 0));
  const map_url = String(body?.map_url || '').trim().slice(0, 1000);
  if (map_url && !MAP_URL.test(map_url)) throw new Error('Map link must be a Google Maps link (https://maps.app.goo.gl/… or https://www.google.com/maps/…)');
  const starts = new Date(body?.starts_at);
  const ends = body?.ends_at ? new Date(body.ends_at) : null;
  if (!title) throw new Error('Event name is required');
  if (isNaN(starts)) throw new Error('Start date and time are required');
  if (ends && (isNaN(ends) || ends < starts)) throw new Error('End time must be after the start time');
  return {
    title, location, map_url: map_url || null, description, seats, price, close_days: closeDays,
    starts_at: starts.toISOString(), ends_at: ends ? ends.toISOString() : null,
  };
}

export function registerEvents(app, { storeDataUrl, removeUpload, UserError, sheet, fileLinkCell }) {
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
    // Data minimisation: only staff see who joined; members only see the count.
    view.participants = isStaff(req.user) ? participants(e.id) : [];
    res.json(view);
  });

  // Joiner list as Excel (staff): name, membership no., gender, workplace, training, payment proof.
  app.get('/api/events/:id/export.xlsx', requireStaff, (req, res) => {
    const e = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(req.params.id));
    if (!e) return res.status(404).json({ error: 'Event not found' });
    const list = participants(e.id);
    const paid = Number(e.price) > 0;
    const header = ['No.', 'ឈ្មោះ / Name (Khmer)', 'Name (Latin)', 'លេខសមាជិក / ID', 'ភេទ / Gender', 'អង្គភាព / Place of work',
      'បណ្តុះបណ្តាលបច្ចេកទេស / Technical training', 'ទូរស័ព្ទ / Phone', 'Joined at', 'វិក្កយបត្រ / Payment proof', 'Proof uploaded at'];
    const rows = list.map((p, i) => [i + 1, p.name_kh, p.name_en, p.member_no || '', p.gender, p.workplace, p.training, p.phone,
      local(p.joined_at), fileLinkCell(req, p.bill, 'View bill') || (paid ? 'Not uploaded' : ''), local(p.bill_at)]);
    const info = [['Event', e.title], ['Starts', local(e.starts_at)], ['Location', e.location || ''],
      ['Price', paid ? `${e.price} ${getAssociation().currency || 'USD'}` : 'Free'], ['Joined', list.length],
      ['Payment proofs uploaded', list.filter((p) => p.bill).length], ['Exported', local(nowIso())]];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(header, rows), 'Joiners');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Event');
    audit(req, 'event.export', `event:${e.id}`, { count: list.length });
    const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `event-${e.id}`;
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="aisarc-joiners-${slug}.xlsx"`,
    });
    res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  });

  app.post('/api/events', requireStaff, (req, res) => {
    try {
      const e = cleanEvent(req.body);
      const r = db.prepare(`INSERT INTO events (title, location, map_url, starts_at, ends_at, description, seats, price, close_days, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(e.title, e.location, e.map_url, e.starts_at, e.ends_at, e.description, e.seats, e.price, e.close_days, req.user.username, nowIso(), nowIso());
      audit(req, 'event.create', `event:${r.lastInsertRowid}`);
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
      db.prepare('UPDATE events SET title=?, location=?, map_url=?, starts_at=?, ends_at=?, description=?, seats=?, price=?, close_days=?, updated_at=? WHERE id=?')
        .run(e.title, e.location, e.map_url, e.starts_at, e.ends_at, e.description, e.seats, e.price, e.close_days, nowIso(), id);
      audit(req, 'event.update', `event:${id}`);
      res.json({ id });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/events/:id', requireStaff, (req, res) => {
    const id = Number(req.params.id);
    for (const p of db.prepare('SELECT bill FROM event_participants WHERE event_id = ? AND bill IS NOT NULL').all(id)) removeUpload(p.bill);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    audit(req, 'event.delete', `event:${id}`);
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
      if (!registrationOpen(e)) throw new Error('Registration for this event is closed');
      const n = countStmt().get(id).n;
      if (e.seats > 0 && n >= e.seats) throw new Error('Sorry, this event is full');
      db.prepare('INSERT OR IGNORE INTO event_participants (event_id, member_id, joined_at) VALUES (?,?,?)').run(id, m.id, nowIso());
      db.exec('COMMIT');
      audit(req, 'event.join', `event:${id}`);
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
    const p = db.prepare('SELECT bill FROM event_participants WHERE event_id = ? AND member_id = ?').get(id, req.user.member_id ?? 0);
    if (p?.bill) removeUpload(p.bill);
    db.prepare('DELETE FROM event_participants WHERE event_id = ? AND member_id = ?').run(id, req.user.member_id ?? 0);
    audit(req, 'event.leave', `event:${id}`);
    res.json(eventView(e, req.user));
  });

  // Payment proof (bill / receipt image or PDF) for an event the member joined.
  app.post('/api/events/:id/bill', requireUser, (req, res) => {
    const id = Number(req.params.id);
    const e = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!e) return res.status(404).json({ error: 'Event not found' });
    const p = db.prepare('SELECT bill FROM event_participants WHERE event_id = ? AND member_id = ?').get(id, req.user.member_id ?? 0);
    if (!p) return res.status(403).json({ error: 'Join the event first' });
    if (phaseOf(e) === 'past') return res.status(400).json({ error: 'This event has ended' });
    try {
      const name = storeDataUrl(req.body?.dataUrl, `ev${id}-${req.user.member_id}-bill`, true);
      if (p.bill) removeUpload(p.bill);
      db.prepare('UPDATE event_participants SET bill = ?, bill_at = ? WHERE event_id = ? AND member_id = ?').run(`file:${name}`, nowIso(), id, req.user.member_id);
      audit(req, 'event.bill_upload', `event:${id}`);
      res.json(eventView(e, req.user));
    } catch (err) {
      if (!(err instanceof UserError)) console.error(err);
      res.status(400).json({ error: err instanceof UserError ? err.message : 'Upload failed' });
    }
  });
}
