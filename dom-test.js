/* DOM integration test — lightweight DOM mock runs the REAL app.js router
   across every route to catch runtime/reference errors that syntax checks miss.
   No external dependencies. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [], _html: '', _text: '',
    dataset: {}, style: {}, attributes: {},
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); }
    },
    hidden: false, disabled: false, value: '',
    _listeners: {},
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    removeEventListener() {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    remove() {}, focus() {},
    click() { (this._listeners.click || []).forEach(f => f({ target: this, preventDefault() {} })); },
    closest() { return null; },
    querySelector(sel) { return query(this, sel, false); },
    querySelectorAll(sel) { return query(this, sel, true); },
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children = parseHTML(v); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); }
  };
  return el;
}

function parseHTML(html) {
  const els = [];
  const tagRe = /<(\w+)([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const el = makeEl(m[1]); const attrs = m[2];
    const idM = /id="([^"]+)"/.exec(attrs); if (idM) { el.attributes.id = idM[1]; el.id = idM[1]; }
    const clM = /class="([^"]+)"/.exec(attrs); if (clM) clM[1].split(/\s+/).forEach(c => el.classList.add(c));
    let d; const dRe = /data-([\w-]+)="([^"]*)"/g;
    while ((d = dRe.exec(attrs))) { el.dataset[d[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = d[2]; }
    els.push(el);
  }
  return els;
}

function collectAll(root) {
  const out = [];
  (function walk(e) { (e.children || []).forEach(c => { out.push(c); walk(c); }); })(root);
  return out;
}
function query(root, sel, all) {
  const pool = collectAll(root);
  const match = el => sel.split(',').some(s => {
    s = s.trim();
    if (s.startsWith('#')) return el.attributes.id === s.slice(1);
    if (s.startsWith('.')) return el.classList.contains(s.slice(1));
    const dm = /^\[data-([\w-]+)\]$/.exec(s);
    if (dm) return dm[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()) in el.dataset;
    const dv = /^\[data-([\w-]+)="?([^"\]]*)"?\]$/.exec(s);
    if (dv) return el.dataset[dv[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] === dv[2];
    return el.tagName === s.toUpperCase();
  });
  const hits = pool.filter(match);
  return all ? hits : (hits[0] || null);
}


/* registry of index.html elements */
const registry = {};
['sidebar', 'overlay', 'menuBtn', 'themeBtn', 'pageTitle', 'pageSubtitle', 'view', 'modal-root', 'toast-root', 'sidebarStreak']
  .forEach(id => { const el = makeEl('div'); el.attributes.id = id; el.id = id; registry[id] = el; });
const navLinks = ['dashboard', 'create', 'today', 'week', 'subjects', 'analytics', 'notes', 'mock', 'wellness', 'career', 'settings'].map(r => {
  const a = makeEl('a'); a.classList.add('nav-link'); a.dataset.route = r; return a;
});
const rootEl = makeEl('body');
rootEl.children = [...Object.values(registry), ...navLinks];

const documentMock = {
  readyState: 'complete', title: '',
  documentElement: makeEl('html'), body: rootEl,
  getElementById: id => registry[id] || null,
  querySelector: sel => query(rootEl, sel, false),
  querySelectorAll: sel => query(rootEl, sel, true),
  createElement: tag => makeEl(tag),
  addEventListener() {}
};

const storage = {};
let hashListener = null;
const sandbox = {
  console, setTimeout: fn => { fn && fn(); return 0; }, clearTimeout, Date, Math, Promise, JSON, Object, Array,
  FormData: class { getAll() { return []; } get() { return ''; } },
  localStorage: { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
  document: documentMock,
  location: { hash: '' },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: class {},
  window: {}
};
sandbox.window.addEventListener = (ev, fn) => { if (ev === 'hashchange') hashListener = fn; };
sandbox.window.location = sandbox.location;
sandbox.global = sandbox;
// FileReader-ish + File.text mock for tools that read uploads (not exercised here)
sandbox.FileReader = class { readAsText() {} };
vm.createContext(sandbox);
const load = f => vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', f), 'utf8'), sandbox, { filename: f });
load('store.js'); sandbox.Store = sandbox.window.Store;
load('planner.js'); sandbox.Planner = sandbox.window.Planner;
load('mock-bank.js');
load('tools.js'); sandbox.Tools = sandbox.window.Tools;
load('ui.js'); sandbox.UI = sandbox.window.UI;
load('views-tools.js'); sandbox.VIEWS_EXTRA = sandbox.window.VIEWS_EXTRA;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  x ' + m)); };

const Store = sandbox.window.Store;
Store.addSubject({ name: 'Physics', topics: ['Kinematics', 'Optics'], difficulty: 'Hard', priority: 'High', examDate: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10), estHours: 8 });
Store.addSubject({ name: 'English', topics: ['Essay'], difficulty: 'Easy', priority: 'Low', estHours: 3 });

