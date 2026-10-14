/**
 * logic/gradeLogic.js
 * ---------------------------------------------------------------
 * Pure functions implementing the 9 algorithms designed in
 * Criterion C. Each function is labelled with the algorithm number
 * it implements so it can be directly referenced from the
 * Criterion D documentation and demo video.
 *
 * Internal representation: every grade is stored and computed on a
 * normalized 1-7 scale (matching the IB scale used throughout the
 * Criterion C pseudocode). STANDARD (letter) and PERCENTAGE values
 * are only ever converted to/from this scale at the edges (input
 * validation and display), which keeps every downstream algorithm
 * (weighted average, honors evaluation, goal calculation) working
 * off a single consistent number - this is the same normalize/
 * denormalize pattern already described in Algorithms 1 and 2,
 * extended with a third branch for PERCENTAGE to satisfy Success
 * Criterion 8 ("percentage, or the IB 1-7 scale").
 * ---------------------------------------------------------------
 */

const LETTER_TO_NORMALIZED = { "A+": 7, A: 6, "B+": 5, B: 4, C: 3, D: 2, F: 1 };
const NORMALIZED_TO_LETTER = { 7: "A+", 6: "A", 5: "B+", 4: "B", 3: "C", 2: "D", 1: "F" };
const TOK_ORDER = { A: 5, B: 4, C: 3, D: 2, E: 1 };

function round1(n) {
  return Math.round(n * 10) / 10;
}

/** Algorithm 1: GRADE NORMALIZATION ALGORITHM
 *  Converts a grade entered under any supported grading system into
 *  the internal 1-7 normalized scale. */
function normalizeGrade(gradeInput, gradingSystem) {
  if (gradingSystem === "STANDARD") {
    const normalized = LETTER_TO_NORMALIZED[gradeInput];
    if (normalized === undefined) throw new Error(`Unknown letter grade "${gradeInput}"`);
    return normalized;
  } else if (gradingSystem === "IB") {
    return Number(gradeInput);
  } else if (gradingSystem === "PERCENTAGE") {
    // Extension of Algorithm 1: maps 0-100% onto the 1-7 scale.
    const pct = Number(gradeInput);
    return round1(1 + (pct / 100) * 6);
  }
  throw new Error(`Unknown grading system "${gradingSystem}"`);
}

/** Algorithm 2: REVERSE GRADE CONVERSION ALGORITHM
 *  Converts an internal normalized 1-7 grade back into the display
 *  format for the user's chosen grading system. */
function denormalizeGrade(normalizedGrade, gradingSystem) {
  const roundedGrade = round1(normalizedGrade);
  if (gradingSystem === "STANDARD") {
    const rounded = Math.round(roundedGrade);
    const clamped = Math.min(7, Math.max(1, rounded));
    return NORMALIZED_TO_LETTER[clamped];
  } else if (gradingSystem === "IB") {
    return roundedGrade;
  } else if (gradingSystem === "PERCENTAGE") {
    return round1(((roundedGrade - 1) / 6) * 100);
  }
  throw new Error(`Unknown grading system "${gradingSystem}"`);
}

/** Algorithm 3: SUBJECT WEIGHTED AVERAGE ALGORITHM
 *  gradeList: array of { score (1-7), weight (0-1) } */
function subjectWeightedAverage(gradeList) {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const grade of gradeList) {
    if (grade.score === null || grade.score === undefined) continue;
    totalWeightedScore += grade.score * grade.weight;
    totalWeight += grade.weight;
  }
  const average = totalWeight === 0 ? 0 : totalWeightedScore / totalWeight;
  return round1(average);
}

/** Algorithm 4: SEMESTER OVERALL AVERAGE ALGORITHM
 *  subjects: array of { grades: [{score, weight}, ...] } */
function semesterOverallAverage(subjects) {
  let totalAverage = 0;
  let subjectCount = 0;
  for (const subject of subjects) {
    const subjectAverage = subjectWeightedAverage(subject.grades);
    totalAverage += subjectAverage;
    subjectCount += 1;
  }
  const semesterAverage = subjectCount === 0 ? 0 : totalAverage / subjectCount;
  return round1(semesterAverage);
}

/** Algorithm 5: REQUIRED GRADE FOR SUBJECT GOAL ALGORITHM
 *  Returns either a numeric required average (1-7) or a status string. */
