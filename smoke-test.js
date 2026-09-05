/* Node smoke test — mocks browser globals, exercises store + planner end to end. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Minimal localStorage + window + document mocks
const storage = {};
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  Math,
  Promise,
  JSON,
  Object,
  Array,
  localStorage: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; }
  },
  window: {},
  fetch: undefined
};
sandbox.global = sandbox;
vm.createContext(sandbox);

function loadInto(file) {
  const code = fs.readFileSync(path.join(__dirname, 'js', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}
loadInto('store.js');
sandbox.Store = sandbox.window.Store;   // planner.js references global Store (window.Store in browser)
loadInto('planner.js');
sandbox.Planner = sandbox.window.Planner;

// Minimal document mock so ui.js pure string-builders can be exercised.
sandbox.document = { getElementById: () => null, createElement: () => ({ classList: { add() {} }, setAttribute() {}, appendChild() {}, remove() {} }) };
loadInto('ui.js');
sandbox.UI = sandbox.window.UI;

const Store = sandbox.window.Store;
const Planner = sandbox.window.Planner;
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } };

// 1. Add subjects
const chem = Store.addSubject({ name: 'Chemistry', topics: ['Atoms', 'Bonds', 'Acids'], difficulty: 'Hard', priority: 'High', examDate: iso(5), estHours: 9 });
const hist = Store.addSubject({ name: 'History', topics: ['WW1', 'WW2'], difficulty: 'Easy', priority: 'Low', examDate: iso(20), estHours: 4 });
ok(Store.get().subjects.length === 2, 'two subjects added');
ok(chem.topics.length === 3 && chem.topics[0].done === false, 'topics normalised with done flag');

// 2. Availability
Store.setAvailability({ hoursPerDay: 4, startTime: '09:00', endTime: '18:00', days: [1,2,3,4,5,6,0], sessionMins: 50, breakMins: 10 });
ok(Store.get().availability.hoursPerDay === 4, 'availability saved');

// 3. Generate plan (local engine)
Planner.generate(Store.get().subjects, Store.get().availability, { horizonDays: 14 }).then(plan => {
  ok(plan && plan.days && Object.keys(plan.days).length > 0, 'plan has days');
  const allSessions = Object.values(plan.days).flat();
  ok(allSessions.length > 0, 'plan has sessions');
  ok(allSessions.every(s => s.start && s.end && s.subject && s.status === 'pending'), 'sessions are structured');

  // High-priority + near-exam Chemistry should get more sessions than History
  const chemCount = allSessions.filter(s => s.subjectId === chem.id).length;
  const histCount = allSessions.filter(s => s.subjectId === hist.id).length;
  ok(chemCount >= histCount, 'urgent subject prioritised (chem ' + chemCount + ' >= hist ' + histCount + ')');

  // No day exceeds available hours (4h = 240min, session 50min => max ~4 sessions/day since 50+10 cadence)
  const overloaded = Object.values(plan.days).some(list => list.reduce((n, s) => n + s.durationMins, 0) > 4 * 60 + 1);
  ok(!overloaded, 'no day exceeds available study time');

  Store.setPlan(plan);

  // 4. Complete a session -> streak + completion tracked
  const first = Object.values(plan.days).flat()[0];
  Store.updateSession(first.id, { status: 'done' });
  Store.recordCompletion();
  ok(Store.get().meta.streak >= 1, 'streak recorded on completion');
  ok(Store.getSession(first.id).session.status === 'done', 'session marked done');

  // 5. Redistribution finds a future slot
  const slot = Planner.redistribute(Store.get().plan, first, Store.get().availability);
  ok(slot && slot.date && slot.start, 'redistribute returns a future slot');

  // 6. Validation errors
  Planner.generate([], Store.get().availability).then(() => ok(false, 'should reject empty subjects')).catch(err => {
    ok(err.code === 'no-subjects', 'empty subjects rejected with clear error');

    // 7. Persistence survives reload
    const raw = storage['focus.studyplanner.v1'];
    ok(raw && JSON.parse(raw).subjects.length === 2, 'state persisted to storage');

    // 8. UI pure builders produce escaped, structured HTML
    const card = sandbox.UI.sessionCard({ id: 'x', subject: '<b>Math</b>', topic: 'Algebra', kind: 'study', difficulty: 'Hard', start: '09:00', end: '09:50', durationMins: 50, status: 'pending' });
    ok(card.indexOf('&lt;b&gt;Math&lt;/b&gt;') !== -1, 'sessionCard escapes user HTML (XSS-safe)');
    ok(sandbox.UI.progress(50).indexOf('width:50%') !== -1, 'progress renders width');
    ok(sandbox.UI.ring(75).indexOf('75%') !== -1, 'ring renders percent');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
});

function iso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 864e5).toISOString().slice(0, 10);
}
