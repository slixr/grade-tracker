/**
 * public/js/goals.js
 * Goals tab. Two kinds of goals can be added here (matching the UML
 * Goal class: targetGrade / honorsGoal): a per-subject target grade,
 * or a semester-wide Honors level. Progress, colors and the
 * required-grade hint text all come straight from the enriched
 * GET /api/goals response (Algorithms 5, 6, 7, 8) - nothing on this
 * screen is recalculated or guessed on the client.
 */

const HONORS_DESCRIPTIONS = {
  "Academic Excellence": "Top academic achievement",
  "First Honors": "Outstanding academic performance",
  "Second Honors": "Excellent academic performance",
};

let goalsCache = [];

async function renderGoals() {
  let goals, dashboard;
  try {
    [goals, dashboard] = await Promise.all([api.getGoals(), api.getDashboard()]);
  } catch (err) {
    showToast(err.message, true);
    return;
  }
  goalsCache = goals;
  const suffix = dashboard.gradingSystem === "PERCENTAGE" ? "%" : "";
  document.getElementById("goals-current-average").textContent = dashboard.displayOverallAverage == null
    ? "—"
    : `${dashboard.displayOverallAverage}${suffix}`;

  const list = document.getElementById("goals-list");
  if (goals.length === 0) {
    list.innerHTML = '<p class="empty-state">No goals yet. Click "+ Add Goal" to set your first target.</p>';
    return;
  }

  list.innerHTML = goals.map((g) => goalCardHtml(g)).join("");

  list.querySelectorAll(".btn-delete-goal").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.deleteGoal(Number(btn.dataset.id));
        showToast("Goal deleted");
        renderGoals();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function goalCardHtml(g) {
  if (g.goal_type === "subject_target") {
    const hint = subjectGoalHint(g);
    return `
      <div class="goal-card">
        <div class="goal-card-top">
          <div>
            <h4>${escapeHtml(g.subjectName || "Unknown subject")} Target</h4>
            <p class="subtext">Target grade: ${formatGrade(g.target_grade)}</p>
          </div>
          <button class="icon-btn btn-delete-goal" data-id="${g.id}" title="Delete goal">${icon("trash")}</button>
        </div>
        <div class="goal-meta-row"><span>${g.percentComplete}% complete</span><span>Current: ${formatGrade(g.currentAverage)}</span></div>
        <div class="progress-track"><div class="progress-fill ${getGoalProgressColor(g)}" style="width:${g.percentComplete}%"></div></div>
        <div class="goal-hint">${hint}</div>
      </div>`;
  }

  // goal_type === 'honors'
  const hint = g.isAchieved
    ? "Goal achieved based on your current grades."
    : `<span>Progress is based on the required criteria:</span><ul class="goal-criteria">${(g.criteria || []).map((criterion) => `<li>${escapeHtml(criterion.label)}: <strong>${escapeHtml(criterion.current)} / ${escapeHtml(criterion.required)}</strong></li>`).join("")}</ul><strong>Next steps</strong><ul class="goal-criteria">${(g.reminders || []).map((reminder) => `<li>${escapeHtml(reminder)}</li>`).join("")}</ul>`;
  return `
    <div class="goal-card">
      <div class="goal-card-top">
        <div>
          <h4>${escapeHtml(g.honors_level)}</h4>
          <p class="subtext">${HONORS_DESCRIPTIONS[g.honors_level] || ""}</p>
        </div>
        <button class="icon-btn btn-delete-goal" data-id="${g.id}" title="Delete goal">${icon("trash")}</button>
      </div>
      <div class="goal-meta-row"><span>${g.percentComplete}% complete</span><span>Currently: ${escapeHtml(g.achievedLevel)}</span></div>
      <div class="progress-track"><div class="progress-fill ${getGoalProgressColor(g)}" style="width:${g.percentComplete}%"></div></div>
      <div class="goal-hint">${hint}</div>
    </div>`;
}

function subjectGoalHint(g) {
  if (!g.required) return "";
  switch (g.required.status) {
    case "ok":
      return `To reach this goal, you need to average <strong>${formatGrade(g.required.requiredAverage)}</strong> on your remaining assessments.`;
    case "Target already secured":
      return "Target already secured based on your current grades.";
    case "Target impossible":
      return "This target is no longer mathematically achievable with your remaining assessment weight.";
    case "No remaining assessments":
      return "All assessments are in for this subject — the grade is final.";
    default:
      return "";
  }
}

document.getElementById("btn-add-goal").addEventListener("click", async () => {
  let subjects = [];
  try {
    subjects = await api.getSubjects();
  } catch (err) {
    showToast(err.message, true);
  }
  const gradingSystem = AppState.preferences.grading_system;
  const subjectOptions = subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");

  openModal(`
    <h3>Add Goal</h3>
    <label for="select-goal-type">Goal Type</label>
    <select id="select-goal-type">
      <option value="subject_target">Subject Target Grade</option>
      <option value="honors">Semester Honors Level</option>
    </select>

    <div id="fields-subject-target">
      <label for="select-goal-subject">Subject</label>
      <select id="select-goal-subject">${subjectOptions || '<option value="">No subjects yet</option>'}</select>
      <label for="input-goal-target-grade">Target Grade (${gradingSystem === "STANDARD" ? "Letter" : gradingSystem === "IB" ? "IB 1-7" : "Percentage"})</label>
      ${gradeInputHtml("input-goal-target-grade", gradingSystem)}
    </div>

    <div id="fields-honors" style="display:none;">
      <label for="select-honors-level">Honors Level</label>
      <select id="select-honors-level">
        <option value="Academic Excellence">Academic Excellence</option>
        <option value="First Honors">First Honors</option>
        <option value="Second Honors">Second Honors</option>
      </select>
    </div>

    <div class="field-error" id="add-goal-error"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="btn-cancel-goal">Cancel</button>
      <button class="btn-primary" id="btn-save-goal">Add Goal</button>
    </div>
  `);

  document.getElementById("select-goal-type").addEventListener("change", (e) => {
    const isSubject = e.target.value === "subject_target";
    document.getElementById("fields-subject-target").style.display = isSubject ? "block" : "none";
    document.getElementById("fields-honors").style.display = isSubject ? "none" : "block";
  });

  document.getElementById("btn-cancel-goal").addEventListener("click", closeModal);
  document.getElementById("btn-save-goal").addEventListener("click", async () => {
    const goalType = document.getElementById("select-goal-type").value;
    const errorBox = document.getElementById("add-goal-error");

    if (goalType === "subject_target") {
      const subjectId = Number(document.getElementById("select-goal-subject").value);
      const targetGradeInput = document.getElementById("input-goal-target-grade").value;
      if (!subjectId) {
        errorBox.textContent = "Add a subject first, then set a target for it.";
        return;
      }
      if (targetGradeInput === "") {
        errorBox.textContent = "Target grade is required.";
        return;
      }
      if (goalsCache.some((g) => g.goal_type === "subject_target" && g.subject_id === subjectId)) {
        errorBox.textContent = "This subject already has a target goal. Delete it first to set a new one.";
        return;
      }
      try {
        await api.addGoal({ goalType, subjectId, targetGradeInput, gradingSystem });
        closeModal();
        showToast("Goal added");
        renderGoals();
      } catch (err) {
        errorBox.textContent = err.message;
      }
    } else {
      const honorsLevel = document.getElementById("select-honors-level").value;
      if (goalsCache.some((g) => g.goal_type === "honors" && g.honors_level === honorsLevel)) {
        errorBox.textContent = "That honors goal is already set.";
        return;
      }
      try {
        await api.addGoal({ goalType, honorsLevel });
        closeModal();
        showToast("Goal added");
        renderGoals();
      } catch (err) {
        errorBox.textContent = err.message;
      }
    }
  });
});