function requiredGradeForGoal(targetGrade, gradeList) {
  let currentWeightedScore = 0;
  let currentWeight = 0;
  for (const grade of gradeList) {
    if (grade.score === null || grade.score === undefined) continue;
    currentWeightedScore += grade.score * grade.weight;
    currentWeight += grade.weight;
  }
  const remainingWeight = 1 - currentWeight;
  if (remainingWeight <= 1e-9) {
    return { status: "No remaining assessments" };
  }
  let requiredAverage = (targetGrade - currentWeightedScore) / remainingWeight;
  requiredAverage = round1(requiredAverage);
  if (requiredAverage > 7) {
    return { status: "Target impossible", requiredAverage };
  } else if (requiredAverage <= 1) {
    return { status: "Target already secured", requiredAverage };
  }
  return { status: "ok", requiredAverage };
}

/** Algorithm 6: SEMESTER HONORS EVALUATION ALGORITHM (STANDARD SYSTEM)
 *  subjects: array of numeric averages (1-7 normalized) */
function semesterHonorsStandard(subjectAverages) {
  // With no subjects entered yet, the "no subject below X" checks below
  // are vacuously true, which would otherwise report "Second Honors"
  // with zero data - guard against that boundary case explicitly.
  if (subjectAverages.length === 0) return "No Honors";
  let countA = 0;
  let countAPlus = 0;
  let noLowerThanBPlus = true;
  let noLowerThanA = true;
  for (const avg of subjectAverages) {
    if (avg === null || avg === undefined) {
      noLowerThanBPlus = false;
      noLowerThanA = false;
      continue;
    }
    if (avg >= 6) countA += 1;
    if (avg >= 7) countAPlus += 1;
    if (avg < 5) noLowerThanBPlus = false;
    if (avg < 6) noLowerThanA = false;
  }
  if (countAPlus >= 3 && noLowerThanA) return "Academic Excellence";
  if (countA >= 3 && noLowerThanBPlus) return "First Honors";
  if (noLowerThanBPlus) return "Second Honors";
  return "No Honors";
}

/** Algorithm 7: SEMESTER HONORS EVALUATION ALGORITHM (IBDP SYSTEM)
 *  ibSubjects: array of IB points (0-7 per subject), tokGrade: 'A'-'E' */
function semesterHonorsIB(ibSubjects, tokGrade, eeComplete, casComplete) {
  if (ibSubjects.length !== 6 || ibSubjects.some((grade) => grade === null || grade === undefined) || !eeComplete || !casComplete) return "No Honors";
  const totalPoints = ibSubjects.reduce((sum, g) => sum + g, 0);
  let noLowerThan5 = true;
  let noLowerThan4 = true;
  for (const grade of ibSubjects) {
    if (grade < 5) noLowerThan5 = false;
    if (grade < 4) noLowerThan4 = false;
  }
  const tok = TOK_ORDER[tokGrade] ?? 0;
  if (totalPoints >= 38 && noLowerThan5 && tok >= TOK_ORDER["B"]) return "Academic Excellence";
  if (totalPoints >= 33 && noLowerThan5 && tok >= TOK_ORDER["C"]) return "First Honors";
  if (totalPoints >= 30 && noLowerThan4 && tok >= TOK_ORDER["C"]) return "Second Honors";
  return "No Honors";
}

