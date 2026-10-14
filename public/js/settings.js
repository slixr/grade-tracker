/**
 * public/js/settings.js
 * Settings tab. Every control here writes straight through to the
 * `preferences` table (PUT /api/preferences) so a saved choice
 * survives closing and reopening the app - this is the persistence
 * mechanism required by the Success Criteria, backed by SQLite
 * instead of localStorage.
 *
 * Listeners are attached once at load (these elements live in
 * index.html and are never re-created), while renderSettings() just
 * re-syncs the displayed values whenever the tab is opened.
 */

function renderSettings() {
  const p = AppState.preferences;
  document.getElementById("toggle-dark-mode").checked = p.theme === "dark";
  document.getElementById("select-grading-system").value = p.grading_system;
  document.getElementById("input-default-semester").value = p.default_semester || "";
  document.getElementById("select-tok-grade").value = p.tok_grade || "C";
  document.getElementById("select-school-program").value = p.school_program || "SHS_STANDARD";
  document.getElementById("toggle-ee-complete").checked = Boolean(p.ee_complete);
  document.getElementById("toggle-cas-complete").checked = Boolean(p.cas_complete);
  updateGradingHint();
  updateSchoolProgramHint();
}

function updateSchoolProgramHint() {
  const messages = {
    JHS: "Music, Art, PE, and Computer Education are excluded from Junior High term awards.",
    SHS_STANDARD: "PE and Computer Education require B; other academic subjects use the honors thresholds.",
    IBDP: "Exactly six IB subjects count toward points; other academic grades and PE have separate minimums.",
  };
  const isIB = document.getElementById("select-school-program").value === "IBDP";
  const ibScaleHint = isIB && document.getElementById("select-grading-system").value !== "IB"
    ? " Select IB 1–7 in Display Format before calculating IB honors."
    : "";
  document.getElementById("school-program-hint").textContent = `${messages[document.getElementById("select-school-program").value] || ""}${ibScaleHint}`;
}

function updateGradingHint() {
  const value = document.getElementById("select-grading-system").value;
  const hints = {
    STANDARD: "Current format: Letter grades (e.g., A+, A, B+, B, C, D, F)",
    IB: "Current format: IB scale (e.g., 6.0)",
    PERCENTAGE: "Current format: Percentage (e.g., 95.0%)",
  };
  document.getElementById("grading-system-hint").textContent = hints[value] || "";
}

async function savePreference(partialUpdate, successMessage) {
  try {
    AppState.preferences = await api.updatePreferences(partialUpdate);
    if (successMessage) showToast(successMessage);
  } catch (err) {
    showToast(err.message, true);
  }
}

document.getElementById("toggle-dark-mode").addEventListener("change", (e) => {
  const theme = e.target.checked ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  savePreference({ theme }, "Theme updated");
});

document.getElementById("select-grading-system").addEventListener("change", (e) => {
  updateGradingHint();
  updateSchoolProgramHint();
  savePreference({ grading_system: e.target.value }, "Display format updated");
});

document.getElementById("select-school-program").addEventListener("change", (e) => {
  updateSchoolProgramHint();
  savePreference({ school_program: e.target.value }, "School awards program saved");
});

document.getElementById("input-default-semester").addEventListener("change", (e) => {
  savePreference({ default_semester: e.target.value.trim() }, "Default semester saved");
});

document.getElementById("select-tok-grade").addEventListener("change", (e) => {
  savePreference({ tok_grade: e.target.value }, "TOK grade saved");
});

document.getElementById("toggle-ee-complete").addEventListener("change", (e) => {
  savePreference({ ee_complete: e.target.checked ? 1 : 0 }, "EE completion updated");
});

document.getElementById("toggle-cas-complete").addEventListener("change", (e) => {
  savePreference({ cas_complete: e.target.checked ? 1 : 0 }, "CAS completion updated");
});

document.getElementById("btn-export-data").addEventListener("click", async () => {
  try {
    const [subjects, goals, preferences] = await Promise.all([
      api.getSubjects(),
      api.getGoals(),
      api.getPreferences(),
    ]);
    const exportData = { exportedAt: new Date().toISOString(), subjects, goals, preferences };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grade-tracker-export.json";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Data exported");
  } catch (err) {
    showToast(err.message, true);
  }
});

document.getElementById("btn-clear-data").addEventListener("click", async () => {
  if (!confirm("This will permanently delete every subject, grade and goal. Continue?")) return;
  try {
    await api.clearAllData();
    // Re-read from the server so every field (school program, EE/CAS) matches the reset row.
    AppState.preferences = await api.getPreferences();
    document.documentElement.setAttribute("data-theme", AppState.preferences.theme);
    try {
      localStorage.removeItem("grade-tracker-goal-progress");
    } catch (_) {
      /* storage unavailable - nothing to clear */
    }
    showToast("All data cleared");
    switchTab("dashboard");
  } catch (err) {
    showToast(err.message, true);
  }
});
