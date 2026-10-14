/**
 * public/js/app.js
 * App shell: handles tab navigation, applies the saved theme/grading
 * system on load, and provides small shared helpers (modal, toast,
 * grade formatting) that dashboard.js / subjects.js / goals.js /
 * settings.js all reuse instead of duplicating the same code four
 * times.
 */

// Shared in-memory state for the current session. Preferences still
// live in SQLite (source of truth) - this is just a local cache so
// every tab can format grades without an extra fetch each time.
const AppState = {
  preferences: { theme: "dark", grading_system: "STANDARD", default_semester: "", tok_grade: "C", school_program: "SHS_STANDARD" },
};

function icon(name) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    subjects: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h7"/>',
    goals: '<path d="M12 3 14.8 8.7 21 9.6l-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.9l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(-1 -1)"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.7 1.7 0 0 1 1.3-2.8H18a3 3 0 0 0 3-3c0-5-4-8.9-9-8.9Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/>',
    grade: '<path d="M4 19.5V4.5M4 19.5h17M7 15l4-4 3 2 6-7"/>',
    academic: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3.5 3 8.5 3 12 0v-5M22 9v6"/>',
    data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ""}</svg>`;
}

// ---------- Grade display helper ----------
// Wraps Algorithm 2 (reverse grade conversion) so every screen shows
// grades in whatever format the user picked in Settings.
function formatGrade(normalizedScore) {
  if (normalizedScore === null || normalizedScore === undefined) return "—";
  const display = denormalizeGradeClient(normalizedScore, AppState.preferences.grading_system);
  if (AppState.preferences.grading_system === "PERCENTAGE") return `${display}%`;
  return String(display);
}

// Client-side mirror of Algorithm 2, used only for instant display
// formatting (the authoritative calculation still happens server-side
// in logic/gradeLogic.js before anything is saved).
function denormalizeGradeClient(normalizedGrade, gradingSystem) {
  const rounded = Math.round(normalizedGrade * 10) / 10;
  if (gradingSystem === "STANDARD") {
    const map = { 7: "A+", 6: "A", 5: "B+", 4: "B", 3: "C", 2: "D", 1: "F" };
    const clamped = Math.min(7, Math.max(1, Math.round(rounded)));
    return map[clamped];
  }
  if (gradingSystem === "PERCENTAGE") {
    return Math.round(((rounded - 1) / 6) * 1000) / 10;
  }
  return rounded; // IB
}

// ---------- Shared grade-input control ----------
// Both the "Add Grade" form (subjects.js) and the "Add Goal" form
// (goals.js) need an input that matches whatever grading system is
// currently selected in Settings. Building it here once keeps both
// forms in sync automatically.
function gradeInputHtml(inputId, gradingSystem, allowBlank = false, selectedValue = "") {
  if (gradingSystem === "STANDARD") {
    const options = ["A+", "A", "B+", "B", "C", "D", "F"]
      .map((value) => `<option value="${value}"${selectedValue === value ? " selected" : ""}>${value}</option>`)
      .join("");
    const blankOption = allowBlank ? `<option value=""${selectedValue === "" ? " selected" : ""}>Not graded yet</option>` : "";
    return `<select id="${inputId}">${blankOption}${options}</select>`;
  }
  if (gradingSystem === "PERCENTAGE") {
    return `<input type="number" id="${inputId}" min="0" max="100" step="0.1" placeholder="e.g. 85" value="${selectedValue}" />`;
  }
  return `<input type="number" id="${inputId}" min="1" max="7" step="0.1" placeholder="e.g. 6" value="${selectedValue}" />`; // IB
}

const goalProgressHistory = (() => {
  try {
    return JSON.parse(localStorage.getItem("grade-tracker-goal-progress") || "{}");
  } catch (_) {
    return {};
  }
})();

function getGoalProgressColor(goal) {
  const key = `${goal.goal_type}:${goal.id}`;
  const currentProgress = Number(goal.percentComplete);
  const previous = goalProgressHistory[key];
  const increasing = previous && (
    currentProgress > previous.value ||
    (currentProgress === previous.value && previous.increasing)
  );

  goalProgressHistory[key] = { value: currentProgress, increasing: Boolean(increasing) };
  try {
    localStorage.setItem("grade-tracker-goal-progress", JSON.stringify(goalProgressHistory));
  } catch (_) {
    // Progress colors still work for the current page if storage is unavailable.
  }
  return increasing ? "increasing" : goal.color;
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---------- Modal ----------
function openModal(innerHtml) {
  document.getElementById("modal-box").innerHTML = innerHtml;
  document.getElementById("modal-backdrop").classList.add("active");
}
function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("active");
  document.getElementById("modal-box").innerHTML = "";
}
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

// ---------- Tab navigation ----------
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${tabName}`);
  });

  if (tabName === "dashboard") renderDashboard();
  if (tabName === "subjects") renderSubjects();
  if (tabName === "goals") renderGoals();
  if (tabName === "settings") renderSettings();
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ---------- App init ----------
async function initApp() {
  try {
    AppState.preferences = await api.getPreferences();
  } catch (err) {
    showToast("Could not reach the server. Is `npm start` running?", true);
  }
  document.documentElement.setAttribute("data-theme", AppState.preferences.theme);
  renderDashboard(); // dashboard is the default active tab
}

document.addEventListener("DOMContentLoaded", initApp);