function honorsGoalProgress(subjectRecords, honorsLevel, schoolProgram, requirements = {}) {
  const criteria = [];
  const reminders = [];
  const addCriterion = (label, current, required, progress) => {
    criteria.push({ label, current, required, progress: Math.min(1, Math.max(0, progress)) });
  };
  const average = (subject) => Number.isFinite(subject.average) ? subject.average : null;
  const category = (subject) => subject.award_category || "ACADEMIC";
  const reminderForFloor = (subject, floorLabel) => {
    const grade = average(subject);
    if (grade === null) reminders.push(`Enter a grade for ${subject.name}; it needs to be ${floorLabel} or higher.`);
    else if (grade < (floorLabel === "A" ? 6 : floorLabel === "B+" ? 5 : floorLabel === "B" ? 4 : Number(floorLabel))) {
      reminders.push(`Raise ${subject.name} to ${floorLabel} or higher.`);
    }
  };
  const meanProgress = () => criteria.length === 0
    ? 0
    : Math.min(99, Math.round(criteria.reduce((total, criterion) => total + criterion.progress, 0) / criteria.length * 100));

  if (schoolProgram === "IBDP") {
    const targets = {
      "Second Honors": { points: 30, floor: 4, tok: "C" },
      "First Honors": { points: 33, floor: 5, tok: "C" },
      "Academic Excellence": { points: 38, floor: 5, tok: "B" },
    };
    const target = targets[honorsLevel];
    if (!target) return { percentComplete: 0, criteria, reminders };
    const ibSubjects = subjectRecords.filter((subject) => category(subject) === "ACADEMIC");
    const peSubjects = subjectRecords.filter((subject) => category(subject) === "PE");
    const otherAcademic = subjectRecords.filter((subject) => !["ACADEMIC", "PE"].includes(category(subject)));
    const completedIB = ibSubjects.filter((subject) => average(subject) !== null).length;
    const points = ibSubjects.reduce((total, subject) => total + (average(subject) || 0), 0);
    const allAcademic = [...ibSubjects, ...otherAcademic];
    const floorMet = allAcademic.filter((subject) => average(subject) !== null && average(subject) >= target.floor).length;
    const peMet = peSubjects.filter((subject) => average(subject) !== null && average(subject) >= 4).length;
    const tokOrder = { A: 5, B: 4, C: 3, D: 2, E: 1 };
    const tokMet = (tokOrder[requirements.tokGrade] || 0) >= tokOrder[target.tok];
    const ibScaleSelected = requirements.gradingSystem === "IB";

    addCriterion("Grade format is IB 1–7", requirements.gradingSystem || "Not set", "IB", ibScaleSelected ? 1 : 0);
    addCriterion("IB subjects entered", String(ibSubjects.length), "6", ibSubjects.length === 6 ? 1 : 0);
    addCriterion("IB subject grades entered", String(completedIB), "6", completedIB / 6);
    addCriterion("IB points", `${round1(points)} points`, `${target.points}+ points`, points / target.points);
    addCriterion(`All academic subjects at IB ${target.floor} or above`, String(floorMet), String(allAcademic.length), allAcademic.length > 0 && floorMet === allAcademic.length ? 1 : allAcademic.length === 0 ? 0 : floorMet / allAcademic.length);
    addCriterion("PE at IB 4 or above", String(peMet), String(Math.max(1, peSubjects.length)), peSubjects.length > 0 ? peMet / peSubjects.length : 0);
    addCriterion(`TOK grade ${target.tok} or above`, requirements.tokGrade || "Not set", target.tok, tokMet ? 1 : 0);
    addCriterion("Extended Essay complete", requirements.eeComplete ? "Complete" : "Incomplete", "Complete", requirements.eeComplete ? 1 : 0);
    addCriterion("CAS complete", requirements.casComplete ? "Complete" : "Incomplete", "Complete", requirements.casComplete ? 1 : 0);
    if (!ibScaleSelected) reminders.unshift("Select IB 1–7 as the grading format before entering IB point grades.");
    if (ibSubjects.length < 6) reminders.push(`Add ${6 - ibSubjects.length} more IB point subject${6 - ibSubjects.length === 1 ? "" : "s"}.`);
    if (ibSubjects.length > 6) reminders.push("Exactly six subjects can count toward IB points; reclassify any extra subject.");
    ibSubjects.filter((subject) => average(subject) === null).forEach((subject) => reminders.push(`Enter an IB grade for ${subject.name}.`));
    if (points < target.points) reminders.push(`Earn at least ${target.points} total IB points; current total is ${round1(points)}.`);
    allAcademic.forEach((subject) => reminderForFloor(subject, String(target.floor)));
    if (peSubjects.length === 0) reminders.push("Add the PE subject and enter its grade.");
    peSubjects.forEach((subject) => reminderForFloor(subject, "4"));
    if (!tokMet) reminders.push(`Reach TOK grade ${target.tok} or higher.`);
    if (!requirements.eeComplete) reminders.push("Complete the Extended Essay.");
    if (!requirements.casComplete) reminders.push("Complete CAS.");
  } else {
    const juniorHigh = schoolProgram === "JHS";
    const academicSubjects = subjectRecords.filter((subject) => juniorHigh
      ? ["ACADEMIC", "OTHER_ACADEMIC"].includes(category(subject))
      : !["PE", "COMPUTER"].includes(category(subject)));
    const peSubjects = subjectRecords.filter((subject) => category(subject) === "PE");
    const computerSubjects = subjectRecords.filter((subject) => category(subject) === "COMPUTER");
    const grades = academicSubjects.map(average);
    const gradeFloor = honorsLevel === "Academic Excellence" ? 6 : 5;
    const countA = grades.filter((grade) => grade !== null && grade >= 6).length;
    const countAPlus = grades.filter((grade) => grade !== null && grade >= 7).length;
    const qualifyingForAll = grades.filter((grade) => grade !== null && grade >= gradeFloor).length;
    const floorProgress = academicSubjects.length === 0 ? 0 : qualifyingForAll / academicSubjects.length;

    if (honorsLevel === "Second Honors") {
      addCriterion("Academic subjects at B+ or above", String(qualifyingForAll), String(academicSubjects.length), floorProgress);
    } else if (honorsLevel === "First Honors") {
      addCriterion("Academic subjects at A or above", String(countA), "3", countA / 3);
      addCriterion("Academic subjects at B+ or above", String(grades.filter((grade) => grade !== null && grade >= 5).length), String(academicSubjects.length), academicSubjects.length === 0 ? 0 : grades.filter((grade) => grade !== null && grade >= 5).length / academicSubjects.length);
    } else if (honorsLevel === "Academic Excellence") {
      addCriterion("Academic subjects at A+", String(countAPlus), "3", countAPlus / 3);
      addCriterion("Academic subjects at A or above", String(qualifyingForAll), String(academicSubjects.length), floorProgress);
    }

    if (juniorHigh) {
      academicSubjects.forEach((subject) => reminderForFloor(subject, honorsLevel === "Academic Excellence" ? "A" : "B+"));
    } else {
      const specialFloors = [
        { name: "PE", subjects: peSubjects },
        { name: "Computer Education", subjects: computerSubjects },
      ];
      for (const special of specialFloors) {
        const met = special.subjects.filter((subject) => average(subject) !== null && average(subject) >= 4).length;
        addCriterion(`${special.name} at B or above`, String(met), String(Math.max(1, special.subjects.length)), special.subjects.length > 0 ? met / special.subjects.length : 0);
        if (special.subjects.length === 0) reminders.push(`Add ${special.name} and enter its grade.`);
        special.subjects.forEach((subject) => reminderForFloor(subject, "B"));
      }
      academicSubjects.forEach((subject) => reminderForFloor(subject, honorsLevel === "Academic Excellence" ? "A" : "B+"));
    }

    if (honorsLevel === "First Honors" && countA < 3) {
      reminders.unshift(`Earn an A or higher in ${3 - countA} more academic subject${3 - countA === 1 ? "" : "s"}.`);
    }
    if (honorsLevel === "Academic Excellence" && countAPlus < 3) {
      reminders.unshift(`Earn an A+ in ${3 - countAPlus} more academic subject${3 - countAPlus === 1 ? "" : "s"}.`);
    }
    if (academicSubjects.length === 0) reminders.push("Add the academic subjects for this term.");
  }

  return { percentComplete: meanProgress(), criteria, reminders };
}

