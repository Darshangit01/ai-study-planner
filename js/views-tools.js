/* ===== views-tools.js — UI for Smart Notes, Mock Test, Wellness, Career =====
   Registers extra routes on window.VIEWS_EXTRA, consumed by app.js. */
(function () {
  'use strict';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const { esc, icon, toast, modal, closeModal, empty } = UI;
  const cap = s => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);
  const V = {};

  /* small helper for file → text (txt/md direct, pdf via Tools) */
  async function readFileText(file) {
    if (!file) throw new Tools.ToolError('No file selected.', 'no-file');
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf')) return Tools.extractPdfText(file);
    return file.text();
  }
  function fileDrop(id, hint) {
    return '<label class="dropzone" for="' + id + '">' +
      '<input type="file" id="' + id + '" accept=".pdf,.txt,.md,.text" hidden>' +
      icon('upload') + '<span class="dz-title">Click to upload a file</span>' +
      '<span class="dz-hint">' + esc(hint || 'PDF, TXT or MD') + '</span>' +
    '</label>';
  }

  /* ================= SMART NOTES ================= */
  V.notes = function (view) {
    view.innerHTML =
      '<div class="grid cols-2" style="align-items:start">' +
        '<div class="card card-pad">' +
          '<div class="section-head"><h2>Your syllabus</h2><span class="sub">Upload or paste</span></div>' +
          fileDrop('notesFile', 'PDF, TXT or MD — or paste below') +
          '<div class="field mt-16"><label for="notesText">Syllabus / notes text</label>' +
            '<textarea class="textarea" id="notesText" rows="9" placeholder="Paste your syllabus, chapter or notes here…"></textarea></div>' +
          '<button class="btn btn-primary btn-block mt-8" id="notesGo">' + icon('sparkle') + ' Simplify into smart notes</button>' +
        '</div>' +
        '<div class="card card-pad" id="notesOut">' + notesPlaceholder() + '</div>' +
      '</div>';

    const fileInput = $('#notesFile', view);
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0]; if (!f) return;
      toast('Reading ' + f.name + '…');
      try { $('#notesText', view).value = await readFileText(f); toast('File loaded', 'ok'); }
      catch (e) { toast(e.message || 'Could not read file', 'err'); }
    });
    $('#notesGo', view).addEventListener('click', () => runNotes(view));
  };

  function notesPlaceholder() {
    return '<div class="empty"><div class="empty-ico">' + icon('notes') + '</div>' +
      '<h3>Smart notes appear here</h3><p>Upload or paste your syllabus, then let the agent condense it into short, plain-language points.</p></div>';
  }

  async function runNotes(view) {
    const text = $('#notesText', view).value.trim();
    const out = $('#notesOut', view);
    const btn = $('#notesGo', view);
    if (!text) { toast('Add some syllabus text first', 'warn'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Simplifying…';
    out.innerHTML = '<div class="center-col" style="padding:40px"><span class="spinner"></span><p class="mini-stat">Analysing your syllabus…</p></div>';
    try {
      const res = await Tools.generateNotes(text);
      out.innerHTML =
        '<div class="section-head"><h2>Simplified notes</h2><span class="sub">' + res.readingMins + ' min read</span></div>' +
        '<div class="callout info" style="margin-bottom:14px">' + icon('sparkle') + '<div><b>In short</b><ul class="tick-list">' +
          res.tldr.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' +
        res.cards.map(c =>
          '<div class="note-card"><h4>' + esc(c.title) + '</h4><ul class="tick-list">' +
          c.points.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>' +
          (c.terms.length ? '<div class="subj-topics mt-8">' + c.terms.map(t => '<span class="topic-pill">' + esc(t) + '</span>').join('') + '</div>' : '') +
          '</div>').join('');
    } catch (e) {
      out.innerHTML = '<div class="callout danger">' + icon('alert') + '<span>' + esc(e.message || 'Could not simplify.') + '</span></div>' + notesPlaceholder();
    } finally {
      btn.disabled = false; btn.innerHTML = icon('sparkle') + ' Simplify into smart notes';
    }
  }
  /* ================= MOCK TEST ================= */
  const QCOUNTS = [10, 20, 40, 50, 100];
  let mockState = null; // { questions, answers:{}, submitted }

  V.mock = function (view) {
    if (mockState && mockState.questions) { renderMockRunner(view); return; }
    view.innerHTML =
      '<div class="seg mock-tabs" role="tablist" style="margin-bottom:16px">' +
        '<button data-tab="syllabus" aria-pressed="true">' + icon('upload') + ' From syllabus</button>' +
        '<button data-tab="web" aria-pressed="false">' + icon('globe') + ' From topic (web)</button>' +
      '</div>' +
      '<div id="mockPanel"></div>';
    const panels = { syllabus: mockSyllabusPanel, web: mockWebPanel };
    const show = tab => {
      $$('.mock-tabs button', view).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
      $('#mockPanel', view).innerHTML = panels[tab]();
      wireMockPanel(view, tab);
    };
    $$('.mock-tabs button', view).forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
    show('syllabus');
  };

  const countSeg = () => '<div class="seg" role="group" aria-label="Number of questions" id="qCount">' +
    QCOUNTS.map((n, i) => '<button type="button" data-n="' + n + '" aria-pressed="' + (i === 0) + '">' + n + '</button>').join('') + '</div>';

  function mockSyllabusPanel() {
    return '<div class="card card-pad">' +
      '<div class="section-head"><h2>Upload syllabus</h2><span class="sub">PDF / TXT / paste</span></div>' +
      fileDrop('mockFile', 'Upload your syllabus PDF or paste text below') +
      '<div class="field mt-16"><label for="mockText">Syllabus text</label>' +
        '<textarea class="textarea" id="mockText" rows="6" placeholder="Paste syllabus content here…"></textarea></div>' +
      '<div class="field mt-8"><label>Number of questions</label>' + countSeg() + '</div>' +
      '<button class="btn btn-primary btn-block mt-16" id="mockGo">' + icon('quiz') + ' Generate mock test</button>' +
    '</div>';
  }
  function mockWebPanel() {
    return '<div class="card card-pad">' +
      '<div class="section-head"><h2>Generate by topic</h2><span class="sub">No file needed</span></div>' +
      '<div class="field"><label for="mockTopic">Subject or topic</label>' +
        '<input class="input" id="mockTopic" placeholder="e.g. Photosynthesis, World War II, JavaScript"><span class="field-err" data-err="topic" hidden></span></div>' +
      '<div class="field mt-8"><label>Number of questions</label>' + countSeg() + '</div>' +
      '<button class="btn btn-primary btn-block mt-16" id="mockGoTopic">' + icon('quiz') + ' Generate questions</button>' +
      '<p class="mini-stat mt-8" style="text-align:center">' + (window.STUDY_AI_ENDPOINT ? 'Using AI service' : 'Generated from a built-in knowledge engine') + '</p>' +
    '</div>';
  }

  function wireMockPanel(view, tab) {
    let count = QCOUNTS[0];
    $$('#qCount button', view).forEach(b => b.addEventListener('click', () => {
      $$('#qCount button', view).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); count = Number(b.dataset.n);
    }));
    if (tab === 'syllabus') {
      const fileInput = $('#mockFile', view);
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files[0]; if (!f) return;
        toast('Reading ' + f.name + '…');
        try { $('#mockText', view).value = await readFileText(f); toast('File loaded', 'ok'); }
        catch (e) { toast(e.message || 'Could not read file', 'err'); }
      });
      $('#mockGo', view).addEventListener('click', () => startMock(view, { mode: 'text', text: $('#mockText', view).value.trim() }, count));
    } else {
      $('#mockGoTopic', view).addEventListener('click', () => startMock(view, { mode: 'topic', topic: $('#mockTopic', view).value.trim() }, count));
    }
  }

  async function startMock(view, source, count) {
    const btn = $('#mockGo', view) || $('#mockGoTopic', view);
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating ' + count + ' questions…';
    try {
      const questions = await Tools.generateMock(source, count);
      if (!questions || !questions.length) throw new Tools.ToolError('No questions could be generated.', 'empty');
      mockState = { questions, answers: {}, submitted: false, title: source.mode === 'topic' ? source.topic : 'Syllabus test' };
      renderMockRunner(view);
    } catch (e) {
      toast(e.message || 'Generation failed', 'err');
      btn.disabled = false; btn.innerHTML = icon('quiz') + ' Generate';
    }
  }
  function renderMockRunner(view) {
    const { questions, answers, submitted } = mockState;
    const answered = Object.keys(answers).length;
    let html = '<div class="card card-pad section"><div class="util-row">' +
      '<div><h2 style="font-size:16px">' + esc(cap(mockState.title)) + '</h2>' +
        '<p class="mini-stat" id="mockProg">' + answered + ' of ' + questions.length + ' answered</p></div>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost btn-sm" id="mockReset">' + icon('reset') + ' New test</button></div>' +
      '<div class="mt-16" id="mockBar">' + UI.progress((answered / questions.length) * 100) + '</div></div>';

    html += questions.map((q, i) => mockQuestionCard(q, i, answers[q.id], submitted)).join('');

    if (!submitted) {
      html += '<button class="btn btn-primary btn-block btn-lg mt-8" id="mockSubmit">' + icon('check') + ' Submit test</button>';
    } else {
      html = mockResultBanner() + html;
    }
    view.innerHTML = html;

    $('#mockReset', view).addEventListener('click', () => { mockState = null; V.mock(view); });
    const retry = $('#mockRetry', view);
    if (retry) retry.addEventListener('click', () => { mockState.answers = {}; mockState.submitted = false; renderMockRunner(view); window.scrollTo(0, 0); });
    if (!submitted) {
      $$('[data-opt]', view).forEach(btn => btn.addEventListener('click', () => {
        const qid = btn.dataset.q, oi = Number(btn.dataset.opt);
        mockState.answers[qid] = oi;
        $$('[data-q="' + qid + '"]', view).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        const done = Object.keys(mockState.answers).length;
        $('#mockProg', view).textContent = done + ' of ' + questions.length + ' answered';
        $('#mockBar', view).innerHTML = UI.progress((done / questions.length) * 100);
      }));
      $('#mockSubmit', view).addEventListener('click', () => {
        if (Object.keys(mockState.answers).length < questions.length) {
          if (!window.confirm('You have unanswered questions. Submit anyway?')) return;
        }
        mockState.submitted = true; renderMockRunner(view);
        view.scrollTop = 0; window.scrollTo(0, 0);
      });
    }
  }

  function mockQuestionCard(q, i, chosen, submitted) {
    const opts = q.options.map((opt, oi) => {
      let cls = 'mock-opt';
      let mark = '';
      if (submitted) {
        if (oi === q.answer) { cls += ' correct'; mark = icon('check'); }
        else if (oi === chosen && chosen !== q.answer) { cls += ' wrong'; mark = icon('x'); }
      } else if (oi === chosen) cls += ' chosen';
      const attrs = submitted ? '' : ' data-opt="' + oi + '" data-q="' + q.id + '" aria-pressed="' + (oi === chosen) + '"';
      const tag = submitted ? 'div' : 'button';
      return '<' + tag + ' type="button" class="' + cls + '"' + attrs + '><span class="opt-letter">' + String.fromCharCode(65 + oi) + '</span>' +
        '<span class="opt-text">' + esc(opt) + '</span>' + (mark ? '<span class="opt-mark">' + mark + '</span>' : '') + '</' + tag + '>';
    }).join('');
    const expl = submitted ? '<div class="mock-explain">' + icon('info') + '<span>' + esc(q.explain || '') + '</span></div>' : '';
    return '<div class="card card-pad mock-q"><div class="mock-q-head"><span class="q-num">Q' + (i + 1) + '</span>' +
      '<p class="q-text">' + esc(q.question) + '</p></div><div class="mock-opts">' + opts + '</div>' + expl + '</div>';
  }

  function mockResultBanner() {
    const { questions, answers } = mockState;
    let correct = 0;
    questions.forEach(q => { if (answers[q.id] === q.answer) correct++; });
    const pct = Math.round((correct / questions.length) * 100);
    const tone = pct >= 70 ? 'tone-green' : pct >= 40 ? 'tone-amber' : 'tone-red';
    const msg = pct >= 70 ? 'Excellent work!' : pct >= 40 ? 'Good effort — keep practising.' : 'Review the topics and try again.';
    return '<div class="card card-pad section result-card"><div class="center-col">' +
      UI.ring(pct, correct + '/' + questions.length) +
      '<h2 style="margin-top:6px">' + msg + '</h2>' +
      '<p class="mini-stat">You scored <b>' + correct + '</b> out of <b>' + questions.length + '</b> · ' +
        '<span class="badge ' + tone.replace('tone-', 'b-').replace('b-red', 'b-hard').replace('b-green', 'b-easy').replace('b-amber', 'b-medium') + '">' + pct + '%</span></p>' +
      '<div class="util-row mt-8"><button class="btn btn-primary btn-sm" id="mockRetry">' + icon('reset') + ' Retake</button></div>' +
    '</div></div>';
  }
  /* ================= MENTAL WELLNESS ================= */
  let timer = null;

  V.wellness = function (view) {
    stopTimer();
    const acts = Tools.getWellness();
    view.innerHTML =
      '<div class="callout info section">' + icon('heart') + '<span>Short, guided breaks reduce stress and improve focus. Pick an activity — the agent will guide you step by step with a timer.</span></div>' +
      '<div class="grid cols-3 well-grid">' +
      acts.map(a =>
        '<button class="card well-card" data-act="' + a.id + '">' +
          '<div class="well-emoji">' + a.emoji + '</div>' +
          '<div class="well-body"><span class="badge b-indigo">' + esc(a.category) + '</span>' +
          '<h4>' + esc(a.name) + '</h4><p>' + esc(a.desc) + '</p>' +
          '<span class="mini-stat"><b>' + a.totalMins + ' min</b> · ' + a.steps.length + ' steps</span></div>' +
        '</button>').join('') +
      '</div>';
    $$('[data-act]', view).forEach(b => b.addEventListener('click', () => openActivity(b.dataset.act)));
  };

  function poseSvg(pose) {
    const base = 'viewBox="0 0 120 120" width="150" height="150" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"';
    const figures = {
      meditate: '<circle cx="60" cy="30" r="10"/><path d="M60 40v22M42 84c0-12 8-20 18-20s18 8 18 20M35 84h50M44 66l-12 8M76 66l12 8"/>',
      yoga: '<circle cx="60" cy="24" r="9"/><path d="M60 33v20l-18 30M60 53l18 30M42 60h36"/>',
      lungs: '<path d="M60 20v34M46 54c0 22-4 34-16 34S22 62 22 52s10-16 24-6ZM74 54c0 22 4 34 16 34s8-26 8-36-10-16-24-6Z"/>',
      stretch: '<circle cx="60" cy="24" r="9"/><path d="M60 33v34M60 44l-22-8M60 44l22-8M60 67l-14 30M60 67l14 30"/>',
      heart: '<path d="M60 92S24 70 24 44c0-12 9-20 20-20 7 0 13 4 16 10 3-6 9-10 16-10 11 0 20 8 20 20 0 26-36 48-36 48Z"/>'
    };
    return '<svg class="pose" ' + base + '>' + (figures[pose] || figures.meditate) + '</svg>';
  }

  function openActivity(id) {
    const act = Tools.getActivity(id);
    if (!act) return;
    // Expand repeated steps into a flat sequence
    const seq = [];
    act.steps.forEach(s => { const r = s.repeat || 1; for (let i = 0; i < r; i++) seq.push(s); });
    const totalSecs = seq.reduce((n, s) => n + s.secs, 0);

    const body =
      '<div class="activity-run">' +
        '<div class="pose-wrap tone-indigo">' + poseSvg(act.pose) + '</div>' +
        '<div class="timer-ring" id="timerRing"><b id="timerText">00:00</b><small id="stepCount"></small></div>' +
        '<h3 id="stepLabel" class="step-label"></h3>' +
        '<p id="stepCue" class="step-cue"></p>' +
        '<div class="progress mt-8" id="actBar"><span style="width:0%"></span></div>' +
      '</div>';
    const footer = '<button class="btn btn-ghost" data-close id="actClose">Close</button>' +
      '<button class="btn btn-primary" id="actToggle">' + icon('play') + ' Start</button>';

    modal({ title: act.name, body, footer, size: 460, onMount(root) {
      let idx = 0, remaining = seq[0].secs, running = false, elapsed = 0;
      const tText = $('#timerText', root), tLabel = $('#stepLabel', root), tCue = $('#stepCue', root),
            tCount = $('#stepCount', root), bar = $('#actBar span', root), toggle = $('#actToggle', root);
      const paint = () => {
        const s = seq[idx];
        tText.textContent = fmtSecs(remaining);
        tLabel.textContent = s.label;
        tCue.textContent = s.cue || '';
        tCount.textContent = 'Step ' + (idx + 1) + '/' + seq.length;
        bar.style.width = Math.round((elapsed / totalSecs) * 100) + '%';
      };
      paint();
      const tick = () => {
        remaining--; elapsed++;
        if (remaining <= 0) {
          idx++;
          if (idx >= seq.length) { finish(); return; }
          remaining = seq[idx].secs;
          try { beep(); } catch (e) {}
        }
        paint();
      };
      const finish = () => {
        stopTimer(); running = false;
        tLabel.textContent = 'Done — well done! 🎉';
        tCue.textContent = 'You completed ' + act.name + '.';
        tText.textContent = '✓'; bar.style.width = '100%';
        toggle.innerHTML = icon('reset') + ' Restart';
        toast('Activity complete — nicely done!', 'ok');
      };
      toggle.addEventListener('click', () => {
        if (idx >= seq.length) { idx = 0; remaining = seq[0].secs; elapsed = 0; }
        running = !running;
        if (running) { toggle.innerHTML = icon('pause') + ' Pause'; timer = setInterval(tick, 1000); }
        else { toggle.innerHTML = icon('play') + ' Resume'; stopTimer(); }
        paint();
      });
      $('#actClose', root).addEventListener('click', stopTimer);
    }});
  }

  function fmtSecs(s) { const m = Math.floor(s / 60), r = s % 60; return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function beep() {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 660; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.05;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 160);
  }
  /* ================= CAREER ROADMAP ================= */
  V.career = function (view) {
    view.innerHTML =
      '<div class="card card-pad section">' +
        '<div class="section-head"><h2>Find your roadmap</h2><span class="sub">Enter any career</span></div>' +
        '<div class="util-row" style="gap:10px">' +
          '<input class="input" id="careerInput" placeholder="e.g. Frontend Developer, Data Scientist, UX Designer" style="flex:1;min-width:200px">' +
          '<button class="btn btn-primary" id="careerGo">' + icon('route') + ' Build roadmap</button>' +
        '</div>' +
        '<div class="checkline mt-16" id="careerChips">' +
          ['Frontend Developer', 'Backend Developer', 'Data Scientist', 'UX Designer', 'Digital Marketer'].map(c =>
            '<button class="chip-suggest" data-career="' + esc(c) + '">' + esc(c) + '</button>').join('') +
        '</div>' +
      '</div>' +
      '<div id="careerOut">' + careerPlaceholder() + '</div>';

    const go = () => runCareer(view, $('#careerInput', view).value.trim());
    $('#careerGo', view).addEventListener('click', go);
    $('#careerInput', view).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    $$('[data-career]', view).forEach(b => b.addEventListener('click', () => { $('#careerInput', view).value = b.dataset.career; runCareer(view, b.dataset.career); }));
  };

  function careerPlaceholder() {
    return '<div class="card"><div class="empty"><div class="empty-ico">' + icon('route') + '</div>' +
      '<h3>Your visual roadmap appears here</h3><p>Enter a career above and the agent maps out a phase-by-phase path with the exact skills to learn at each stage.</p></div></div>';
  }

  async function runCareer(view, career) {
    const out = $('#careerOut', view);
    const btn = $('#careerGo', view);
    if (!career) { toast('Enter a career first', 'warn'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Building…';
    out.innerHTML = '<div class="card"><div class="center-col" style="padding:40px"><span class="spinner"></span><p class="mini-stat">Mapping the best path…</p></div></div>';
    try {
      const rm = await Tools.generateRoadmap(career);
      out.innerHTML =
        '<div class="card card-pad section"><div class="util-row">' +
          '<div><h2 style="font-size:17px">' + esc(rm.title) + ' Roadmap</h2>' +
            '<p class="mini-stat">' + rm.stages.length + ' phases · ~' + rm.months + ' months · ' +
            (rm.curated ? 'curated path' : 'AI-generated path') + '</p></div></div></div>' +
        '<div class="roadmap">' + rm.stages.map((st, i) => roadmapStage(st, i, i === rm.stages.length - 1)).join('') + '</div>';
    } catch (e) {
      out.innerHTML = '<div class="card"><div class="callout danger">' + icon('alert') + '<span>' + esc(e.message || 'Could not build a roadmap.') + '</span></div></div>';
    } finally {
      btn.disabled = false; btn.innerHTML = icon('route') + ' Build roadmap';
    }
  }

  function roadmapStage(st, i, last) {
    return '<div class="rm-stage fade-in">' +
      '<div class="rm-line"><span class="rm-dot">' + (i + 1) + '</span>' + (last ? '' : '<span class="rm-bar"></span>') + '</div>' +
      '<div class="rm-card card"><div class="rm-head"><span class="badge b-indigo">' + esc(st.phase) + '</span>' +
        '<h4>' + esc(st.name) + '</h4></div>' +
        '<div class="rm-skills">' + st.skills.map(s => '<span class="rm-skill">' + icon('check') + esc(s) + '</span>').join('') + '</div>' +
      '</div>' +
    '</div>';
  }









  window.VIEWS_EXTRA = V;
})();