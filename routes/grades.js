/**
 * routes/grades.js
 * Handles Create / Read / Update / Delete for Grades within a
 * subject. Every incoming grade is run through Algorithm 9 (input
 * validation) and Algorithm 1 (normalization) before being stored,
 * so the database only ever holds valid, normalized 1-7 scores.
 */
const express = require("express");
const router = express.Router();
const db = require("../database/db");
const logic = require("../logic/gradeLogic");

// GET all grades for a subject
router.get("/subject/:subjectId", (req, res) => {
  const grades = db
    .prepare("SELECT * FROM grades WHERE subject_id = ? ORDER BY created_at ASC")
    .all(req.params.subjectId);
  res.json(grades);
});

// POST add a grade to a subject
// body: { assessmentName, gradeInput?, gradingSystem, weightPercent }
router.post("/subject/:subjectId", (req, res) => {
  const { subjectId } = req.params;
  const { assessmentName, gradeInput, gradingSystem, weightPercent } = req.body;

  const subject = db.prepare("SELECT * FROM subjects WHERE id = ?").get(subjectId);
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  if (!assessmentName || !assessmentName.trim()) {
    return res.status(400).json({ error: "Assessment name is required" });
  }

  let normalizedScore = null;
  if (gradeInput !== undefined && gradeInput !== "") {
    try {
      normalizedScore = logic.normalizeGrade(gradeInput, gradingSystem);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  // Algorithm 9: INPUT VALIDATION ALGORITHM
  const existingGrades = db
    .prepare("SELECT weight FROM grades WHERE subject_id = ?")
    .all(subjectId);
  const currentTotalWeight = existingGrades.reduce((sum, g) => sum + g.weight, 0);

  const validation = logic.validateInput(normalizedScore, Number(weightPercent), currentTotalWeight);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const stmt = db.prepare(
    "INSERT INTO grades (subject_id, assessment_name, score, weight) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(subjectId, assessmentName.trim(), normalizedScore, validation.weightDecimal);
  const grade = db.prepare("SELECT * FROM grades WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(grade);
});

// PUT update an assessment's name, grade, or percentage.
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM grades WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Assessment not found" });

  const { assessmentName, gradeInput, gradingSystem, weightPercent } = req.body;
  const nextName = assessmentName === undefined ? existing.assessment_name : assessmentName.trim();
  if (!nextName) return res.status(400).json({ error: "Assessment name is required" });

  let normalizedScore = existing.score;
  if (gradeInput !== undefined) {
    normalizedScore = null;
    if (gradeInput !== "") {
      try {
        normalizedScore = logic.normalizeGrade(gradeInput, gradingSystem);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  }

  const nextWeightPercent = weightPercent === undefined ? existing.weight * 100 : Number(weightPercent);
  const otherGrades = db.prepare("SELECT weight FROM grades WHERE subject_id = ? AND id != ?").all(existing.subject_id, existing.id);
  const currentTotalWeight = otherGrades.reduce((sum, grade) => sum + grade.weight, 0);
  const validation = logic.validateInput(normalizedScore, nextWeightPercent, currentTotalWeight);
  if (!validation.valid) return res.status(400).json({ error: validation.message });

  db.prepare("UPDATE grades SET assessment_name = ?, score = ?, weight = ? WHERE id = ?").run(
    nextName,
    normalizedScore,
    validation.weightDecimal,
    existing.id
  );
  res.json(db.prepare("SELECT * FROM grades WHERE id = ?").get(existing.id));
});

// DELETE a grade
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM grades WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Grade not found" });

  db.prepare("DELETE FROM grades WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
