/**
 * public/js/subjects.js
 * Subjects tab. Shows the subject grid (Figma "Subjects Tab" mockup)
 * and, when a card is clicked, a modal with that subject's grades
 * table - Assessment / Grade / Weight / Weighted Contribution /
 * Actions, exactly as specified - where assessments can be added or
 * removed. Every weighted average shown here comes from Algorithm 3
 * running on the live grade list, never a stored/cached number.
 */

let subjectsCache = [];
const subjectPredictionTargets = {};
const SUBJECT_COLORS = [
  ["Coral", "#D26952"],
  ["Burnt orange", "#E07A37"],
  ["Amber", "#C28A23"],
  ["Green", "#528A45"],
  ["Forest green", "#355E3B"],
  ["Teal", "#188C7A"],
  ["Ocean blue", "#2878A0"],
  ["Indigo", "#4D65A8"],
  ["Rose", "#B65C77"],
  ["Slate", "#697586"],
];
const CATEGORY_SUBJECT_NAMES = {
  PE: "Physical Education",
  COMPUTER: "Computer Education",
  MUSIC: "Music",
  ART: "Art",
};

function subjectColorPicker(selectedColor, inputId) {
  return `<div class="subject-color-options" role="radiogroup" aria-label="Subject color">
    ${SUBJECT_COLORS.map(([name, color]) => `<button type="button" class="color-swatch${color === selectedColor ? " selected" : ""}" data-color="${color}" role="radio" aria-checked="${color === selectedColor}" aria-label="${name}" title="${name}" style="--swatch-color:${color}"></button>`).join("")}
    <input type="hidden" id="${inputId}" value="${selectedColor}" />
  </div>`;
}

function awardCategorySelect(selectedCategory, inputId) {
  const schoolProgram = AppState.preferences.school_program;
  const labels = {
    ACADEMIC: schoolProgram === "IBDP" ? "IB subject" : "Academic subject",
    OTHER_ACADEMIC: schoolProgram === "IBDP" ? "Other academic (modular Filipino/Chinese/CLE)" : "Other academic subject",
    PE: "Physical Education",
    COMPUTER: "Computer Education",
    MUSIC: "Music",
    ART: "Art",
    MUSIC_ART: "Music or Art",
  };
  const profileCategories = {
    JHS: ["ACADEMIC", "PE", "COMPUTER", "MUSIC", "ART"],
    SHS_STANDARD: ["ACADEMIC", "PE", "COMPUTER"],
    IBDP: ["ACADEMIC", "OTHER_ACADEMIC", "PE"],
  };
  const categoryValues = profileCategories[schoolProgram] || profileCategories.SHS_STANDARD;
  if (selectedCategory && !categoryValues.includes(selectedCategory)) categoryValues.push(selectedCategory);
  const categories = categoryValues.map((value) => [value, labels[value] || value]);
  return `<select id="${inputId}">${categories.map(([value, label]) => `<option value="${value}"${value === selectedCategory ? " selected" : ""}>${label}</option>`).join("")}</select>`;
}

function syncCategorySubjectName(categorySelect, nameInput) {
  const generatedName = CATEGORY_SUBJECT_NAMES[categorySelect.value];
  if (generatedName) {
    nameInput.value = generatedName;
    nameInput.readOnly = true;
    nameInput.dataset.categoryGeneratedName = generatedName;
    return;
  }
  if (nameInput.value === nameInput.dataset.categoryGeneratedName) nameInput.value = "";
  nameInput.readOnly = false;
  delete nameInput.dataset.categoryGeneratedName;
}

function awardCategoryHint() {
  const hints = {
    JHS: "Use Music, Art, PE, or Computer Education only for those subjects; other subjects are Academic.",
    SHS_STANDARD: "Use only Academic, PE, and Computer Education. PE and Computer Education require B; all other subjects are Academic.",
    IBDP: "Mark six subjects as IB subject. Use Other academic for modular Filipino/Chinese, CLE, or other grades outside the six-subject points total; use PE for Physical Education.",
  };
  return hints[AppState.preferences.school_program] || "Classify the subject according to its role in your school's academic award rules.";
}

