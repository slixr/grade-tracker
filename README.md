# Grade Tracker — IB CS IA (Criterion D)

A Student Grade Tracker web app built with **Node.js + Express.js + SQLite**,
implementing the system designed in Criterion A–C: weighted averages, grade
normalization across grading systems, academic goals with a required-grade
calculator, semester Honors evaluation, and progress visualization.

## 1. Setup

```
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The SQLite database file
(`database/gradetracker.db`) is created automatically the first time the
server runs — you don't need to create it yourself.

Requires **Node.js 22 or newer** (better-sqlite3 v13 needs it) — see nodejs.org if it's not installed yet.

## 2. Project structure

```
grade-tracker/
├── server.js              Express app entry point, mounts API routes
├── database/
│   └── db.js              SQLite connection + schema (CREATE TABLE)
├── logic/
│   └── gradeLogic.js       The 9 Criterion C algorithms, as pure functions
├── routes/
│   ├── subjects.js        Subject CRUD
│   ├── grades.js          Grade CRUD (validates + normalizes on the way in)
│   ├── goals.js           Goal CRUD + live progress calculation
│   ├── preferences.js     Theme / grading system / semester / data reset
│   └── dashboard.js       Aggregate stats for the Dashboard tab
└── public/                Frontend (served statically by Express)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js         fetch() wrapper for every backend endpoint
        ├── app.js         tab switching, theme, modal/toast helpers
        ├── dashboard.js   Dashboard tab rendering
        ├── subjects.js    Subjects tab + grades table
        ├── goals.js       Goals tab
        └── settings.js    Settings tab
```

## 3. Where each algorithm lives

Every function in `logic/gradeLogic.js` is commented with the algorithm
number it implements, so you can point directly to it in your write-up:

| # | Algorithm | Function |
|---|---|---|
| 1 | Grade Normalization | `normalizeGrade()` |
| 2 | Reverse Grade Conversion | `denormalizeGrade()` |
| 3 | Subject Weighted Average | `subjectWeightedAverage()` |
| 4 | Semester Overall Average | `semesterOverallAverage()` |
| 5 | Required Grade for Subject Goal | `requiredGradeForGoal()` |
| 6 | Semester Honors Evaluation (Standard) | `semesterHonorsStandard()` |
| 7 | Semester Honors Evaluation (IB) | `semesterHonorsIB()` |
| 8 | Progress Bar Color | `progressBarColor()` |
| 9 | Input Validation | `validateInput()` |

Algorithm 1 has one deliberate extension beyond the original pseudocode: a
`PERCENTAGE` branch was added alongside `STANDARD` and `IB`, since the
success criteria list percentage as a supported grading system.

## 4. Features implemented

- Add / delete subjects, with confirmation before delete (cascades to that subject's grades and goals)
- Track subjects by year and semester
- Add, edit, or delete tests and assessments; enter grades later and adjust their percentage weights
- See each weighted contribution, current weighted grade, and the grade needed on remaining weight to reach a target
- Semester average across all graded subjects in the latest semester (the same subjects used for honors)
- Yearly Honors based on the lower honors level earned across Semester 1 and Semester 2 in the same academic year
- School awards profile (Junior High, Senior High Standard, or IBDP) and per-subject academic award categories
- Academic-only term honors: Junior High excludes Music, Art, PE, and Computer Education; Senior High Standard requires B in PE/Computer Education and applies honors thresholds to other academic subjects; IBDP totals exactly six subjects marked Academic, checks the handbook grade floors in Other academic subjects and PE, and requires EE/CAS and the specified TOK grade
- Standard Academic Excellence requires three A+ grades and no included subject below A; First Honors requires three A-or-higher grades and no included subject below B+; Second Honors requires no included subject below B+
- Conduct/effort, extracurricular participation, and disciplinary status are not evaluated
- Three grading systems (Letter, IB 1–7, Percentage) — changeable anytime in Settings, applied everywhere instantly
- Two goal types: a target grade for a specific subject, or a semester Honors level (Academic Excellence / First Honors / Second Honors)
- Required-grade calculator, handling "already secured" and "no longer achievable" cases
- Color-coded progress bars (green / yellow / red)
- Light/dark theme
- Data export to a `.json` file
- "Clear All Data" reset
- Responsive layout down to mobile width

## 5. Testing this yourself

A good demo/testing sequence for your Criterion D video:

1. Add a subject with a year and semester, then add assessments with weights that total 100%; confirm the weighted average and contributions against a hand calculation.
2. Try to add or edit an assessment so the total exceeds 100% — it should be rejected with "Error: Assessment percentages cannot exceed 100%."
3. Add an assessment without a grade, then choose a target grade and check the required average on the remaining percentage against a hand calculation.
4. Edit an assessment's grade and percentage and confirm the contributions and prediction update.
5. Try an out-of-range grade (e.g. 9 on the IB scale) — rejected ("Invalid grade value").
6. Choose a school awards program and classify subjects. Test Junior High exclusions, Senior High PE/Computer B floors, and IBDP's six point subjects, other academic floors, PE 4, TOK, EE, and CAS requirements.
7. Toggle dark mode and the grading system in Settings; refresh the page and confirm both preferences persisted (proves SQLite persistence, not just in-memory state).
8. Delete a subject and confirm its grades and any goals referencing it disappear too (cascade delete).

## 6. Known extensions beyond the original pseudocode

These boundary cases were found and fixed during development/testing (worth
mentioning in your Criterion D testing write-up):

- A newly-added subject with **zero assessments yet** no longer counts as a
  "0" in the overall average. If it is required for the selected award profile,
  honors stays "In progress" until its grade is entered.
- An Honors goal now correctly counts as achieved if you reach a **higher**
  Honors level than the one you targeted, not just an exact match.
- **Floating-point weight totals.** Weights of 10% + 20% + 70% add up to
  `1.0000000000000002` in JavaScript, which used to trigger the "cannot exceed
  100%" error on a valid set. Algorithm 9 now allows a 1e-9 tolerance.
- **Goal targets are range-checked.** A target such as 150% or IB 9 is
  rejected with "Invalid grade value", the same as an assessment grade.
- **A subject goal with no graded work** shows no current average (instead of
  F / 0%) until the first grade is entered.
