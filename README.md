# Focus — AI Study Planner

A polished, production-quality AI Study Planner web app. Generate smart daily & weekly study schedules from your subjects, exams, priorities and available time — plus Smart Notes, Mock Tests, Mental Wellness breaks, and Career Roadmaps.

## Features

- **Dashboard** — today's hours, completed sessions, streak, upcoming exams, progress ring, weekly completion.
- **Create Plan** — set availability (hours, times, days, session/break length) and generate a schedule.
- **Smart planner** — prioritises by exam proximity → priority → difficulty → remaining topics → revision → practice; respects time caps, adds breaks, and redistributes missed sessions.
- **Today / Weekly schedule** — complete, skip (auto-reschedule), edit, and add custom tasks.
- **Analytics** — completion rate, weekly bar chart, exam countdown, subject progress table.
- **Smart Notes** — upload a syllabus (PDF/TXT) or paste text → short, plain-language notes.
- **Mock Test** — generate MCQs from a syllabus or any topic; choose 10/20/40/50/100 questions; auto-graded results with explanations.
- **Mental Wellness** — guided, timed activities (box breathing, meditation, Surya Namaskar, desk stretches, gratitude reset).
- **Career Roadmap** — enter any career → a visual phase-by-phase skill roadmap.
- Light/dark theme, mobile-first responsive, keyboard accessible, local persistence.

## Run

Pure static HTML/CSS/JS — no build step.

```bash
# Option 1: open directly
# just open index.html in a browser

# Option 2: local server
node server.js
# → http://localhost:5173
```

## Tests

```bash
npm test        # runs smoke-test.js + dom-test.js
```

## AI provider

The app works fully offline using deterministic local engines. To connect a real AI model, set `window.STUDY_AI_ENDPOINT` to a server route that keeps your API key server-side and returns structured JSON. No secrets are stored in the front-end.

## Tech

Vanilla JavaScript, zero runtime dependencies. Structured as a small state store, planner/tools engines, reusable UI primitives, and a hash router.