function evaluateAcademicHonors(subjectRecords, schoolProgram, requirements = {}) {
  const category = (subject) => subject.award_category || "ACADEMIC";
  const average = (subject) => Number.isFinite(subject.average) ? subject.average : null;
  if (schoolProgram === "IBDP") {
    if (requirements.gradingSystem !== "IB") return "In progress";
    const ibSubjects = subjectRecords.filter((subject) => category(subject) === "ACADEMIC");
    const peSubjects = subjectRecords.filter((subject) => category(subject) === "PE");
    const otherAcademic = subjectRecords.filter((subject) => !["ACADEMIC", "PE"].includes(category(subject)));
    if (ibSubjects.length < 6 || peSubjects.length === 0 || [...ibSubjects, ...otherAcademic, ...peSubjects].some((subject) => average(subject) === null)) {
      return "In progress";
    }
    if (ibSubjects.length > 6 || otherAcademic.some((subject) => average(subject) < 5) || peSubjects.some((subject) => average(subject) < 4)) {
      return "No Honors";
    }
    return semesterHonorsIB(ibSubjects.map(average), requirements.tokGrade, requirements.eeComplete, requirements.casComplete);
  }

  const juniorHigh = schoolProgram === "JHS";
  const academicSubjects = subjectRecords.filter((subject) => juniorHigh
    ? ["ACADEMIC", "OTHER_ACADEMIC"].includes(category(subject))
    : !["PE", "COMPUTER"].includes(category(subject)));
  if (academicSubjects.length === 0 || academicSubjects.some((subject) => average(subject) === null)) return "In progress";
  if (!juniorHigh) {
    const peSubjects = subjectRecords.filter((subject) => category(subject) === "PE");
    const computerSubjects = subjectRecords.filter((subject) => category(subject) === "COMPUTER");
    if (peSubjects.length === 0 || computerSubjects.length === 0 || [...peSubjects, ...computerSubjects].some((subject) => average(subject) === null)) return "In progress";
    if ([...peSubjects, ...computerSubjects].some((subject) => average(subject) < 4)) return "No Honors";
  }
  return semesterHonorsStandard(academicSubjects.map(average));
}

