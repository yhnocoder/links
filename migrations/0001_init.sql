-- Every table is the same shape: a row id, the client's edit time (newer wins), a tombstone,
-- the server revision it was last written in (for "what changed since"), and the row itself as JSON.
CREATE TABLE meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
INSERT INTO meta (k, v) VALUES ('rev', 0);

CREATE TABLE links  (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL, url TEXT, data TEXT NOT NULL);
CREATE TABLE boards (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE frames (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE blocks (id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL, data TEXT NOT NULL);

CREATE INDEX links_rev ON links (rev);
CREATE INDEX links_url ON links (url);
CREATE INDEX boards_rev ON boards (rev);
CREATE INDEX frames_rev ON frames (rev);
CREATE INDEX blocks_rev ON blocks (rev);
