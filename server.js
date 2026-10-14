/**
 * server.js
 * Entry point: wires up Express, mounts the API routes under /api,
 * and serves the static frontend (public/) - matching the
 * Node.js + Express.js + SQLite stack specified in Criterion A's
 * Computational Context.
 */
const express = require("express");
const path = require("path");

const subjectsRouter = require("./routes/subjects");
const gradesRouter = require("./routes/grades");
const goalsRouter = require("./routes/goals");
const preferencesRouter = require("./routes/preferences");
const dashboardRouter = require("./routes/dashboard");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/subjects", subjectsRouter);
app.use("/api/grades", gradesRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/dashboard", dashboardRouter);

// Fallback: any non-API route serves the SPA shell.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Grade Tracker server running on http://localhost:${PORT}`);
});
