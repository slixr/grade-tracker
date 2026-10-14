/**
 * routes/dashboard.js
 * Single aggregate endpoint for the Dashboard tab. Computing every
 * average, honors level and goal-progress figure here (server-side,
 * in one pass over the data already in memory) rather than in the
 * browser keeps the client thin and avoids recomputing the same
 * weighted averages multiple times across widgets (efficiency,
 * Criterion D testing focus).
 */
const express = require("express");
const router = express.Router();
const db = require("../database/db");
const logic = require("../logic/gradeLogic");

router.get("/", (req, res) => {
  const prefs = db.prepare("SELECT * FROM preferences WHERE id = 1").get();
  const subjects = db.prepare("SELECT * FROM subjects").all();

  const subjectsWithGrades = subjects.map((subject) => ({
    ...subject,
    grades: db.prepare("SELECT * FROM grades WHERE subject_id = ?").all(subject.id),
  }));

  const subjectsWithStats = subjectsWithGrades.map((subject) => {
    const grades = subject.grades;
    const hasGradedAssessments = grades.some((grade) => grade.score !== null);
    const average = hasGradedAssessments ? logic.subjectWeightedAverage(grades) : null;
    return {
      id: subject.id,
      name: subject.name,
      year: subject.year,
      semester: subject.semester,
      color: subject.color,
      award_category: subject.award_category,
      assessmentCount: grades.length,
      average,
      displayAverage: average === null ? null : logic.denormalizeGrade(average, prefs.grading_system),
    };
  });

  // Algorithm 4 averages "each subject's average" together, but a
  // subject with zero assessments entered has no real average yet -
  // counting it as 0 would unfairly crater the overall average the
  // moment a new subject is added. Only subjects with at least one
  // grade feed into the semester-level calculations below.
  // Algorithm 4 is a *semester* average, so it is computed over the
  // latest semester - the same subject set the honors evaluation uses.
  const latestSemester = logic.latestSemesterSubjects(subjectsWithGrades);
  const gradedSubjects = latestSemester
    .filter((subject) => subject.grades.some((grade) => grade.score !== null));

  const overallAverage = logic.semesterOverallAverage(gradedSubjects);

  const awardRequirements = {
    tokGrade: prefs.tok_grade,
    eeComplete: prefs.ee_complete,
    casComplete: prefs.cas_complete,
    gradingSystem: prefs.grading_system,
  };
  const currentSemesterSubjects = latestSemester.map(logic.subjectAwardRecord);
  const currentHonorsLevel = logic.evaluateAcademicHonors(currentSemesterSubjects, prefs.school_program, awardRequirements);

  const years = [...new Set(subjectsWithGrades.map((subject) => subject.year))].sort();
  const yearlyHonors = years.map((year) => {
    const getSemesterHonors = (semesterNumber) => {
      const semesterSubjects = subjectsWithGrades.filter(
        (subject) => subject.year === year && logic.semesterNumberFromName(subject.semester) === semesterNumber
      ).map(logic.subjectAwardRecord);
      return logic.evaluateAcademicHonors(semesterSubjects, prefs.school_program, awardRequirements);
    };

    const firstSemesterHonors = getSemesterHonors(1);
    const secondSemesterHonors = getSemesterHonors(2);
    return {
      year,
      firstSemesterHonors,
      secondSemesterHonors,
      yearlyHonors: logic.yearlyHonorsLevel(firstSemesterHonors, secondSemesterHonors),
    };
  });

  const goals = db.prepare("SELECT * FROM goals").all();
  const honorsOrder = ["No Honors", "Second Honors", "First Honors", "Academic Excellence"];
  let onTrackCount = 0;
  for (const goal of goals) {
    if (goal.goal_type === "subject_target") {
      const subject = subjectsWithStats.find((s) => s.id === goal.subject_id);
      if (subject && subject.average !== null && subject.average >= goal.target_grade) onTrackCount += 1;
    } else if (goal.goal_type === "honors") {
      if (honorsOrder.indexOf(currentHonorsLevel) >= honorsOrder.indexOf(goal.honors_level)) onTrackCount += 1;
    }
  }

  res.json({
    overallAverage,
    displayOverallAverage: gradedSubjects.length === 0 ? null : logic.denormalizeGrade(overallAverage, prefs.grading_system),
    totalSubjects: subjects.length,
    currentHonorsLevel,
    currentSemesterLabel: latestSemester.length ? `${latestSemester[0].semester} ${latestSemester[0].year}` : null,
    yearlyHonors,
    goalsOnTrack: onTrackCount,
    totalGoals: goals.length,
    subjects: subjectsWithStats,
    gradingSystem: prefs.grading_system,
  });
});

module.exports = router;
