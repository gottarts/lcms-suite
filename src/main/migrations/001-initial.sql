CREATE TABLE IF NOT EXISTS strumenti (
  id          TEXT PRIMARY KEY,
  codice      TEXT NOT NULL,
  tipo        TEXT,
  seriale     TEXT,
  status      TEXT DEFAULT 'off',
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metodi (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  strumento_id    TEXT REFERENCES strumenti(id),
  matrice         TEXT,
  colonna         TEXT,
  fase_a          TEXT,
  fase_b          TEXT,
  gradiente       TEXT,
  flusso          TEXT,
  ionizzazione    TEXT,
  polarita        TEXT,
  acquisizione    TEXT,
  srm             TEXT,
  lims_id         TEXT,
  oqlab_id        TEXT,
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS composti (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                TEXT NOT NULL,
  codice_interno      TEXT,
  formula             TEXT,
  classe              TEXT,
  forma               TEXT,
  forma_commerciale   TEXT,
  purezza             REAL,
  concentrazione      REAL,
  solvente            TEXT,
  fiala               TEXT,
  produttore          TEXT,
  lotto               TEXT,
  operatore_apertura  TEXT,
  data_apertura       TEXT,
  scadenza_prodotto   TEXT,
  data_dismissione    TEXT,
  destinazione_uso    TEXT,
  work_standard       TEXT,
  matrice             TEXT,
  peso_molecolare     REAL,
  ubicazione          TEXT,
  arpa                TEXT DEFAULT 'N',
  mix                 TEXT,
  mix_id              TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS composti_metodi (
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  metodo_id     TEXT    REFERENCES metodi(id)   ON DELETE CASCADE,
  PRIMARY KEY (composto_id, metodo_id)
);

CREATE TABLE IF NOT EXISTS composti_storia (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  data          TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS preparazioni (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  composto_id   INTEGER REFERENCES composti(id) ON DELETE CASCADE,
  flacone       TEXT,
  concentrazione TEXT,
  solvente      TEXT,
  data_prep     TEXT,
  scadenza      TEXT,
  operatore     TEXT,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eluenti (
  id              TEXT PRIMARY KEY,
  strumento_id    TEXT REFERENCES strumenti(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  data_inizio     TEXT NOT NULL,
  data_fine       TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eluenti_componenti (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  eluente_id    TEXT REFERENCES eluenti(id) ON DELETE CASCADE,
  sostanza      TEXT,
  lotto         TEXT,
  fornitore     TEXT
);

CREATE TABLE IF NOT EXISTS consumabili (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo            TEXT NOT NULL,
  nome            TEXT NOT NULL,
  lotto           TEXT,
  fornitore       TEXT,
  data_apertura   TEXT,
  data_chiusura   TEXT,
  note            TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consumabili_metodi (
  consumabile_id  INTEGER REFERENCES consumabili(id) ON DELETE CASCADE,
  metodo_id       TEXT    REFERENCES metodi(id)      ON DELETE CASCADE,
  PRIMARY KEY (consumabile_id, metodo_id)
);

CREATE TABLE IF NOT EXISTS diario (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  strumento_id    TEXT REFERENCES strumenti(id) ON DELETE CASCADE,
  metodo_id       TEXT REFERENCES metodi(id),
  data            TEXT NOT NULL,
  autore          TEXT,
  testo           TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anagrafiche (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nome    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anagrafiche_voci (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  anagrafica_id   INTEGER REFERENCES anagrafiche(id) ON DELETE CASCADE,
  valore          TEXT NOT NULL,
  UNIQUE(anagrafica_id, valore)
);
