/**
 * database/db.js
 * ---------------------------------------------------------------
 * Sets up the SQLite connection (via better-sqlite3) and creates the
 * relational schema first designed in Criterion B (Data Structures,
 * Design Phase - Week 2-3):
 *
 *   Subjects  { id, name, gradingSystem, weightings }
 *   Grades    { id, subjectId, assessmentName, score, percentage }
 *   Goals     { id, subjectId, targetGrade, honorsGoal }
 *   Preferences { theme, gradingSystem, displayMode }
 *
 * better-sqlite3 is used (rather than the callback-based `sqlite3`
 * package) because it is synchronous, which keeps the route handlers
 * in routes/*.js simple and avoids callback nesting while the
 * database itself is still a persistent, file-backed, relational
 * SQLite store as specified in Criterion A's Computational Context.
 * ---------------------------------------------------------------
 */

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "gradetracker.db");
const db = new Database(DB_PATH);

// Enforce FK constraints (SQLite has them off by default) so that
// deleting a subject cascades to its grades and goals automatically.
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    year          TEXT NOT NULL DEFAULT '2025-2026',
    semester      TEXT NOT NULL DEFAULT 'Semester 1',
    color         TEXT NOT NULL DEFAULT '#2878A0',
    award_category TEXT NOT NULL DEFAULT 'ACADEMIC',
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS grades (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id        INTEGER NOT NULL,
    assessment_name   TEXT NOT NULL,
    score             REAL,            -- normalized 1-7, NULL until graded
    weight            REAL NOT NULL,   -- fraction 0-1 of subject total
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_type     TEXT NOT NULL CHECK(goal_type IN ('subject_target','honors')),
    subject_id    INTEGER,                    -- used when goal_type = 'subject_target'
    target_grade  REAL,                       -- normalized 1-7, used when goal_type = 'subject_target'
    honors_level  TEXT,                       -- 'Academic Excellence' | 'First Honors' | 'Second Honors'
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS preferences (
    id              INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
    theme           TEXT DEFAULT 'dark',
    grading_system  TEXT DEFAULT 'STANDARD',            -- STANDARD | IB | PERCENTAGE
    default_semester TEXT DEFAULT 'Semester 1 2025-2026',
    tok_grade       TEXT DEFAULT 'C',                   -- used by IB honors algorithm
    ee_complete     INTEGER NOT NULL DEFAULT 0,
    cas_complete    INTEGER NOT NULL DEFAULT 0,
    school_program  TEXT NOT NULL DEFAULT 'SHS_STANDARD'
  );
`);

// Upgrade databases created before year and ungraded-assessment support.
const subjectColumns = db.prepare("PRAGMA table_info(subjects)").all();
if (!subjectColumns.some((column) => column.name === "year")) {
  db.exec("ALTER TABLE subjects ADD COLUMN year TEXT NOT NULL DEFAULT '2025-2026'");
}
if (!subjectColumns.some((column) => column.name === "color")) {
  db.exec("ALTER TABLE subjects ADD COLUMN color TEXT NOT NULL DEFAULT '#2878A0'");
}
if (!subjectColumns.some((column) => column.name === "award_category")) {
  db.exec("ALTER TABLE subjects ADD COLUMN award_category TEXT NOT NULL DEFAULT 'ACADEMIC'");
}
db.prepare("UPDATE subjects SET award_category = 'ACADEMIC' WHERE award_category = 'IB_SUBJECT'").run();
db.prepare("UPDATE subjects SET award_category = 'MUSIC' WHERE award_category = 'MUSIC_ART' AND lower(name) LIKE '%music%'").run();
db.prepare("UPDATE subjects SET award_category = 'ART' WHERE award_category = 'MUSIC_ART' AND lower(name) LIKE '%art%'").run();
const preferenceColumns = db.prepare("PRAGMA table_info(preferences)").all();
if (!preferenceColumns.some((column) => column.name === "ee_complete")) {
  db.exec("ALTER TABLE preferences ADD COLUMN ee_complete INTEGER NOT NULL DEFAULT 0");
}
if (!preferenceColumns.some((column) => column.name === "cas_complete")) {
  db.exec("ALTER TABLE preferences ADD COLUMN cas_complete INTEGER NOT NULL DEFAULT 0");
}
if (!preferenceColumns.some((column) => column.name === "school_program")) {
  db.exec("ALTER TABLE preferences ADD COLUMN school_program TEXT NOT NULL DEFAULT 'SHS_STANDARD'");
}
const legacySubjects = db.prepare("SELECT id, semester FROM subjects").all();
const updateLegacySubject = db.prepare("UPDATE subjects SET semester = ?, year = ? WHERE id = ?");
for (const subject of legacySubjects) {
  const match = subject.semester.match(/^(Semester\s+\d+)\s+(.+)$/i);
  if (match) updateLegacySubject.run(match[1], match[2], subject.id);
}

const gradeColumns = db.prepare("PRAGMA table_info(grades)").all();
if (gradeColumns.find((column) => column.name === "score")?.notnull) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    BEGIN;
    ALTER TABLE grades RENAME TO grades_legacy;
    CREATE TABLE grades (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id        INTEGER NOT NULL,
      assessment_name   TEXT NOT NULL,
      score             REAL,
      weight            REAL NOT NULL,
      created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    INSERT INTO grades (id, subject_id, assessment_name, score, weight, created_at)
      SELECT id, subject_id, assessment_name, score, weight, created_at FROM grades_legacy;
    DROP TABLE grades_legacy;
    COMMIT;
  `);
  db.pragma("foreign_keys = ON");
}

// Seed the single preferences row on first run.
const prefRow = db.prepare("SELECT COUNT(*) AS c FROM preferences").get();
if (prefRow.c === 0) {
  db.prepare(
    "INSERT INTO preferences (id, theme, grading_system, default_semester, tok_grade) VALUES (1, 'dark', 'STANDARD', 'Semester 1 2025-2026', 'C')"
  ).run();
}

module.exports = db;
