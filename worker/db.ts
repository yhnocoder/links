import { TABLES, type Row, type Snapshot, type Table } from '../shared/types';

/* D1 holds the one true copy. Every table stores the row as JSON next to the few columns we query on. */

type Stored = { id: string; updated_at: number; deleted: number; rev: number; data: string };
const decode = (r: Stored) => JSON.parse(r.data) as Row;

export async function readAll(db: D1Database): Promise<Snapshot & { rev: number }> {
  const [rev, ...rows] = await db.batch([
    db.prepare("SELECT v FROM meta WHERE k = 'rev'"),
    ...TABLES.map(t => db.prepare(`SELECT * FROM ${t} WHERE deleted = 0`)),
  ]);
  const out = { rev: (rev.results[0] as { v: number } | undefined)?.v ?? 0 } as Snapshot & { rev: number };
  TABLES.forEach((t, i) => ((out as any)[t] = (rows[i].results as Stored[]).map(decode)));
  return out;
}

/* everything written after a revision, deletions included, so another device can catch up */
export async function readSince(db: D1Database, since: number): Promise<Snapshot & { rev: number }> {
  const [rev, ...rows] = await db.batch([
    db.prepare("SELECT v FROM meta WHERE k = 'rev'"),
    ...TABLES.map(t => db.prepare(`SELECT * FROM ${t} WHERE rev > ?`).bind(since)),
  ]);
  const out = { rev: (rev.results[0] as { v: number } | undefined)?.v ?? 0 } as Snapshot & { rev: number };
  TABLES.forEach((t, i) => ((out as any)[t] = (rows[i].results as Stored[]).map(decode)));
  return out;
}

/* the newer edit wins, row by row; an older write that arrives late changes nothing */
export async function write(db: D1Database, changes: Partial<Snapshot>): Promise<number> {
  const bump = await db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev' RETURNING v").first<{ v: number }>();
  const rev = bump?.v ?? 0;
  const stmts: D1PreparedStatement[] = [];
  for (const t of TABLES as Table[]) {
    for (const row of (changes[t] || []) as Row[]) {
      const data = JSON.stringify(row), del = row.deleted ? 1 : 0;
      if (t === 'links') {
        stmts.push(db.prepare(`INSERT INTO links (id, updated_at, deleted, rev, url, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev, url = excluded.url, data = excluded.data
          WHERE excluded.updated_at >= links.updated_at`).bind(row.id, row.updatedAt, del, rev, (row as any).url ?? null, data));
      } else {
        stmts.push(db.prepare(`INSERT INTO ${t} (id, updated_at, deleted, rev, data) VALUES (?1, ?2, ?3, ?4, ?5)
          ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, deleted = excluded.deleted, rev = excluded.rev, data = excluded.data
          WHERE excluded.updated_at >= ${t}.updated_at`).bind(row.id, row.updatedAt, del, rev, data));
      }
    }
  }
  /* D1 caps a batch; big imports go through in slices */
  for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  return rev;
}

export async function findByUrl(db: D1Database, url: string) {
  const r = await db.prepare('SELECT data FROM links WHERE url = ? AND deleted = 0 LIMIT 1').bind(url).first<{ data: string }>();
  return r ? JSON.parse(r.data) : null;
}