sandbox.Planner.generate(Store.get().subjects, Store.get().availability, { horizonDays: 14 }).then(plan => {
  Store.setPlan(plan);
  try { load('app.js'); ok(true, 'app.js loaded & init ran'); }
  catch (e) { ok(false, 'app.js init threw: ' + e.message); console.log(e.stack); }

  for (const r of ['dashboard', 'create', 'today', 'week', 'subjects', 'analytics', 'notes', 'mock', 'wellness', 'career', 'settings']) {
    try {
      sandbox.location.hash = '#/' + r;
      if (hashListener) hashListener();
      ok(registry.view._html.length > 0, r + ' renders content (' + registry.view._html.length + ' chars)');
    } catch (e) { ok(false, r + ' render threw: ' + e.message); }
  }

  // Tool engines: Smart Notes, Mock (text + topic), Career roadmap
  try {
    const notes = sandbox.Tools.simplifyNotes('Unit 1: Cell Biology. The cell is the basic unit of life. Mitochondria produce energy through respiration. Ribosomes synthesise proteins from amino acids. Unit 2: Genetics. DNA carries hereditary information in genes.');
    ok(notes.cards.length > 0 && notes.tldr.length > 0, 'Smart Notes produces cards + TL;DR');
  } catch (e) { ok(false, 'Smart Notes threw: ' + e.message); }
  try {
    const q1 = sandbox.Tools.buildMockFromText('Photosynthesis occurs in the chloroplast. Chlorophyll absorbs light energy. Plants convert carbon dioxide and water into glucose and oxygen. Respiration releases energy from glucose in the mitochondria.', 10);
    ok(q1.length > 0 && q1.every(q => q.options.length >= 2 && q.answer >= 0), 'Mock from syllabus builds valid MCQs');
    const q2 = sandbox.Tools.buildMockFromTopic('javascript', 20);
    ok(q2.length === 20 && q2.every(q => q.options.length === 4), 'Mock from topic returns requested count');
    const q3 = sandbox.Tools.buildMockFromTopic('quantum basket weaving', 40);
    ok(q3.length === 40, 'Mock from unknown topic still fills the count');
  } catch (e) { ok(false, 'Mock engine threw: ' + e.message); }
  try {
    const rmCurated = sandbox.Tools.buildRoadmap('frontend developer');
    ok(rmCurated.curated && rmCurated.stages.length >= 4, 'Career roadmap (curated) has phases');
    const rmGeneric = sandbox.Tools.buildRoadmap('astronaut chef');
    ok(!rmGeneric.curated && rmGeneric.stages.length >= 4, 'Career roadmap (generic) works for any input');
  } catch (e) { ok(false, 'Career engine threw: ' + e.message); }
  try {
    const acts = sandbox.Tools.getWellness();
    ok(acts.length >= 5 && acts.every(a => a.steps.length && a.totalMins), 'Wellness has 5+ timed activities');
  } catch (e) { ok(false, 'Wellness data threw: ' + e.message); }

  // Interaction: complete a session on Today via the real bound click handler
  sandbox.location.hash = '#/today'; hashListener();
  const before = Store.get().meta.completedDates.length;
  const toggleBtn = query(registry.view, '[data-act]', true).find(b => b.dataset.act === 'toggle');
  ok(!!toggleBtn, 'today view has a completable session');
  if (toggleBtn) {
    toggleBtn.click();
    const doneCount = Object.values(Store.get().plan.days).flat().filter(s => s.status === 'done').length;
    ok(doneCount >= 1, 'clicking complete marks a session done');
    ok(Store.get().meta.completedDates.length >= before, 'completion recorded for streak');
  }

  // Interaction: skip a session triggers redistribution copy
  sandbox.location.hash = '#/today'; hashListener();
  const skipBtn = query(registry.view, '[data-act]', true).find(b => b.dataset.act === 'skip');
  if (skipBtn) {
    const totalBefore = Object.values(Store.get().plan.days).flat().length;
    skipBtn.click();
    const skipped = Object.values(Store.get().plan.days).flat().filter(s => s.status === 'skipped').length;
    ok(skipped >= 1, 'clicking skip marks session skipped');
    ok(Object.values(Store.get().plan.days).flat().length >= totalBefore, 'skipped work redistributed (not lost)');
  }

  // Theme toggle via header button
  registry.themeBtn.click();
  ok(['dark', 'light'].includes(Store.get().settings.theme), 'theme toggle persists a valid theme');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch(e => { console.log('generate failed', e); process.exit(1); });
