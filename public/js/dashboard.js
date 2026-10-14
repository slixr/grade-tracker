/**
 * public/js/dashboard.js
 * Renders the Dashboard tab: the 4 stat cards, the subject
 * performance bar chart, the goal progress list, and the subject
 * progress list - all sourced from GET /api/dashboard (+ /api/goals
 * for goal-level detail), so every number on this screen is a live
 * result of Algorithms 3, 4, 6, 7 and 8, never hard-coded.
 */

let dashboardSubjectCache = [];

document.getElementById("subject-performance-view").addEventListener("change", renderSelectedSubjectChart);
document.getElementById("subject-performance-year").addEventListener("change", renderSelectedSubjectChart);

async function renderDashboard() {
  let data, goals;
  try {
    [data, goals] = await Promise.all([api.getDashboard(), api.getGoals()]);
  } catch (err) {
    showToast(err.message, true);
    return;
  }

  const suffix = data.gradingSystem === "PERCENTAGE" ? "%" : "";
  dashboardSubjectCache = data.subjects;
  document.getElementById("stat-overall-average").textContent = data.displayOverallAverage == null
    ? "—"
    : `${data.displayOverallAverage}${suffix}`;
  document.getElementById("stat-overall-average-label").textContent = data.currentSemesterLabel
    ? `Semester Average (${data.currentSemesterLabel})`
    : "Semester Average";
  document.getElementById("stat-total-subjects").textContent = data.totalSubjects;
  document.getElementById("stat-honors-level").textContent = data.currentHonorsLevel;
  document.getElementById("stat-goals-on-track").textContent = `${data.goalsOnTrack}/${data.totalGoals}`;

  updateSubjectPerformanceYears(data.subjects);
  renderSelectedSubjectChart();
  renderYearlyHonors(data.yearlyHonors);
  renderDashboardGoalProgress(goals);
  renderDashboardSubjectList(data.subjects, goals, suffix);
}

function renderYearlyHonors(years) {
  const container = document.getElementById("dashboard-yearly-honors");
  if (years.length === 0) {
    container.innerHTML = '<p class="empty-state">Add subjects for an academic year to see yearly honors.</p>';
    return;
  }
  container.innerHTML = years.map((year) => `
    <div class="year-honors-row">
      <strong class="year-honors-title">${escapeHtml(year.year)}</strong>
      <div class="year-honors-semester"><span>Semester 1</span><span>${escapeHtml(year.firstSemesterHonors)}</span></div>
      <div class="year-honors-semester"><span>Semester 2</span><span>${escapeHtml(year.secondSemesterHonors)}</span></div>
      <div class="year-honors-result"><span>Yearly honors</span><strong>${escapeHtml(year.yearlyHonors)}</strong></div>
    </div>`).join("");
}

function updateSubjectPerformanceYears(subjects) {
  const yearSelect = document.getElementById("subject-performance-year");
  const previousYear = yearSelect.value;
  const years = [...new Set(subjects.map((subject) => subject.year))]
    .filter(Boolean)
    .sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
  yearSelect.innerHTML = years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("");
  if (years.includes(previousYear)) yearSelect.value = previousYear;
  else if (years.length > 0) yearSelect.value = years[years.length - 1];
  updateSubjectYearControl();
}

function updateSubjectYearControl() {
  const isOverall = document.getElementById("subject-performance-view").value === "overall";
  document.getElementById("subject-performance-year").disabled = isOverall;
  document.getElementById("subject-performance-year-wrap").classList.toggle("disabled", isOverall);
}

function renderSelectedSubjectChart() {
  updateSubjectYearControl();
  const view = document.getElementById("subject-performance-view").value;
  const year = document.getElementById("subject-performance-year").value;
  const subjects = aggregateChartSubjects(dashboardSubjectCache, view, year);
  renderBarChart(subjects);
}