async function renderSubjects() {
  try {
    subjectsCache = await api.getSubjects();
  } catch (err) {
    showToast(err.message, true);
    return;
  }

  const grid = document.getElementById("subjects-grid");
  if (subjectsCache.length === 0) {
    grid.innerHTML = '<p class="empty-state">No subjects yet. Click "+ Add Subject" to create your first one.</p>';
    return;
  }

  grid.innerHTML = subjectsCache
    .map(
      (s) => `
      <div class="subject-card" data-id="${s.id}" style="--subject-color:${s.color}">
        <div class="subject-card-top">
          <div>
            <h4>${escapeHtml(s.name)}</h4>
            <p class="subtext">${escapeHtml(s.year)} · ${escapeHtml(s.semester)}</p>
          </div>
          <button class="icon-btn btn-delete-subject" data-id="${s.id}" title="Delete subject">${icon("trash")}</button>
        </div>
        <div class="subject-card-footer">
          <span>Assessments</span>
          <strong>${s.assessment_count}</strong>
        </div>
      </div>`
    )
    .join("");

  // Open detail modal when a card (but not its delete icon) is clicked.
  grid.querySelectorAll(".subject-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-delete-subject")) return;
      openSubjectDetail(Number(card.dataset.id));
    });
  });

  // Delete subject (with confirmation, per spec).
  grid.querySelectorAll(".btn-delete-subject").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const subject = subjectsCache.find((s) => s.id === id);
      if (!confirm(`Delete "${subject.name}" and all its assessments? This cannot be undone.`)) return;
      try {
        await api.deleteSubject(id);
        showToast("Subject deleted");
        renderSubjects();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

document.getElementById("btn-add-subject").addEventListener("click", () => {
  const defaultTerm = (AppState.preferences.default_semester || "Semester 1 2025-2026").match(/^(Semester\s+\d+)\s+(.+)$/i);
  const defaultSemester = defaultTerm ? defaultTerm[1] : "Semester 1";
  const defaultYear = defaultTerm ? defaultTerm[2] : "2025-2026";
  const defaultCategory = "ACADEMIC";
  openModal(`
    <h3>Add Subject</h3>
    <p class="subtext">e.g. Mathematics, English, Physics</p>
    <label for="input-subject-name">Subject Name</label>
    <input type="text" id="input-subject-name" placeholder="Subject name" />
    <label for="input-subject-semester">Semester</label>
    <input type="text" id="input-subject-semester" value="${escapeHtml(defaultSemester)}" placeholder="Semester 1" />
    <label for="input-subject-year">Year</label>
    <input type="text" id="input-subject-year" value="${escapeHtml(defaultYear)}" placeholder="2025-2026" />
    <label for="input-subject-award-category">Academic category</label>
    ${awardCategorySelect(defaultCategory, "input-subject-award-category")}
    <p class="hint">${awardCategoryHint()}</p>
    <label>Subject color</label>
    ${subjectColorPicker(SUBJECT_COLORS[0][1], "subject-color")}
    <div class="field-error" id="add-subject-error"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-subject">Cancel</button>
      <button class="btn-primary" id="btn-save-subject">Add Subject</button>
    </div>
  `);
  bindSubjectColorPicker("subject-color");
  const categorySelect = document.getElementById("input-subject-award-category");
  const subjectNameInput = document.getElementById("input-subject-name");
  categorySelect.addEventListener("change", () => syncCategorySubjectName(categorySelect, subjectNameInput));
  syncCategorySubjectName(categorySelect, subjectNameInput);
  document.getElementById("btn-cancel-subject").addEventListener("click", closeModal);
  document.getElementById("btn-save-subject").addEventListener("click", async () => {
    const name = document.getElementById("input-subject-name").value.trim();
    const semester = document.getElementById("input-subject-semester").value.trim();
    const year = document.getElementById("input-subject-year").value.trim();
    const awardCategory = document.getElementById("input-subject-award-category").value;
    const color = document.getElementById("subject-color").value;
    if (!name) {
      document.getElementById("add-subject-error").textContent = "Subject name is required.";
      return;
    }
    if (!semester || !year) {
      document.getElementById("add-subject-error").textContent = "Year and semester are required.";
      return;
    }
    try {
      await api.addSubject(name, semester, year, color, awardCategory);
      closeModal();
      showToast("Subject added");
      renderSubjects();
    } catch (err) {
      document.getElementById("add-subject-error").textContent = err.message;
    }
  });
});

// ---------- Subject detail modal (grades table) ----------
async function openSubjectDetail(subjectId) {
  const subject = subjectsCache.find((s) => s.id === subjectId);
  if (!subject) return;
  renderSubjectDetailModal(subjectId);
}

async function renderSubjectDetailModal(subjectId) {
  let grades;
  try {
    grades = await api.getGradesForSubject(subjectId);
  } catch (err) {
    showToast(err.message, true);
    return;
  }
  const subject = subjectsCache.find((s) => s.id === subjectId);
  const gradingSystem = AppState.preferences.grading_system;
  const savedTarget = subjectPredictionTargets[subjectId] ?? "";
  const average = subjectWeightedAverageClient(grades);
  const gradedWeight = grades.reduce((sum, g) => sum + (g.score === null ? 0 : g.weight), 0);
  const earnedContribution = grades.reduce((sum, g) => sum + (g.score === null ? 0 : g.score * g.weight), 0);
  const remainingWeight = Math.max(0, 1 - gradedWeight);

  const rows = grades
    .map((g) => {
      const contribution = g.score === null ? "—" : (g.score * g.weight).toFixed(2);
      return `
        <tr>
          <td>${escapeHtml(g.assessment_name)}</td>
          <td>${g.score === null ? '<span class="ungraded-label">Not graded</span>' : formatGrade(g.score)}</td>
          <td>${formatWeight(g.weight)}</td>
          <td>${contribution}</td>
          <td><button class="btn-secondary btn-edit-grade" data-id="${g.id}">Edit</button> <button class="icon-btn btn-delete-grade" data-id="${g.id}" title="Delete">${icon("trash")}</button></td>
        </tr>`;
    })
    .join("");

  openModal(`
    <h3>${escapeHtml(subject.name)}</h3>
    <p class="subtext">${escapeHtml(subject.year)} &middot; ${escapeHtml(subject.semester)} &middot; Current weighted grade: <strong>${average ? formatGrade(average) : "—"}</strong></p>
    <label for="detail-subject-award-category">Academic category</label>
    ${awardCategorySelect(subject.award_category || "ACADEMIC", "detail-subject-award-category")}
    <p class="hint">${awardCategoryHint()}</p>
    <label>Subject color</label>
    ${subjectColorPicker(subject.color, "detail-subject-color")}

    <div class="grades-table-wrap">
      <table class="grades-table">
        <thead>
          <tr><th>Assessment</th><th>Grade</th><th>Weight</th><th>Contribution<br/><span style="font-weight:400;text-transform:none;">(1-7 scale)</span></th><th>Actions</th></tr>
        </thead>
        <tbody id="grades-table-body">
          ${rows || '<tr><td colspan="5" class="empty-state">No assessments yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <section class="prediction-panel">
      <h4>Grade prediction</h4>
      <p class="prediction-summary">Earned contribution: <strong>${earnedContribution.toFixed(2)}</strong> / 7.00 &middot; Graded: ${formatWeight(gradedWeight)} &middot; Remaining: ${formatWeight(remainingWeight)}</p>
      <p class="prediction-projection">Projected final grade if current performance continues: <strong>${average ? `${formatGrade(average)} (${average.toFixed(1)})` : "Add a grade to see a projection"}</strong></p>
      <label for="input-prediction-target">Target final grade</label>
      ${gradeInputHtml("input-prediction-target", gradingSystem, false, savedTarget)}
      <p class="prediction-result" id="prediction-result">Choose a target to calculate the grade needed across the remaining percentage.</p>
    </section>

    <h3 class="assessment-form-heading">Add Assessment</h3>
    <label for="input-assessment-name">Assessment Name</label>
    <input type="text" id="input-assessment-name" placeholder="e.g. Unit Test 1" />
    <label for="input-assessment-grade">Grade (${gradingSystem === "STANDARD" ? "Letter" : gradingSystem === "IB" ? "IB 1-7" : "Percentage"}; optional until graded)</label>
    ${gradeInputHtml("input-assessment-grade", gradingSystem, true)}
    <label for="input-assessment-weight">Weight (%)</label>
    <input type="number" id="input-assessment-weight" min="0.01" max="100" step="0.01" placeholder="e.g. 20" />
    <div class="field-error" id="add-grade-error"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-close-detail">Close</button>
      <button class="btn-primary" id="btn-save-grade">Add Assessment</button>
    </div>
  `);

  bindSubjectColorPicker("detail-subject-color", async (color) => {
    try {
      const updatedSubject = await api.updateSubject(subjectId, { color });
      subjectsCache = subjectsCache.map((item) => item.id === subjectId ? { ...item, ...updatedSubject } : item);
      renderSubjects();
      renderSubjectDetailModal(subjectId);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("detail-subject-award-category").addEventListener("change", async (event) => {
    try {
      const updatedSubject = await api.updateSubject(subjectId, { awardCategory: event.target.value });
      subjectsCache = subjectsCache.map((item) => item.id === subjectId ? { ...item, ...updatedSubject } : item);
      showToast("Academic category updated");
      renderSubjects();
      renderSubjectDetailModal(subjectId);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById("btn-close-detail").addEventListener("click", () => {
    closeModal();
    renderSubjects();
  });

  document.querySelectorAll(".btn-delete-grade").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.deleteGrade(Number(btn.dataset.id));
        renderSubjectDetailModal(subjectId); // refresh table + average in place
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  document.querySelectorAll(".btn-edit-grade").forEach((btn) => {
    btn.addEventListener("click", () => {
      const grade = grades.find((item) => item.id === Number(btn.dataset.id));
      if (grade) openAssessmentEditModal(subjectId, grade, gradingSystem);
    });
  });

  const targetInput = document.getElementById("input-prediction-target");
  const predictionResult = document.getElementById("prediction-result");
  const updatePrediction = () => {
    subjectPredictionTargets[subjectId] = targetInput.value;
    if (targetInput.value === "") {
      predictionResult.textContent = "Choose a target to calculate the grade needed across the remaining percentage.";
      return;
    }
    try {
      const target = normalizeGradeClient(targetInput.value, gradingSystem);
      if (!remainingWeight) {
        predictionResult.textContent = `All assessment weight is graded. Final weighted grade: ${formatGrade(average)} (${average.toFixed(1)}).`;
        return;
      }
      const required = (target - earnedContribution) / remainingWeight;
      if (required > 7) {
        predictionResult.textContent = `Target not achievable: an average of ${required.toFixed(1)} would be needed on the remaining ${formatWeight(remainingWeight)}.`;
      } else if (required <= 1) {
        predictionResult.textContent = `Target already secured. The remaining ${formatWeight(remainingWeight)} can average 1.0 or higher.`;
      } else {
        predictionResult.textContent = `To reach ${formatGrade(target)}, average ${required.toFixed(1)} (${formatGrade(required)}) across the remaining ${formatWeight(remainingWeight)}.`;
      }
    } catch (err) {
      predictionResult.textContent = "Enter a valid target grade.";
    }
  };
  targetInput.addEventListener("input", updatePrediction);
  targetInput.addEventListener("change", updatePrediction);

  document.getElementById("btn-save-grade").addEventListener("click", async () => {
    const assessmentName = document.getElementById("input-assessment-name").value.trim();
    const gradeInput = document.getElementById("input-assessment-grade").value;
    const weightPercent = document.getElementById("input-assessment-weight").value;
    const errorBox = document.getElementById("add-grade-error");

    if (!assessmentName) {
      errorBox.textContent = "Assessment name is required.";
      return;
    }
    if (weightPercent === "") {
      errorBox.textContent = "Assessment weight is required.";
      return;
    }
    try {
      await api.addGrade(subjectId, { assessmentName, gradeInput, gradingSystem, weightPercent: Number(weightPercent) });
      showToast("Assessment added");
      renderSubjectDetailModal(subjectId); // refresh in place so the modal doesn't jump closed
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

function bindSubjectColorPicker(inputId, onSelect) {
  const picker = document.querySelector(".subject-color-options");
  if (!picker) return;
  picker.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedColor = button.dataset.color;
      document.getElementById(inputId).value = selectedColor;
      picker.querySelectorAll(".color-swatch").forEach((swatch) => {
        const selected = swatch === button;
        swatch.classList.toggle("selected", selected);
        swatch.setAttribute("aria-checked", String(selected));
      });
      if (onSelect) onSelect(selectedColor);
    });
  });
}

function openAssessmentEditModal(subjectId, grade, gradingSystem) {
  openModal(`
    <h3>Edit Assessment</h3>
    <label for="edit-assessment-name">Assessment Name</label>
    <input type="text" id="edit-assessment-name" value="${escapeHtml(grade.assessment_name)}" />
    <label for="edit-assessment-grade">Grade (optional until graded)</label>
    ${gradeInputHtml("edit-assessment-grade", gradingSystem, true)}
    <label for="edit-assessment-weight">Weight (%)</label>
    <input type="number" id="edit-assessment-weight" min="0.01" max="100" step="0.01" value="${Number((grade.weight * 100).toFixed(2))}" />
    <div class="field-error" id="edit-grade-error"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-edit-grade">Cancel</button>
      <button class="btn-primary" id="btn-save-edit-grade">Save Changes</button>
    </div>
  `);
  const gradeField = document.getElementById("edit-assessment-grade");
  gradeField.value = grade.score === null ? "" : denormalizeGradeClient(grade.score, gradingSystem);

  document.getElementById("btn-cancel-edit-grade").addEventListener("click", () => renderSubjectDetailModal(subjectId));
  document.getElementById("btn-save-edit-grade").addEventListener("click", async () => {
    const errorBox = document.getElementById("edit-grade-error");
    try {
      await api.updateGrade(grade.id, {
        assessmentName: document.getElementById("edit-assessment-name").value.trim(),
        gradeInput: gradeField.value,
        gradingSystem,
        weightPercent: Number(document.getElementById("edit-assessment-weight").value),
      });
      showToast("Assessment updated");
      renderSubjectDetailModal(subjectId);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

function normalizeGradeClient(input, gradingSystem) {
  if (gradingSystem === "STANDARD") {
    const values = { "A+": 7, A: 6, "B+": 5, B: 4, C: 3, D: 2, F: 1 };
    if (values[input] === undefined) throw new Error("Invalid grade");
    return values[input];
  }
  const value = Number(input);
  if (!Number.isFinite(value)) throw new Error("Invalid grade");
  if (gradingSystem === "PERCENTAGE") {
    if (value < 0 || value > 100) throw new Error("Invalid grade");
    return Math.round((1 + (value / 100) * 6) * 10) / 10;
  }
  if (value < 1 || value > 7) throw new Error("Invalid grade");
  return value;
}

function formatWeight(weight) {
  return `${Number((weight * 100).toFixed(2))}%`;
}

// Client-side mirror of Algorithm 3 (Subject Weighted Average), used
// only for instant display inside the modal header. The database
// value computed by logic/gradeLogic.js server-side remains authoritative.
function subjectWeightedAverageClient(gradeList) {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const grade of gradeList) {
    if (grade.score === null) continue;
    totalWeightedScore += grade.score * grade.weight;
    totalWeight += grade.weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((totalWeightedScore / totalWeight) * 10) / 10;
}
