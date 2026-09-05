/* ===== app.js — router, views, and interaction wiring ===== */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const { esc, icon, toast, modal, closeModal, confirm } = UI;
  const H = Planner.helpers;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const ROUTES = {
    dashboard: { title: 'Dashboard', sub: 'Your study overview at a glance', icon: 'dashboard', label: 'Dashboard' },
    create: { title: 'Create Study Plan', sub: 'Generate a smart schedule from your subjects', icon: 'sparkle', label: 'Create Plan' },
    today: { title: "Today's Schedule", sub: 'Focus on what matters right now', icon: 'clock', label: 'Today' },
    week: { title: 'Weekly Schedule', sub: 'Your plan for the days ahead', icon: 'week', label: 'This Week' },
    subjects: { title: 'Subjects', sub: 'Manage subjects, topics and exams', icon: 'book', label: 'Subjects' },
    analytics: { title: 'Progress & Analytics', sub: 'Track your momentum', icon: 'chart', label: 'Analytics' },
    notes: { title: 'Smart Notes', sub: 'Turn any syllabus into short, clear notes', icon: 'notes', label: 'Smart Notes' },
    mock: { title: 'Mock Test', sub: 'Generate MCQ practice tests instantly', icon: 'quiz', label: 'Mock Test' },
    wellness: { title: 'Mental Wellness', sub: 'Guided breaks to reset and refocus', icon: 'heart', label: 'Wellness' },
    career: { title: 'Career Roadmap', sub: 'A visual path to your dream career', icon: 'route', label: 'Career Roadmap' },
    settings: { title: 'Settings', sub: 'Preferences and data', icon: 'settings', label: 'Settings' }
  };

  /* ---------- date helpers ---------- */
  const todayISO = () => Store.todayISO();
  const fmtDate = iso => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const daysUntil = iso => Math.ceil((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 864e5);

  /* ---------- schedule stats ---------- */
  function planStats() {
    const st = Store.get();
    const plan = st.plan;
    const out = { total: 0, done: 0, skipped: 0, pending: 0, todayTotal: 0, todayDone: 0, todayMins: 0, doneMins: 0, plannedMins: 0, weekTotal: 0, weekDone: 0 };
    if (!plan) return out;
    const t = todayISO();
    const weekEnd = H.iso(H.addDays(new Date(t + 'T00:00:00'), 7));
    Object.keys(plan.days).forEach(d => {
      plan.days[d].forEach(s => {
        out.total++;
        out.plannedMins += s.durationMins || 0;
        if (s.status === 'done') { out.done++; out.doneMins += s.durationMins || 0; }
        else if (s.status === 'skipped') out.skipped++;
        else out.pending++;
        if (d === t) {
          out.todayTotal++; out.todayMins += s.durationMins || 0;
          if (s.status === 'done') out.todayDone++;
        }
        if (d >= t && d < weekEnd) { out.weekTotal++; if (s.status === 'done') out.weekDone++; }
      });
    });
    return out;
  }

  function subjectProgress(subj) {
    const total = subj.topics.length;
    if (!total) return 0;
    return (subj.topics.filter(t => t.done).length / total) * 100;
  }

  /* ---------- router ---------- */
  function currentRoute() {
    const hash = location.hash.replace('#/', '') || 'dashboard';
    return ROUTES[hash] ? hash : 'dashboard';
  }

  function render() {
    const route = currentRoute();
    const meta = ROUTES[route];
    $('#pageTitle').textContent = meta.title;
    $('#pageSubtitle').textContent = meta.sub;
    document.title = 'Focus — ' + meta.label;
    $$('.nav-link').forEach(a => {
      const active = a.dataset.route === route;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const view = $('#view');
    view.innerHTML = '';
    const extra = window.VIEWS_EXTRA || {};
    (VIEWS[route] || extra[route] || VIEWS.dashboard)(view);
    view.focus();
    closeSidebar();
  }

  /* ---------- nav labels ---------- */
  function buildNav() {
    $$('.nav-link').forEach(a => {
      const r = ROUTES[a.dataset.route];
      if (r) a.innerHTML = icon(r.icon) + '<span>' + r.label + '</span>';
    });
  }

  /* ================= VIEWS ================= */
  const VIEWS = {};

  /* ---------- Dashboard ---------- */
  VIEWS.dashboard = function (view) {
    const st = Store.get();
    if (!st.subjects.length) {
      view.innerHTML = landingHero();
      return;
    }
    const s = planStats();
    const upcoming = st.subjects
      .filter(x => x.examDate && daysUntil(x.examDate) >= 0)
      .sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate));
    const nextSession = getNextSession();
    const weekPct = s.weekTotal ? (s.weekDone / s.weekTotal) * 100 : 0;
    const overall = overallProgress();

    view.innerHTML =
      '<div class="grid stats-grid section">' +
        UI.statCard({ label: "Today's study", value: fmtHours(s.todayMins), icon: 'clock', tone: 'tone-indigo' }) +
        UI.statCard({ label: 'Sessions done', value: s.todayDone + '/' + s.todayTotal, icon: 'check', tone: 'tone-green' }) +
        UI.statCard({ label: 'Current streak', value: st.meta.streak + (st.meta.streak === 1 ? ' day' : ' days'), icon: 'flame', tone: 'tone-amber' }) +
        UI.statCard({ label: 'Upcoming exams', value: upcoming.length, icon: 'target', tone: 'tone-blue' }) +
      '</div>' +
      '<div class="grid cols-3 section">' +
        '<div class="card card-pad" style="grid-column:span 2">' +
          '<div class="section-head"><h2>Next up</h2>' +
            '<a class="btn btn-soft btn-sm" href="#/today">View today ' + icon('arrow') + '</a></div>' +
          (nextSession ? UI.sessionCard(nextSession.session, { actions: false }) +
            '<p class="mini-stat mt-8">Scheduled for ' + (nextSession.date === todayISO() ? 'today' : fmtDate(nextSession.date)) + '</p>'
            : '<div class="callout info">' + icon('info') + '<span>No pending sessions. Enjoy the break or generate a fresh plan.</span></div>') +
        '</div>' +
        '<div class="card card-pad center-col">' +
          '<h2 style="font-size:15px;align-self:flex-start">Overall progress</h2>' +
          UI.ring(overall, 'topics done') +
          '<p class="mini-stat">' + s.done + ' of ' + s.total + ' sessions complete</p>' +
        '</div>' +
      '</div>' +
      '<div class="grid cols-2 section">' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Weekly completion</h2>' +
            '<span class="sub">' + Math.round(weekPct) + '%</span></div>' +
          UI.progress(weekPct, weekPct >= 70 ? 'tone-green' : '') +
          '<p class="mini-stat mt-8"><b>' + s.weekDone + '</b> of <b>' + s.weekTotal + '</b> planned sessions done this week</p>' +
        '</div>' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Upcoming exams</h2>' +
            '<a class="btn btn-soft btn-sm" href="#/subjects">Manage ' + icon('arrow') + '</a></div>' +
            examList(upcoming) +
        '</div>' +
      '</div>';

    bindSessionActions(view);
  };

  function examList(upcoming) {
    if (!upcoming.length) return '<div class="callout info">' + icon('info') + '<span>No exams scheduled. Add exam dates to your subjects for smarter planning.</span></div>';
    return '<div class="grid" style="gap:10px">' + upcoming.slice(0, 4).map(x => {
      const d = daysUntil(x.examDate);
      const tone = d <= 3 ? 'b-hard' : d <= 7 ? 'b-medium' : 'b-info';
      return '<div class="util-row"><div><b style="font-size:14px">' + esc(x.name) + '</b>' +
        '<div class="mini-stat">' + fmtDate(x.examDate) + '</div></div><span class="spacer"></span>' +
        UI.badge(d === 0 ? 'Today' : d + (d === 1 ? ' day' : ' days'), tone) + '</div>';
    }).join('') + '</div>';
  }


  /* ---------- shared helpers ---------- */
  function fmtHours(mins) {
    if (!mins) return '0h';
    const h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + 'h' : '') + (m ? ' ' + m + 'm' : (h ? '' : '0h'));
  }
  function overallProgress() {
    const subs = Store.get().subjects;
    let total = 0, done = 0;
    subs.forEach(s => { total += s.topics.length; done += s.topics.filter(t => t.done).length; });
    return total ? (done / total) * 100 : 0;
  }
  function getNextSession() {
    const plan = Store.get().plan;
    if (!plan) return null;
    const t = todayISO();
    const dates = Object.keys(plan.days).filter(d => d >= t).sort();
    for (const d of dates) {
      const pend = plan.days[d].filter(s => s.status === 'pending').sort((a, b) => a.start.localeCompare(b.start));
      if (pend.length) return { session: pend[0], date: d };
    }
    return null;
  }

  function landingHero() {
    return '<section class="hero fade-in">' +
      '<span class="hero-badge">' + icon('sparkle') + ' AI-powered study planning</span>' +
      '<h2>Turn your subjects, exams and free time into a schedule that actually works.</h2>' +
      '<p>Focus builds a smart daily and weekly plan around exam deadlines, difficulty and priority — then adapts when life gets in the way.</p>' +
      '<div class="hero-actions">' +
        '<a class="btn btn-primary btn-lg" href="#/create" data-start>' + icon('sparkle') + ' Create your first plan</a>' +
        '<a class="btn btn-ghost btn-lg" href="#/subjects">Add subjects</a>' +
      '</div>' +
      '<div class="grid feat-grid mt-16">' +
        feat('target', 'Deadline-aware', 'Sessions are prioritised by exam proximity, priority and difficulty.') +
        feat('clock', 'Fits your time', 'Respects your available hours, session length and breaks — never overloads a day.') +
        feat('trend', 'Adapts to you', 'Miss a session? It intelligently redistributes work into your free time.') +
      '</div>' +
    '</section>';
  }
  const feat = (ic, t, p) => '<div class="card feat"><div class="feat-ico">' + icon(ic) + '</div><h4>' + t + '</h4><p>' + p + '</p></div>';

  /* ---------- Subjects ---------- */
  VIEWS.subjects = function (view) {
    const subs = Store.get().subjects;
    const head = '<div class="section-head"><div><h2>Your subjects</h2>' +
      '<span class="sub">' + subs.length + ' subject' + (subs.length === 1 ? '' : 's') + '</span></div>' +
      '<button class="btn btn-primary btn-sm" data-add-subject>' + icon('plus') + ' Add subject</button></div>';

    if (!subs.length) {
      view.innerHTML = head + UI.empty({
        icon: 'book', title: 'No subjects yet',
        text: 'Add your first subject with its topics, difficulty, priority and exam date to start planning.',
        actionHtml: '<button class="btn btn-primary" data-add-subject>' + icon('plus') + ' Add subject</button>'
      });
      wireSubjects(view);
      return;
    }

    const cards = subs.map(s => {
      const prog = subjectProgress(s);
      const remaining = Planner.remainingTopics(s).length;
      const dU = s.examDate ? daysUntil(s.examDate) : null;
      const examBadge = s.examDate
        ? UI.badge((dU < 0 ? 'Exam passed' : dU === 0 ? 'Exam today' : dU + 'd to exam'), dU !== null && dU <= 3 ? 'b-hard' : 'b-info')
        : '';
      const topics = s.topics.length
        ? '<div class="subj-topics">' + s.topics.slice(0, 12).map(t =>
            '<button type="button" class="topic-pill' + (t.done ? ' done' : '') + '" data-topic="' + t.id + '" data-subj="' + s.id + '" aria-pressed="' + t.done + '" title="Toggle topic complete">' + esc(t.name) + '</button>').join('') +
            (s.topics.length > 12 ? '<span class="topic-pill">+' + (s.topics.length - 12) + '</span>' : '') + '</div>'
        : '<p class="mini-stat">No topics added</p>';
      return '<div class="card subj-card fade-in">' +
        '<div class="subj-top"><div>' +
          '<div class="subj-name">' + esc(s.name) + '</div>' +
          '<div class="subj-meta">' +
            UI.badge(s.difficulty, { Easy: 'b-easy', Medium: 'b-medium', Hard: 'b-hard' }[s.difficulty]) +
            UI.badge(s.priority + ' priority', { Low: 'b-low', Medium: 'b-med', High: 'b-high' }[s.priority]) +
            examBadge +
          '</div>' +
        '</div></div>' +
        topics +
        '<div><div class="util-row" style="margin-bottom:6px"><span class="mini-stat"><b>' + Math.round(prog) + '%</b> complete</span>' +
          '<span class="spacer"></span><span class="mini-stat">' + remaining + ' topic' + (remaining === 1 ? '' : 's') + ' left · ~' + s.estHours + 'h</span></div>' +
          UI.progress(prog, prog >= 100 ? 'tone-green' : '') + '</div>' +
        '<div class="subj-foot"><span class="mini-stat">' + s.topics.length + ' topics</span>' +
          '<div class="subj-actions">' +
            '<button class="btn btn-ghost btn-sm" data-edit-subject="' + s.id + '">' + icon('edit') + ' Edit</button>' +
            '<button class="icon-btn" data-del-subject="' + s.id + '" aria-label="Delete ' + esc(s.name) + '">' + icon('trash') + '</button>' +
          '</div></div>' +
      '</div>';
    }).join('');

    view.innerHTML = head + '<div class="grid cols-2">' + cards + '</div>';
    wireSubjects(view);
  };

  function wireSubjects(view) {
    $$('[data-add-subject]', view).forEach(b => b.addEventListener('click', () => subjectModal()));
    $$('[data-edit-subject]', view).forEach(b => b.addEventListener('click', () => subjectModal(b.dataset.editSubject)));
    $$('[data-topic]', view).forEach(b => b.addEventListener('click', () => {
      Store.toggleTopic(b.dataset.subj, b.dataset.topic);
      render();
    }));
    $$('[data-del-subject]', view).forEach(b => b.addEventListener('click', async () => {
      const s = Store.get().subjects.find(x => x.id === b.dataset.delSubject);
      if (await confirm({ title: 'Delete subject?', message: 'Delete "' + s.name + '" and remove it from your plan? This cannot be undone.', confirmText: 'Delete', danger: true })) {
        Store.deleteSubject(b.dataset.delSubject);
        toast('Subject deleted', 'ok');
      }
    }));
  }

  /* ---------- Subject add/edit modal ---------- */
  function subjectModal(id) {
    const editing = id ? Store.get().subjects.find(s => s.id === id) : null;
    const seg = (name, opts, val) => '<div class="seg" role="group" aria-label="' + name + '">' +
      opts.map(o => '<button type="button" data-seg="' + name + '" data-val="' + o + '" aria-pressed="' + (o === val) + '">' + o + '</button>').join('') + '</div>';

    const body =
      '<form id="subjForm" class="form-grid" novalidate>' +
        '<div class="field"><label for="f-name">Subject name</label>' +
          '<input class="input" id="f-name" name="name" required maxlength="60" placeholder="e.g. Organic Chemistry" value="' + esc(editing ? editing.name : '') + '">' +
          '<span class="field-err" data-err="name" hidden></span></div>' +
        '<div class="field"><label for="f-topics">Topics <span class="hint">(comma or new line separated)</span></label>' +
          '<textarea class="textarea" id="f-topics" name="topics" placeholder="Alkanes, Alkenes, Reaction mechanisms">' +
            esc(editing ? editing.topics.map(t => t.name).join(', ') : '') + '</textarea></div>' +
        '<div class="grid cols-2" style="gap:14px">' +
          '<div class="field"><label>Difficulty</label>' + seg('difficulty', ['Easy', 'Medium', 'Hard'], editing ? editing.difficulty : 'Medium') + '</div>' +
          '<div class="field"><label>Priority</label>' + seg('priority', ['Low', 'Medium', 'High'], editing ? editing.priority : 'Medium') + '</div>' +
        '</div>' +
        '<div class="grid cols-2" style="gap:14px">' +
          '<div class="field"><label for="f-exam">Exam date <span class="hint">(optional)</span></label>' +
            '<input class="input" id="f-exam" name="examDate" type="date" value="' + (editing ? editing.examDate : '') + '">' +
            '<span class="field-err" data-err="examDate" hidden></span></div>' +
          '<div class="field"><label for="f-hours">Est. study hours</label>' +
            '<input class="input" id="f-hours" name="estHours" type="number" min="0" max="500" step="0.5" placeholder="10" value="' + (editing ? editing.estHours : '') + '">' +
            '<span class="field-err" data-err="estHours" hidden></span></div>' +
        '</div>' +
      '</form>';

    const footer = '<button class="btn btn-ghost" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="saveSubj">' + icon('check') + (editing ? ' Save changes' : ' Add subject') + '</button>';

    modal({
      title: editing ? 'Edit subject' : 'Add subject', body, footer, size: 560,
      onMount(root) {
        const form = $('#subjForm', root);
        form.querySelectorAll('[data-seg]').forEach(btn => btn.addEventListener('click', () => {
          form.querySelectorAll('[data-seg="' + btn.dataset.seg + '"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
          btn.setAttribute('aria-pressed', 'true');
        }));
        const getSeg = name => { const b = form.querySelector('[data-seg="' + name + '"][aria-pressed="true"]'); return b ? b.dataset.val : 'Medium'; };
        form.addEventListener('submit', e => { e.preventDefault(); $('#saveSubj', root).click(); });

        $('#saveSubj', root).addEventListener('click', () => {
          clearErrors(form);
          const fd = new FormData(form);
          const name = (fd.get('name') || '').toString().trim();
          const examDate = (fd.get('examDate') || '').toString();
          const estHours = parseFloat(fd.get('estHours')) || 0;
          const topics = (fd.get('topics') || '').toString().split(/[,\n]/).map(t => t.trim()).filter(Boolean);
          let ok = true;
          if (!name) { showErr(form, 'name', 'Subject name is required.'); ok = false; }
          if (examDate && daysUntil(examDate) < 0) { showErr(form, 'examDate', 'Exam date is in the past.'); ok = false; }
          if (estHours < 0 || estHours > 500) { showErr(form, 'estHours', 'Enter a value between 0 and 500.'); ok = false; }
          if (!ok) return;

          const payload = { name, examDate, estHours, difficulty: getSeg('difficulty'), priority: getSeg('priority') };
          if (editing) {
            // preserve done state of existing topics by name
            const prev = {}; editing.topics.forEach(t => prev[t.name] = t.done);
            payload.topics = topics.map(n => ({ name: n, done: !!prev[n] }));
            Store.updateSubject(editing.id, payload);
            toast('Subject updated', 'ok');
          } else {
            payload.topics = topics;
            Store.addSubject(payload);
            toast('Subject added', 'ok');
          }
          closeModal();
        });
      }
    });
  }

  function showErr(form, field, msg) {
    const el = form.querySelector('[data-err="' + field + '"]');
    const input = form.querySelector('[name="' + field + '"]');
    if (el) { el.textContent = msg; el.hidden = false; }
    if (input) input.classList.add('invalid');
  }
  function clearErrors(form) {
    form.querySelectorAll('.field-err').forEach(e => { e.hidden = true; });
    form.querySelectorAll('.invalid').forEach(e => e.classList.remove('invalid'));
  }

  /* ---------- Create Plan (availability + generate) ---------- */
  VIEWS.create = function (view) {
    const st = Store.get();
    const a = st.availability;
    if (!st.subjects.length) {
      view.innerHTML = UI.empty({
        icon: 'book', title: 'Add subjects first',
        text: 'The planner needs at least one subject with topics or study hours before it can build a schedule.',
        actionHtml: '<a class="btn btn-primary" href="#/subjects">' + icon('plus') + ' Add subjects</a>'
      });
      return;
    }
    const dayChips = DAY_NAMES.map((d, i) =>
      '<label class="chip-check"><input type="checkbox" name="day" value="' + i + '"' + (a.days.includes(i) ? ' checked' : '') + '>' +
      '<span>' + d + '</span></label>').join('');

    view.innerHTML =
      '<div class="grid cols-3" style="align-items:start">' +
        '<div class="card card-pad" style="grid-column:span 2">' +
          '<div class="section-head"><h2>Availability</h2><span class="sub">Tell the planner when you can study</span></div>' +
          '<form id="availForm" class="form-grid">' +
            '<div class="grid cols-2" style="gap:14px">' +
              '<div class="field"><label for="a-hours">Study hours per day</label>' +
                '<input class="input" id="a-hours" name="hoursPerDay" type="number" min="0.5" max="16" step="0.5" value="' + a.hoursPerDay + '"><span class="field-err" data-err="hoursPerDay" hidden></span></div>' +
              '<div class="field"><label for="a-session">Session length (min)</label>' +
                '<input class="input" id="a-session" name="sessionMins" type="number" min="15" max="180" step="5" value="' + a.sessionMins + '"></div>' +
            '</div>' +
            '<div class="grid cols-2" style="gap:14px">' +
              '<div class="field"><label for="a-start">Preferred start</label>' +
                '<input class="input" id="a-start" name="startTime" type="time" value="' + a.startTime + '"></div>' +
              '<div class="field"><label for="a-end">Preferred end</label>' +
                '<input class="input" id="a-end" name="endTime" type="time" value="' + a.endTime + '"><span class="field-err" data-err="endTime" hidden></span></div>' +
            '</div>' +
            '<div class="field"><label for="a-break">Break between sessions (min)</label>' +
              '<input class="input" id="a-break" name="breakMins" type="number" min="0" max="60" step="5" value="' + a.breakMins + '" style="max-width:160px"></div>' +
            '<div class="field"><label>Study days</label><div class="checkline">' + dayChips + '</div>' +
              '<span class="field-err" data-err="days" hidden></span></div>' +
          '</form>' +
        '</div>' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Summary</h2></div>' +
          '<div id="planSummary"></div>' +
          '<label class="util-row mt-16" style="cursor:pointer;gap:8px"><input type="checkbox" id="a-horizon-week"> <span class="mini-stat">Plan one week only (default 2 weeks)</span></label>' +
          '<button class="btn btn-primary btn-block btn-lg mt-16" id="genBtn">' + icon('sparkle') + ' Generate plan</button>' +
          '<p class="mini-stat mt-8" style="text-align:center">' + (window.STUDY_AI_ENDPOINT ? 'Using AI planning service' : 'Using built-in smart planner') + '</p>' +
        '</div>' +
      '</div>';

    const form = $('#availForm', view);
    const refreshSummary = () => { $('#planSummary', view).innerHTML = summaryHtml(readAvail(form)); };
    refreshSummary();
    form.addEventListener('input', () => { persistAvail(form); refreshSummary(); });
    form.addEventListener('change', () => { persistAvail(form); refreshSummary(); });
    $('#genBtn', view).addEventListener('click', () => runGenerate(view, $('#a-horizon-week', view).checked ? 7 : 14));
  };

  function readAvail(form) {
    const fd = new FormData(form);
    const days = fd.getAll('day').map(Number);
    return {
      hoursPerDay: parseFloat(fd.get('hoursPerDay')) || 0,
      sessionMins: parseInt(fd.get('sessionMins')) || 50,
      startTime: fd.get('startTime') || '09:00',
      endTime: fd.get('endTime') || '21:00',
      breakMins: parseInt(fd.get('breakMins')) || 0,
      days
    };
  }
  function persistAvail(form) { Store.setAvailability(readAvail(form)); }

  function summaryHtml(a) {
    const subs = Store.get().subjects;
    const totalNeeded = subs.reduce((sum, s) => sum + Planner.neededMinutes(s), 0);
    const slots = Planner.daySlots(a).length;
    const dailyMins = slots * a.sessionMins;
    return '<div class="grid" style="gap:10px">' +
      row('Subjects', subs.length) +
      row('Study days', a.days.length + '/week') +
      row('Sessions/day', slots) +
      row('Daily study', fmtHours(dailyMins)) +
      row('Total workload', fmtHours(totalNeeded)) +
    '</div>';
  }
  const row = (k, v) => '<div class="util-row"><span class="mini-stat">' + k + '</span><span class="spacer"></span><b style="font-size:13.5px">' + v + '</b></div>';

  async function runGenerate(view, horizon) {
    const btn = $('#genBtn', view);
    const a = Store.get().availability;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating…';
    try {
      const plan = await Planner.generate(Store.get().subjects, a, { horizonDays: horizon, reduceRevision: Store.get().settings.reduceRevision });
      if (plan.warning === 'no-study-days') throw new Planner.PlannerError('No study days available in range. Check your study days.', 'no-days');
      const count = Object.values(plan.days).reduce((n, d) => n + d.length, 0);
      if (!count) throw new Planner.PlannerError('Could not schedule any sessions. Add topics or increase study hours.', 'empty');
      Store.setPlan(plan);
      if (plan.fallback) toast('AI service unavailable — used built-in planner', 'warn');
      else toast(count + ' sessions scheduled', 'ok');
      location.hash = '#/today';
    } catch (err) {
      const msg = err instanceof Planner.PlannerError ? err.message : 'Something went wrong generating your plan.';
      toast(msg, 'err');
      btn.disabled = false;
      btn.innerHTML = icon('sparkle') + ' Generate plan';
    }
  }

  /* ---------- Today's schedule ---------- */
  VIEWS.today = function (view) {
    const plan = Store.get().plan;
    const t = todayISO();
    if (!plan) { view.innerHTML = noPlanEmpty(); return; }
    const list = (plan.days[t] || []).slice().sort((a, b) => a.start.localeCompare(b.start));
    const done = list.filter(s => s.status === 'done').length;
    const pct = list.length ? (done / list.length) * 100 : 0;

    let html = '<div class="card card-pad section"><div class="util-row">' +
      '<div><h2 style="font-size:16px">' + fmtDate(t) + '</h2>' +
        '<p class="mini-stat">' + done + ' of ' + list.length + ' sessions complete</p></div>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-sm" data-add-task>' + icon('plus') + ' Add task</button></div>' +
      '<div class="mt-16">' + UI.progress(pct, pct >= 100 ? 'tone-green' : '') + '</div></div>';

    if (!list.length) {
      html += UI.empty({ icon: 'check', title: 'Nothing scheduled today', text: 'You have no study sessions today. Add a custom task or check your weekly plan.',
        actionHtml: '<a class="btn btn-primary" href="#/week">View week</a>' });
    } else {
      html += '<div class="day-col">' + withBreaks(list) + '</div>';
    }
    view.innerHTML = html;
    bindSessionActions(view);
    $$('[data-add-task]', view).forEach(b => b.addEventListener('click', () => customTaskModal(t)));
  };

  /* ---------- Weekly schedule ---------- */
  VIEWS.week = function (view) {
    const plan = Store.get().plan;
    if (!plan) { view.innerHTML = noPlanEmpty(); return; }
    const t = todayISO();
    const start = new Date(t + 'T00:00:00');
    let cards = '';
    let any = false;
    for (let i = 0; i < 7; i++) {
      const d = H.iso(H.addDays(start, i));
      const list = (plan.days[d] || []).slice().sort((a, b) => a.start.localeCompare(b.start));
      if (list.length) any = true;
      const done = list.filter(s => s.status === 'done').length;
      cards += '<div class="card card-pad day-col">' +
        '<div class="day-head' + (d === t ? ' is-today' : '') + '">' +
          '<span class="d-name">' + (d === t ? 'Today' : DAY_FULL[new Date(d + "T00:00:00").getDay()]) + '</span>' +
          '<span class="d-meta">' + fmtDate(d) + ' · ' + done + '/' + list.length + '</span></div>' +
        (list.length ? list.map(s => UI.sessionCard(s)).join('')
          : '<p class="mini-stat" style="padding:8px 2px">No sessions</p>') +
      '</div>';
    }
    if (!any) { view.innerHTML = noPlanEmpty(); return; }
    view.innerHTML = '<div class="grid cols-2">' + cards + '</div>';
    bindSessionActions(view);
  };

  function withBreaks(list) {
    let html = '';
    list.forEach((s, i) => {
      html += UI.sessionCard(s);
      const next = list[i + 1];
      if (next && s.status !== 'skipped') {
        const gap = H.clockToMin(next.start) - H.clockToMin(s.end);
        if (gap > 0 && gap <= 60) html += '<div class="break-row">' + icon('clock') + ' ' + gap + ' min break</div>';
      }
    });
    return html;
  }

  function noPlanEmpty() {
    return UI.empty({
      icon: 'sparkle', title: 'No plan yet',
      text: 'Generate a study plan to see your schedule here. It only takes a moment.',
      actionHtml: '<a class="btn btn-primary" href="#/create">' + icon('sparkle') + ' Create study plan</a>'
    });
  }

  /* ---------- Session interactions ---------- */
  function bindSessionActions(view) {
    $$('[data-act]', view).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act === 'toggle') toggleSession(id);
        else if (act === 'skip') skipSession(id);
        else if (act === 'edit') editSessionModal(id);
      });
    });
  }

  function toggleSession(id) {
    const found = Store.getSession(id);
    if (!found) return;
    const nowDone = found.session.status !== 'done';
    Store.updateSession(id, { status: nowDone ? 'done' : 'pending' });
    if (nowDone) { Store.recordCompletion(); toast('Session complete — nice work!', 'ok'); }
    render();
  }

  async function skipSession(id) {
    const found = Store.getSession(id);
    if (!found) return;
    Store.updateSession(id, { status: 'skipped' });
    const slot = Planner.redistribute(Store.get().plan, found.session, Store.get().availability);
    if (slot) {
      const copy = { ...found.session, id: Store.uid(), status: 'pending', rescheduled: true, start: slot.start, end: slot.end };
      Store.addCustomSession(slot.date, copy);
      toast('Session skipped — moved to ' + fmtDate(slot.date), 'warn');
    } else {
      toast('Session skipped — no free slot to reschedule into', 'warn');
    }
    render();
  }

  function availableDates(n) {
    const out = [];
    const start = new Date(todayISO() + 'T00:00:00');
    const days = Store.get().availability.days;
    for (let i = 0; i < n * 2 && out.length < n; i++) {
      const d = H.addDays(start, i);
      if (days.includes(d.getDay())) out.push(H.iso(d));
    }
    if (!out.includes(todayISO())) out.unshift(todayISO());
    return out;
  }

  function editSessionModal(id) {
    const found = Store.getSession(id);
    if (!found) return;
    const s = found.session;
    const futureDays = availableDates(14);
    const dateOpts = futureDays.map(d => '<option value="' + d + '"' + (d === found.date ? ' selected' : '') + '>' +
      (d === todayISO() ? 'Today · ' : '') + fmtDate(d) + '</option>').join('');

    const body = '<form id="sessForm" class="form-grid">' +
      '<div class="field"><label for="s-title">Title</label>' +
        '<input class="input" id="s-title" name="subject" value="' + esc(s.subject) + '" required></div>' +
      '<div class="field"><label for="s-topic">Topic / note</label>' +
        '<input class="input" id="s-topic" name="topic" value="' + esc(s.topic || '') + '"></div>' +
      '<div class="grid cols-2" style="gap:14px">' +
        '<div class="field"><label for="s-date">Day</label><select class="select" id="s-date" name="date">' + dateOpts + '</select></div>' +
        '<div class="field"><label for="s-dur">Duration (min)</label>' +
          '<input class="input" id="s-dur" name="dur" type="number" min="10" max="240" step="5" value="' + (s.durationMins || 50) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="s-start">Start time</label>' +
        '<input class="input" id="s-start" name="start" type="time" value="' + s.start + '" style="max-width:180px"></div>' +
    '</form>';

    const footer = '<button class="btn btn-danger" id="delSess">' + icon('trash') + ' Remove</button>' +
      '<span class="spacer"></span><button class="btn btn-ghost" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="saveSess">' + icon('check') + ' Save</button>';

    modal({
      title: 'Edit session', body, footer, size: 520,
      onMount(root) {
        $('#delSess', root).addEventListener('click', async () => {
          closeModal();
          if (await confirm({ title: 'Remove session?', message: 'This session will be removed from your plan.', confirmText: 'Remove', danger: true })) {
            Store.removeSession(id); toast('Session removed', 'ok'); render();
          }
        });
        $('#saveSess', root).addEventListener('click', () => {
          const f = $('#sessForm', root);
          const fd = new FormData(f);
          const dur = parseInt(fd.get('dur')) || s.durationMins;
          const start = fd.get('start') || s.start;
          const end = H.minToClock(H.clockToMin(start) + dur);
          const newDate = fd.get('date');
          Store.updateSession(id, {
            subject: (fd.get('subject') || '').toString().trim() || s.subject,
            topic: (fd.get('topic') || '').toString().trim(),
            durationMins: dur, start, end
          });
          if (newDate !== found.date) Store.moveSession(id, newDate);
          closeModal();
          toast('Session updated', 'ok');
          render();
        });
      }
    });
  }

  function customTaskModal(date) {
    const body = '<form id="taskForm" class="form-grid">' +
      '<div class="field"><label for="t-title">Task title</label>' +
        '<input class="input" id="t-title" name="subject" required placeholder="e.g. Review lecture notes"><span class="field-err" data-err="subject" hidden></span></div>' +
      '<div class="field"><label for="t-topic">Note <span class="hint">(optional)</span></label>' +
        '<input class="input" id="t-topic" name="topic" placeholder="Details"></div>' +
      '<div class="grid cols-2" style="gap:14px">' +
        '<div class="field"><label for="t-start">Start time</label>' +
          '<input class="input" id="t-start" name="start" type="time" value="18:00"></div>' +
        '<div class="field"><label for="t-dur">Duration (min)</label>' +
          '<input class="input" id="t-dur" name="dur" type="number" min="10" max="240" step="5" value="45"></div>' +
      '</div></form>';
    const footer = '<button class="btn btn-ghost" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="saveTask">' + icon('plus') + ' Add task</button>';
    modal({
      title: 'Add custom task', body, footer, size: 480,
      onMount(root) {
        $('#saveTask', root).addEventListener('click', () => {
          const f = $('#taskForm', root);
          clearErrors(f);
          const fd = new FormData(f);
          const title = (fd.get('subject') || '').toString().trim();
          if (!title) { showErr(f, 'subject', 'Task title is required.'); return; }
          const dur = parseInt(fd.get('dur')) || 45;
          const start = fd.get('start') || '18:00';
          Store.addCustomSession(date, {
            subject: title, topic: (fd.get('topic') || '').toString().trim(),
            kind: 'study', start, end: H.minToClock(H.clockToMin(start) + dur), durationMins: dur
          });
          closeModal();
          toast('Task added', 'ok');
          render();
        });
      }
    });
  }

  /* ---------- Analytics ---------- */
  VIEWS.analytics = function (view) {
    const st = Store.get();
    if (!st.subjects.length) {
      view.innerHTML = UI.empty({ icon: 'chart', title: 'No data yet', text: 'Add subjects and generate a plan to see progress analytics.',
        actionHtml: '<a class="btn btn-primary" href="#/subjects">' + icon('plus') + ' Add subjects</a>' });
      return;
    }
    const s = planStats();
    const completion = s.total ? (s.done / s.total) * 100 : 0;
    const upcoming = st.subjects.filter(x => x.examDate && daysUntil(x.examDate) >= 0)
      .sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate));

    view.innerHTML =
      '<div class="grid stats-grid section">' +
        UI.statCard({ label: 'Completion rate', value: Math.round(completion) + '%', icon: 'target', tone: 'tone-indigo' }) +
        UI.statCard({ label: 'Sessions done', value: s.done + '/' + s.total, icon: 'check', tone: 'tone-green' }) +
        UI.statCard({ label: 'Study time logged', value: fmtHours(s.doneMins), icon: 'clock', tone: 'tone-blue' }) +
        UI.statCard({ label: 'Study streak', value: st.meta.streak + 'd', icon: 'flame', tone: 'tone-amber' }) +
      '</div>' +
      '<div class="grid cols-2 section">' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Weekly study hours</h2><span class="sub">planned vs done</span></div>' +
          weeklyBars() +
          '<div class="legend mt-16"><span><i style="background:var(--primary-100)"></i> Planned</span>' +
            '<span><i style="background:var(--primary)"></i> Completed</span></div>' +
        '</div>' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Exam countdown</h2></div>' +
          examList(upcoming) +
        '</div>' +
      '</div>' +
      '<div class="card card-pad section">' +
        '<div class="section-head"><h2>Subject progress</h2></div>' +
        subjectTable() +
      '</div>';
  };

  function weeklyBars() {
    const plan = Store.get().plan;
    const t = todayISO();
    const start = new Date(t + 'T00:00:00');
    let maxMins = 60;
    const cols = [];
    for (let i = 0; i < 7; i++) {
      const d = H.iso(H.addDays(start, i));
      const list = plan ? (plan.days[d] || []) : [];
      const planned = list.reduce((n, x) => n + (x.durationMins || 0), 0);
      const done = list.filter(x => x.status === 'done').reduce((n, x) => n + (x.durationMins || 0), 0);
      maxMins = Math.max(maxMins, planned);
      cols.push({ label: DAY_NAMES[new Date(d + 'T00:00:00').getDay()], planned, done });
    }
    return '<div class="bars">' + cols.map(c => {
      const ph = Math.round((c.planned / maxMins) * 100);
      const donePct = c.planned ? Math.round((c.done / c.planned) * 100) : 0;
      return '<div class="bar-col">' +
        '<span class="bar-val">' + (c.planned ? fmtHours(c.planned) : '') + '</span>' +
        '<div class="bar-track" style="position:relative">' +
          '<div class="bar-fill plan" style="height:' + ph + '%;position:relative">' +
            '<div class="bar-fill" style="height:' + donePct + '%;position:absolute;bottom:0;left:0;width:100%"></div>' +
          '</div>' +
        '</div>' +
        '<span class="bar-label">' + c.label + '</span></div>';
    }).join('') + '</div>';
  }

  function subjectTable() {
    const subs = Store.get().subjects;
    const rows = subs.map(s => {
      const prog = subjectProgress(s);
      const rem = Planner.remainingTopics(s).length;
      const dU = s.examDate ? daysUntil(s.examDate) : null;
      return '<tr><td><b>' + esc(s.name) + '</b></td>' +
        '<td>' + UI.badge(s.difficulty, { Easy: 'b-easy', Medium: 'b-medium', Hard: 'b-hard' }[s.difficulty]) + '</td>' +
        '<td>' + UI.badge(s.priority, { Low: 'b-low', Medium: 'b-med', High: 'b-high' }[s.priority]) + '</td>' +
        '<td class="num">' + rem + '/' + s.topics.length + '</td>' +
        '<td class="num">' + (dU === null ? '—' : dU < 0 ? 'past' : dU + 'd') + '</td>' +
        '<td style="min-width:120px">' + UI.progress(prog, prog >= 100 ? 'tone-green' : '') + '</td></tr>';
    }).join('');
    return '<div style="overflow-x:auto"><table class="table"><thead><tr>' +
      '<th>Subject</th><th>Difficulty</th><th>Priority</th><th class="num">Topics left</th><th class="num">Exam</th><th>Progress</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  /* ---------- Settings ---------- */
  VIEWS.settings = function (view) {
    const st = Store.get();
    view.innerHTML =
      '<div class="grid cols-2" style="align-items:start">' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Preferences</h2></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Appearance</label>' +
              '<div class="seg" role="group" aria-label="Theme">' +
                '<button type="button" data-theme-opt="light" aria-pressed="' + (st.settings.theme !== 'dark') + '">' + icon('sun') + ' Light</button>' +
                '<button type="button" data-theme-opt="dark" aria-pressed="' + (st.settings.theme === 'dark') + '">' + icon('moon') + ' Dark</button>' +
              '</div></div>' +
            '<div class="field"><label class="util-row" style="cursor:pointer;gap:10px">' +
              '<input type="checkbox" id="set-rev"' + (st.settings.reduceRevision ? ' checked' : '') + '>' +
              '<span><b style="font-size:13.5px;font-weight:600">Reduce revision sessions</b>' +
              '<div class="mini-stat">Focus more on new topics, fewer revision blocks</div></span></label></div>' +
          '</div>' +
        '</div>' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Data</h2></div>' +
          '<p class="mini-stat" style="margin-bottom:14px">Your data is stored locally in this browser. Export a backup or reset everything.</p>' +
          '<div class="form-grid">' +
            '<button class="btn btn-ghost btn-block" id="exportBtn">' + icon('arrow') + ' Export data (JSON)</button>' +
            '<button class="btn btn-danger btn-block" id="resetBtn">' + icon('trash') + ' Reset all data</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card card-pad section mt-16">' +
        '<div class="section-head"><h2>About the planner</h2></div>' +
        '<div class="callout info">' + icon('info') + '<span>' +
          (window.STUDY_AI_ENDPOINT ? 'Connected to an AI planning service. Your API key stays server-side.' :
          'No AI service is configured, so Focus uses a built-in deterministic planner that prioritises by exam proximity, priority, difficulty and remaining topics. To connect a real AI model, set <code>window.STUDY_AI_ENDPOINT</code> to a server route that returns structured schedule JSON.') +
        '</span></div>' +
      '</div>';

    $$('[data-theme-opt]', view).forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeOpt)));
    $('#set-rev', view).addEventListener('change', e => { Store.setSettings({ reduceRevision: e.target.checked }); toast('Preference saved', 'ok'); });
    $('#exportBtn', view).addEventListener('click', exportData);
    $('#resetBtn', view).addEventListener('click', async () => {
      if (await confirm({ title: 'Reset everything?', message: 'This permanently deletes all subjects, availability and your plan. This cannot be undone.', confirmText: 'Reset all', danger: true })) {
        Store.resetAll(); toast('All data reset', 'ok'); location.hash = '#/dashboard';
      }
    });
  };

  function exportData() {
    try {
      const blob = new Blob([Store.exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'focus-study-plan.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Data exported', 'ok');
    } catch (e) { toast('Export failed', 'err'); }
  }

  /* ---------- Theme ---------- */
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    Store.setSettings({ theme });
    updateThemeBtn();
    if (currentRoute() === 'settings') render();
  }
  function updateThemeBtn() {
    const dark = Store.get().settings.theme === 'dark';
    const btn = $('#themeBtn');
    if (btn) { btn.innerHTML = icon(dark ? 'sun' : 'moon'); btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }
  }

  /* ---------- Sidebar (mobile) ---------- */
  function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#overlay').hidden = false;
    $('#menuBtn').setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#overlay').hidden = true;
    const mb = $('#menuBtn'); if (mb) mb.setAttribute('aria-expanded', 'false');
  }

  /* ---------- Sidebar streak footer ---------- */
  function updateSidebarStreak() {
    const el = $('#sidebarStreak');
    if (!el) return;
    const st = Store.get().meta.streak;
    el.innerHTML = icon('flame') + '<span>' + st + ' day streak</span>';
  }

  /* ---------- Init ---------- */
  function init() {
    buildNav();
    const theme = Store.get().settings.theme;
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    updateThemeBtn();
    updateSidebarStreak();

    $('#themeBtn').addEventListener('click', () => setTheme(Store.get().settings.theme === 'dark' ? 'light' : 'dark'));
    $('#menuBtn').addEventListener('click', () => {
      $('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar();
    });
    $('#overlay').addEventListener('click', closeSidebar);

    window.addEventListener('hashchange', render);
    // Re-render lightweight bits when store changes (e.g., streak footer).
    Store.subscribe(() => { updateSidebarStreak(); });

    if (!location.hash) location.hash = '#/dashboard';
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