function aggregateChartSubjects(subjects, view, selectedYear) {
  const groupedByName = new Map();
  const eligible = subjects.filter((subject) => {
    if (!Number.isFinite(subject.average)) return false;
    if (view === "overall") return true;
    if (String(subject.year) !== String(selectedYear)) return false;
    const semester = chartSemesterNumber(subject.semester);
    if (view === "semester1") return semester === 1;
    if (view === "semester2") return semester === 2;
    return semester === 1 || semester === 2;
  });

  for (const subject of eligible) {
    if (!groupedByName.has(subject.name)) groupedByName.set(subject.name, { color: subject.color, periods: new Map() });
    const grouped = groupedByName.get(subject.name);
    const periodKey = `${subject.year}\u0000${subject.semester}`;
    if (!grouped.periods.has(periodKey)) grouped.periods.set(periodKey, []);
    grouped.periods.get(periodKey).push(subject.average);
  }

  return [...groupedByName.entries()].map(([name, grouped]) => {
    const periodAverages = [...grouped.periods.values()].map((averages) =>
      averages.reduce((sum, average) => sum + average, 0) / averages.length
    );
    const average = periodAverages.reduce((sum, value) => sum + value, 0) / periodAverages.length;
    return { name, average: Math.round(average * 10) / 10, color: grouped.color };
  });
}

function chartSemesterNumber(semester) {
  const normalized = String(semester).trim().toLowerCase();
  if (/\b(?:semester\s*(?:1|one|first)|1st\s+semester|first\s+semester)\b/.test(normalized)) return 1;
  if (/\b(?:semester\s*(?:2|two|second)|2nd\s+semester|second\s+semester)\b/.test(normalized)) return 2;
  return null;
}

function renderBarChart(subjects) {
  const container = document.getElementById("bar-chart");
  if (subjects.length === 0) {
    container.innerHTML = '<p class="empty-state">No graded subjects in this view.</p>';
    return;
  }
  container.innerHTML = subjects
    .map((s) => {
      const heightPct = Math.max(4, ((s.average - 1) / 6) * 100);
      return `
        <div class="bar-chart-col">
          <span class="bar-chart-value">${formatGrade(s.average)}</span>
          <div class="bar-chart-bar" style="height:${heightPct}%;background:${s.color}"></div>
          <span class="bar-chart-label">${escapeHtml(s.name)}</span>
        </div>`;
    })
    .join("");
}

function renderDashboardGoalProgress(goals) {
  const container = document.getElementById("dashboard-goal-progress");
  if (goals.length === 0) {
    container.innerHTML = '<p class="empty-state">No goals set yet.</p>';
    return;
  }
  container.innerHTML = goals
    .map((g) => {
      const label = g.goal_type === "subject_target" ? `${escapeHtml(g.subjectName || "Subject")} Target` : g.honors_level;
      return `
        <div class="mini-goal-row">
          <div class="row-top"><span>${label}</span><span>${g.percentComplete}%</span></div>
          <div class="progress-track"><div class="progress-fill ${getGoalProgressColor(g)}" style="width:${g.percentComplete}%"></div></div>
        </div>`;
    })
    .join("");
}

function renderDashboardSubjectList(subjects, goals, suffix) {
  const container = document.getElementById("dashboard-subject-list");
  if (subjects.length === 0) {
    container.innerHTML = '<p class="empty-state">No subjects yet. Add one from the Subjects tab.</p>';
    return;
  }
  container.innerHTML = subjects
    .map((s) => {
      const matchingGoal = goals.find((g) => g.goal_type === "subject_target" && g.subject_id === s.id);
      const dotColor = matchingGoal ? `var(--${matchingGoal.color === "green" ? "green" : matchingGoal.color === "yellow" ? "yellow" : "red"})` : s.color;
      return `
        <div class="subject-row">
          <span class="subject-color-dot" style="background:${dotColor}"></span>
          <div class="subject-row-body">
            <div class="subject-row-top">
              <strong>${escapeHtml(s.name)}</strong>
              <span>${s.displayAverage == null ? "—" : `${s.displayAverage}${suffix}`}</span>
            </div>
            <span class="count">${s.assessmentCount} assessment${s.assessmentCount === 1 ? "" : "s"}</span>
          </div>
        </div>`;
    })
    .join("");
}

// Shared tiny helper used by every render file to avoid HTML injection
// from subject/assessment names typed by the user.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
