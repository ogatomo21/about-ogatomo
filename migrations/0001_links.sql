CREATE TABLE links (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE BINARY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  legacy_clicks INTEGER NOT NULL DEFAULT 0 CHECK(legacy_clicks >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  import_fingerprint TEXT
);
CREATE TRIGGER links_slug_immutable BEFORE UPDATE OF slug,id ON links
BEGIN SELECT RAISE(ABORT,'Link identity is immutable'); END;
CREATE TRIGGER links_no_hard_delete BEFORE DELETE ON links
BEGIN SELECT RAISE(ABORT,'Use soft deletion'); END;
