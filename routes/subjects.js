/**
 * routes/subjects.js
 * Handles Create / Read / Update / Delete for Subjects, matching
 * UML Class Diagram operations Subject.addGrade()/deleteGrade() at
 * the subject-management level (grade-level operations live in
 * routes/grades.js).
 */
const express = require("express");
const router = express.Router();
const db = require("../database/db");
const SUBJECT_COLORS = new Set([
  "#D94F4F", "#D26952", "#E07A37", "#F28E2B", "#C28A23",
  "#E1C542", "#88B84A", "#528A45", "#355E3B", "#28A36A",
  "#188C7A", "#26A6B8", "#2878A0", "#3D93D9", "#697586",
  "#4D65A8", "#8658C7", "#C04AA3", "#B65C77", "#E65386",
]);
const AWARD_CATEGORIES = new Set(["ACADEMIC", "OTHER_ACADEMIC", "PE", "COMPUTER", "MUSIC", "ART", "MUSIC_ART"]);
const CATEGORY_SUBJECT_NAMES = {
  PE: "Physical Education",
  COMPUTER: "Computer Education",
  MUSIC: "Music",
  ART: "Art",
};

// GET all subjects (without grades - lightweight list for the Subjects tab)
router.get("/", (req, res) => {
  const subjects = db.prepare(`
    SELECT subjects.*, COUNT(grades.id) AS assessment_count
    FROM subjects
    LEFT JOIN grades ON grades.subject_id = subjects.id
    GROUP BY subjects.id
    ORDER BY subjects.created_at ASC
  `).all();
  res.json(subjects);
});

// POST create a new subject
router.post("/", (req, res) => {
  const { name, semester, year, color, awardCategory } = req.body;
  const category = awardCategory || "ACADEMIC";
  const subjectName = name?.trim() || CATEGORY_SUBJECT_NAMES[category];
  if (!subjectName) return res.status(400).json({ error: "Subject name is required" });
  if (!semester || !semester.trim() || !year || !year.trim()) {
    return res.status(400).json({ error: "Year and semester are required" });
  }
  if (color !== undefined && !SUBJECT_COLORS.has(color)) {
    return res.status(400).json({ error: "Choose a color from the available palette" });
  }
  if (!AWARD_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Choose a valid academic award category" });
  }
  const stmt = db.prepare("INSERT INTO subjects (name, semester, year, color, award_category) VALUES (?, ?, ?, ?, ?)");
  const info = stmt.run(subjectName, semester.trim(), year.trim(), color || "#2878A0", category);
  const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(subject);
});

// PUT rename / update a subject
router.put("/:id", (req, res) => {
  const { name, semester, year, color, awardCategory } = req.body;
  const existing = db.prepare("SELECT * FROM subjects WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Subject not found" });
  const category = awardCategory || existing.award_category;
  const subjectName = name?.trim() || (awardCategory ? CATEGORY_SUBJECT_NAMES[category] : null) || existing.name;
  if (color !== undefined && !SUBJECT_COLORS.has(color)) {
    return res.status(400).json({ error: "Choose a color from the available palette" });
  }
  if (awardCategory !== undefined && !AWARD_CATEGORIES.has(awardCategory)) {
    return res.status(400).json({ error: "Choose a valid academic award category" });
  }

  db.prepare("UPDATE subjects SET name = ?, semester = ?, year = ?, color = ?, award_category = ? WHERE id = ?").run(
    subjectName,
    semester || existing.semester,
    year || existing.year,
    color || existing.color,
    category,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM subjects WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE a subject (cascades to its grades and subject_target goals)
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM subjects WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Subject not found" });

  db.prepare("DELETE FROM subjects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
