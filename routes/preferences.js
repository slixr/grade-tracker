/**
 * routes/preferences.js
 * Single-row settings table backing the Settings tab: theme,
 * display grading system, default semester, TOK grade, and IB core
 * completion used by the IB honors algorithm (Algorithm 7).
 */
const express = require("express");
const router = express.Router();
const db = require("../database/db");
const SCHOOL_PROGRAMS = new Set(["JHS", "SHS_STANDARD", "IBDP"]);
const GRADING_SYSTEMS = new Set(["STANDARD", "IB", "PERCENTAGE"]);
const THEMES = new Set(["dark", "light"]);
const TOK_GRADES = new Set(["A", "B", "C", "D", "E"]);

router.get("/", (req, res) => {
  const prefs = db.prepare("SELECT * FROM preferences WHERE id = 1").get();
  res.json(prefs);
});

router.put("/", (req, res) => {
  const existing = db.prepare("SELECT * FROM preferences WHERE id = 1").get();
  const { theme, grading_system, default_semester, tok_grade, ee_complete, cas_complete, school_program } = req.body;
  if (school_program !== undefined && !SCHOOL_PROGRAMS.has(school_program)) {
    return res.status(400).json({ error: "Choose a valid school awards program" });
  }
  if (grading_system !== undefined && !GRADING_SYSTEMS.has(grading_system)) {
    return res.status(400).json({ error: "Choose a valid grading system" });
  }
  if (theme !== undefined && !THEMES.has(theme)) {
    return res.status(400).json({ error: "Choose a valid theme" });
  }
  if (tok_grade !== undefined && !TOK_GRADES.has(tok_grade)) {
    return res.status(400).json({ error: "Choose a valid TOK grade" });
  }
  for (const flag of [ee_complete, cas_complete]) {
    if (flag !== undefined && flag !== 0 && flag !== 1) {
      return res.status(400).json({ error: "Completion flags must be 0 or 1" });
    }
  }

  db.prepare(
    "UPDATE preferences SET theme = ?, grading_system = ?, default_semester = ?, tok_grade = ?, ee_complete = ?, cas_complete = ?, school_program = ? WHERE id = 1"
  ).run(
    theme ?? existing.theme,
    grading_system ?? existing.grading_system,
    default_semester ?? existing.default_semester,
    tok_grade ?? existing.tok_grade,
    ee_complete ?? existing.ee_complete,
    cas_complete ?? existing.cas_complete,
    school_program ?? existing.school_program
  );

  res.json(db.prepare("SELECT * FROM preferences WHERE id = 1").get());
});

// DELETE /api/preferences/reset -> wipes all user data (Settings > Clear All Data)
const resetAll = db.transaction(() => {
  db.prepare("DELETE FROM grades").run();
  db.prepare("DELETE FROM goals").run();
  db.prepare("DELETE FROM subjects").run();
  db.prepare(
    "UPDATE preferences SET theme='dark', grading_system='STANDARD', default_semester='Semester 1 2025-2026', tok_grade='C', ee_complete=0, cas_complete=0, school_program='SHS_STANDARD' WHERE id = 1"
  ).run();
});

router.delete("/reset", (req, res) => {
  // Runs as one transaction so a failure part-way can't leave half the data deleted.
  resetAll();
  res.status(204).end();
});

module.exports = router;
