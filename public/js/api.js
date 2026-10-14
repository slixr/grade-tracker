/**
 * public/js/api.js
 * Thin wrapper around fetch() for every backend endpoint. Keeping
 * all network calls in one file means every other script just calls
 * a plain-named function (e.g. api.addSubject(...)) and never has to
 * repeat fetch/headers/error-handling boilerplate.
 */
const api = (() => {
  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      let message = "Something went wrong";
      try {
        const body = await res.json();
        message = body.error || message;
      } catch (_) {
        /* response had no JSON body */
      }
      throw new Error(message);
    }
    if (res.status === 204) return null; // no content (deletes)
    return res.json();
  }

  return {
    // ---- Subjects ----
    getSubjects: () => request("/api/subjects"),
    addSubject: (name, semester, year, color, awardCategory) =>
      request("/api/subjects", { method: "POST", body: JSON.stringify({ name, semester, year, color, awardCategory }) }),
    updateSubject: (id, payload) =>
      request(`/api/subjects/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteSubject: (id) => request(`/api/subjects/${id}`, { method: "DELETE" }),

    // ---- Grades ----
    getGradesForSubject: (subjectId) => request(`/api/grades/subject/${subjectId}`),
    addGrade: (subjectId, payload) =>
      request(`/api/grades/subject/${subjectId}`, { method: "POST", body: JSON.stringify(payload) }),
    updateGrade: (id, payload) =>
      request(`/api/grades/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteGrade: (id) => request(`/api/grades/${id}`, { method: "DELETE" }),

    // ---- Goals ----
    getGoals: () => request("/api/goals"),
    addGoal: (payload) => request("/api/goals", { method: "POST", body: JSON.stringify(payload) }),
    deleteGoal: (id) => request(`/api/goals/${id}`, { method: "DELETE" }),

    // ---- Preferences ----
    getPreferences: () => request("/api/preferences"),
    updatePreferences: (payload) =>
      request("/api/preferences", { method: "PUT", body: JSON.stringify(payload) }),
    clearAllData: () => request("/api/preferences/reset", { method: "DELETE" }),

    // ---- Dashboard ----
    getDashboard: () => request("/api/dashboard"),
  };
})();