function semesterNumberFromName(semester) {
  const normalized = String(semester).trim().toLowerCase();
  if (/\b(?:semester\s*(?:1|one|first)|1st\s+semester|first\s+semester)\b/.test(normalized)) return 1;
  if (/\b(?:semester\s*(?:2|two|second)|2nd\s+semester|second\s+semester)\b/.test(normalized)) return 2;
  return null;
}

function subjectAwardRecord(subject) {
  const hasGradedAssessments = subject.grades.some((grade) => grade.score !== null && grade.score !== undefined);
  return {
    ...subject,
    average: hasGradedAssessments ? subjectWeightedAverage(subject.grades) : null,
  };
}

function latestSemesterSubjects(subjects) {
  const groups = new Map();
  for (const subject of subjects) {
    const key = `${subject.year}\u0000${subject.semester}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(subject);
  }
  const latestGroup = [...groups.values()].sort((left, right) => {
    const leftSubject = left[0];
    const rightSubject = right[0];
    const yearOrder = String(leftSubject.year).localeCompare(String(rightSubject.year), undefined, { numeric: true });
    if (yearOrder !== 0) return yearOrder;
    const semesterOrder = (semesterNumberFromName(leftSubject.semester) || 0) -
      (semesterNumberFromName(rightSubject.semester) || 0);
    if (semesterOrder !== 0) return semesterOrder;
    return String(leftSubject.semester).localeCompare(String(rightSubject.semester));
  }).at(-1);
  return latestGroup || [];
}

/** Returns the lower achieved semester level as the yearly honors level. */
function yearlyHonorsLevel(firstSemesterLevel, secondSemesterLevel) {
  const order = {
    "No Honors": 0,
    "Second Honors": 1,
    "First Honors": 2,
    "Academic Excellence": 3,
  };
  if (order[firstSemesterLevel] === undefined || order[secondSemesterLevel] === undefined) {
    return "In progress";
  }
  return order[firstSemesterLevel] <= order[secondSemesterLevel]
    ? firstSemesterLevel
    : secondSemesterLevel;
}

/** Algorithm 8: PROGRESS BAR COLOR ALGORITHM */
function progressBarColor(currentAverage, targetAverage) {
  if (currentAverage >= targetAverage) return "green";
  if (currentAverage >= targetAverage - 0.5) return "yellow";
  return "red";
}

/** Algorithm 9: INPUT VALIDATION ALGORITHM
 *  score and weight arrive already normalized to (1-7) and fraction (0-1)
 *  scale by the caller; currentTotalWeight is the subject's existing
 *  weight total (0-1) before this grade is added. */
function validateInput(score, weightPercent, currentTotalWeight) {
  if (score !== null && (!Number.isFinite(score) || score < 1 || score > 7)) {
    return { valid: false, message: "Invalid grade value" };
  }
  if (!Number.isFinite(weightPercent) || weightPercent <= 0 || weightPercent > 100) {
    return { valid: false, message: "Invalid weight percentage" };
  }
  const weightDecimal = weightPercent / 100;
  // A tiny tolerance absorbs floating-point drift (e.g. 0.1 + 0.2 + 0.7
  // evaluates to 1.0000000000000002), so weights that genuinely total
  // 100% are never rejected.
  if (currentTotalWeight + weightDecimal > 1 + 1e-9) {
    return { valid: false, message: "Error: Assessment percentages cannot exceed 100%." };
  }
  return { valid: true, message: "Valid Input", weightDecimal };
}

module.exports = {
  normalizeGrade,
  denormalizeGrade,
  subjectWeightedAverage,
  semesterOverallAverage,
  requiredGradeForGoal,
  semesterHonorsStandard,
  semesterHonorsIB,
  honorsGoalProgress,
  evaluateAcademicHonors,
  subjectAwardRecord,
  semesterNumberFromName,
  latestSemesterSubjects,
  yearlyHonorsLevel,
  progressBarColor,
  validateInput,
  round1,
};
