/**
 * routes/goals.js
 * Handles goals of two kinds (see UML Goal class: targetGrade, honorsGoal):
 *   - "subject_target": a target grade for one specific subject
 *   - "honors": a semester-wide honors level target (Academic Excellence,
 *      First Honors, Second Honors)
 * GET /api/goals returns each goal already enriched with its live
 * progress, computed with Algorithms 5, 6, 7 and 8, so the frontend
 * never has to duplicate calculation logic (Success Criterion:
 * efficiency - single source of truth for computation).
 */
const express = require("express");
const router = express.Router();
const db = require("../database/db");
const logic = require("../logic/gradeLogic");
const HONORS_LEVELS = ["Academic Excellence", "First Honors", "Second Honors"];

function getSubjectsWithGrades() {
  const subjects = db.prepare("SELECT * FROM subjects").all();
  return subjects.map((subject) => {
    const grades = db.prepare("SELECT * FROM grades WHERE subject_id = ?").all(subject.id);
    return { ...subject, grades };
  });
}

// GET all goals with live progress attached
router.get("/", (req, res) => {
  const goals = db.prepare("SELECT * FROM goals ORDER BY created_at ASC").all();
  const subjects = getSubjectsWithGrades();
  const prefs = db.prepare("SELECT * FROM preferences WHERE id = 1").get();

  const enriched = goals.map((goal) => {
    if (goal.goal_type === "subject_target") {
      const subject = subjects.find((s) => s.id === goal.subject_id);
      if (!subject) return { ...goal, error: "Subject no longer exists" };

      // No graded assessments yet means "no average", not an F.
      const hasGrades = subject.grades.some((grade) => grade.score !== null);
      const currentAverage = hasGrades ? logic.subjectWeightedAverage(subject.grades) : null;
      const required = logic.requiredGradeForGoal(goal.target_grade, subject.grades);
      const percentComplete = hasGrades
        ? Math.min(100, Math.round((currentAverage / goal.target_grade) * 100))
        : 0;
      return {
        ...goal,
        subjectName: subject.name,
        currentAverage,
        percentComplete,
        required,
        color: hasGrades ? logic.progressBarColor(currentAverage, goal.target_grade) : "red",
      };
    }

    // goal_type === 'honors'
    // Honors are judged on the latest semester only. A subject with no
    // graded assessments yet has a null average (not 0), so it shows as
    // "In progress" rather than failing the "no subject below X" check.
    const currentSemesterSubjects = logic.latestSemesterSubjects(subjects).map(logic.subjectAwardRecord);
    const awardRequirements = {
      tokGrade: prefs.tok_grade,
      eeComplete: prefs.ee_complete,
      casComplete: prefs.cas_complete,
      gradingSystem: prefs.grading_system,
    };
    const achievedLevel = logic.evaluateAcademicHonors(currentSemesterSubjects, prefs.school_program, awardRequirements);

    // Honors levels are ordered, so achieving a *better* level than the
    // goal (e.g. reaching Academic Excellence when the goal was First
    // Honors) must also count as achieved - a plain string match would
    // incorrectly say "not achieved" in that case.
    const honorsOrder = ["No Honors", "Second Honors", "First Honors", "Academic Excellence"];
    const isAchieved = honorsOrder.indexOf(achievedLevel) >= honorsOrder.indexOf(goal.honors_level);

    const progress = logic.honorsGoalProgress(currentSemesterSubjects, goal.honors_level, prefs.school_program, awardRequirements);
    const percentComplete = isAchieved ? 100 : progress.percentComplete;

    return {
      ...goal,
      achievedLevel,
      isAchieved,
      percentComplete,
      criteria: progress.criteria,
      reminders: progress.reminders,
      color: isAchieved ? "green" : percentComplete >= 50 ? "yellow" : "red",
    };
  });

  res.json(enriched);
});

// POST create a new goal
// body: { goalType, subjectId?, targetGradeInput?, gradingSystem?, honorsLevel? }
router.post("/", (req, res) => {
  const { goalType, subjectId, targetGradeInput, gradingSystem, honorsLevel } = req.body;

  if (goalType === "subject_target") {
    if (!subjectId || targetGradeInput === undefined) {
      return res.status(400).json({ error: "subjectId and targetGradeInput are required" });
    }
    const subject = db.prepare("SELECT id FROM subjects WHERE id = ?").get(subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    const existingGoal = db
      .prepare("SELECT id FROM goals WHERE goal_type = 'subject_target' AND subject_id = ?")
      .get(subjectId);
    if (existingGoal) {
      return res.status(400).json({ error: "This subject already has a target goal. Delete it first to set a new one." });
    }
    if (targetGradeInput === "" || targetGradeInput === null) {
      return res.status(400).json({ error: "Target grade is required" });
    }
    let normalizedTarget;
    try {
      normalizedTarget = logic.normalizeGrade(targetGradeInput, gradingSystem || "STANDARD");
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    // Same range check as Algorithm 9: targets must sit on the 1-7 scale.
    if (!Number.isFinite(normalizedTarget) || normalizedTarget < 1 || normalizedTarget > 7) {
      return res.status(400).json({ error: "Invalid grade value" });
    }
    const stmt = db.prepare(
      "INSERT INTO goals (goal_type, subject_id, target_grade) VALUES ('subject_target', ?, ?)"
    );
    const info = stmt.run(subjectId, normalizedTarget);
    return res.status(201).json(db.prepare("SELECT * FROM goals WHERE id = ?").get(info.lastInsertRowid));
  }

  if (goalType === "honors") {
    if (!HONORS_LEVELS.includes(honorsLevel)) {
      return res.status(400).json({ error: "Choose a valid honors level" });
    }
    const existingGoal = db.prepare("SELECT id FROM goals WHERE goal_type = 'honors' AND honors_level = ?").get(honorsLevel);
    if (existingGoal) return res.status(400).json({ error: "That honors goal is already set." });
    const stmt = db.prepare("INSERT INTO goals (goal_type, honors_level) VALUES ('honors', ?)");
    const info = stmt.run(honorsLevel);
    return res.status(201).json(db.prepare("SELECT * FROM goals WHERE id = ?").get(info.lastInsertRowid));
  }

  res.status(400).json({ error: "goalType must be 'subject_target' or 'honors'" });
});

// DELETE a goal
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM goals WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Goal not found" });
  db.prepare("DELETE FROM goals WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
