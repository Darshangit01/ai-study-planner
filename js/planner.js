/* ===== planner.js — AI planning engine =====
   Provider abstraction: if a server AI endpoint is configured it is used,
   otherwise a deterministic, intelligent local scheduler produces a real plan.
   Returns STRUCTURED data (never free text). */
(function () {
  'use strict';

  const DAY_MS = 864e5;
  const W = { Low: 1, Medium: 2, High: 3, Easy: 1, Hard: 3 };

  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);
  const parseISO = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; };
  const clampInt = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));

  function minToClock(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  const clockToMin = c => { const [h, m] = c.split(':').map(Number); return h * 60 + m; };

  /* Compute an urgency/priority weight for a subject on a given day. */
  function subjectWeight(subj, dayDate) {
    const pr = W[subj.priority] || 2;
    const diff = W[subj.difficulty] || 2;
    let examFactor = 1;
    let daysToExam = Infinity;
    if (subj.examDate) {
      const ed = parseISO(subj.examDate);
      if (ed) {
        daysToExam = Math.round((ed - dayDate) / DAY_MS);
        if (daysToExam < 0) examFactor = 0.05;            // exam passed
        else if (daysToExam <= 2) examFactor = 4;
        else if (daysToExam <= 5) examFactor = 3;
        else if (daysToExam <= 10) examFactor = 2.2;
        else if (daysToExam <= 20) examFactor = 1.5;
        else examFactor = 1.1;
      }
    }
    const remaining = remainingTopics(subj).length || 1;
    const remFactor = 1 + Math.min(remaining, 8) / 8;
    return (pr * 1.6 + diff * 1.1) * examFactor * remFactor;
  }

  const remainingTopics = subj => (subj.topics || []).filter(t => !t.done);

  /* How many total study minutes a subject still needs. */
  function neededMinutes(subj) {
    const rem = remainingTopics(subj).length;
    const total = subj.topics ? subj.topics.length : 0;
    if (subj.estHours && total > 0) {
      return Math.round(subj.estHours * 60 * (rem / total || 0));
    }
    if (subj.estHours) return Math.round(subj.estHours * 60);
    return rem * 45; // fallback: 45 min per topic
  }

  /* Build the list of study day-dates within horizon respecting availability.days */
  function studyDates(avail, horizonDays, from) {
    const out = [];
    const start = from || new Date(iso(new Date()) + 'T00:00:00');
    for (let i = 0; i < horizonDays; i++) {
      const d = addDays(start, i);
      if (avail.days.includes(d.getDay())) out.push(d);
    }
    return out;
  }

  /* Split a day's available window into session slots (study + break cadence). */
  function daySlots(avail) {
    const startM = clockToMin(avail.startTime);
    const endM = clockToMin(avail.endTime);
    const cap = Math.min((endM - startM), avail.hoursPerDay * 60);
    const slotLen = clampInt(avail.sessionMins, 15, 180);
    const brk = clampInt(avail.breakMins, 0, 60);
    const slots = [];
    let cursor = startM;
    let used = 0;
    while (used + slotLen <= cap && cursor + slotLen <= endM) {
      slots.push({ start: cursor, len: slotLen });
      used += slotLen;
      cursor += slotLen + brk;
    }
    return slots;
  }

  /* ===== Core deterministic scheduler ===== */
  function buildPlan(subjects, avail, opts) {
    opts = opts || {};
    const horizon = opts.horizonDays || 14;
    const reduceRevision = !!opts.reduceRevision;
    const days = {};
    const startDate = new Date(iso(new Date()) + 'T00:00:00');
    const dates = studyDates(avail, horizon, startDate);
    if (!dates.length) return { generatedAt: Date.now(), provider: 'local', days, warning: 'no-study-days' };

    // Working pool: remaining minutes + a rotating topic queue per subject.
    const pool = subjects.map(s => ({
      ref: s,
      remaining: Math.max(neededMinutes(s), remainingTopics(s).length ? 30 : 0),
      queue: buildTopicQueue(s, reduceRevision),
      qi: 0
    })).filter(p => p.remaining > 0 && p.queue.length);

    if (!pool.length) return { generatedAt: Date.now(), provider: 'local', days, warning: 'nothing-to-schedule' };

    for (const date of dates) {
      const slots = daySlots(avail);
      if (!slots.length) continue;
      const dISO = iso(date);
      const list = [];
      // Rank subjects fresh each day (urgency shifts as exams approach).
      for (const slot of slots) {
        const cand = pool
          .filter(p => p.remaining > 0)
          .map(p => ({ p, score: subjectWeight(p.ref, date) + freshnessBonus(p, list) }))
          .sort((a, b) => b.score - a.score)[0];
        if (!cand) break;
        const p = cand.p;
        const item = p.queue[p.qi % p.queue.length];
        p.qi++;
        p.remaining -= slot.len;
        list.push({
          id: Store.uid(),
          subjectId: p.ref.id,
          subject: p.ref.name,
          topic: item.label,
          kind: item.kind,               // 'study' | 'revision' | 'practice'
          difficulty: p.ref.difficulty,
          priority: p.ref.priority,
          start: minToClock(slot.start),
          end: minToClock(slot.start + slot.len),
          durationMins: slot.len,
          status: 'pending'
        });
      }
      if (list.length) days[dISO] = list;
      if (pool.every(p => p.remaining <= 0)) break;
    }

    return { generatedAt: Date.now(), provider: 'local', horizonDays: horizon, days };
  }

  /* Avoid scheduling the same subject back-to-back when alternatives exist. */
  function freshnessBonus(p, todaysList) {
    const last = todaysList[todaysList.length - 1];
    if (last && last.subjectId === p.ref.id) return -1.4;
    return 0;
  }

  /* Build an ordered queue of learning items: topics first, then revision & practice. */
  function buildTopicQueue(subj, reduceRevision) {
    const rem = remainingTopics(subj);
    const q = rem.map(t => ({ label: t.name, kind: 'study' }));
    if (!q.length && subj.topics && subj.topics.length) {
      subj.topics.forEach(t => q.push({ label: t.name, kind: 'revision' }));
    }
    if (q.length) {
      if (!reduceRevision) q.push({ label: 'Revision & summary', kind: 'revision' });
      if (subj.examDate) q.push({ label: 'Practice / mock questions', kind: 'practice' });
    }
    return q.length ? q : [{ label: 'Study', kind: 'study' }];
  }

  /* ===== Redistribution: push missed work into future free time ===== */
  function redistribute(plan, session, avail) {
    const start = new Date(iso(new Date()) + 'T00:00:00');
    const dates = studyDates(avail, 21, addDays(start, 1));
    for (const date of dates) {
      const dISO = iso(date);
      const existing = plan.days[dISO] || [];
      const slots = daySlots(avail);
      const usedStarts = new Set(existing.map(s => s.start));
      const free = slots.find(sl => !usedStarts.has(minToClock(sl.start)));
      if (free) {
        return {
          date: dISO,
          start: minToClock(free.start),
          end: minToClock(free.start + (session.durationMins || free.len))
        };
      }
    }
    return null;
  }

  /* ===== Provider abstraction =====
     If window.STUDY_AI_ENDPOINT is defined (a server route that keeps the
     API key server-side), we POST the planning payload there and expect
     structured JSON back. Otherwise we use the deterministic local engine.
     We never fake an API response as "AI". */
  async function generate(subjects, avail, opts) {
    validateInputs(subjects, avail);
    const endpoint = window.STUDY_AI_ENDPOINT;
    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjects, availability: avail, options: opts || {} })
        });
        if (!res.ok) throw new Error('AI endpoint error ' + res.status);
        const data = await res.json();
        if (!data || !data.days) throw new Error('Malformed AI response');
        return { ...data, provider: data.provider || 'ai' };
      } catch (err) {
        console.warn('AI provider failed, using local engine:', err.message);
        const local = buildPlan(subjects, avail, opts);
        local.fallback = true;
        local.fallbackReason = err.message;
        return local;
      }
    }
    // Simulate async so UI loading states are real; clearly a local computation.
    return new Promise(resolve => {
      setTimeout(() => resolve(buildPlan(subjects, avail, opts)), 260);
    });
  }

  /* ===== Validation with actionable errors ===== */
  function validateInputs(subjects, avail) {
    if (!Array.isArray(subjects) || subjects.length === 0) {
      throw new PlannerError('Add at least one subject before generating a plan.', 'no-subjects');
    }
    const hasWork = subjects.some(s => (s.topics && s.topics.some(t => !t.done)) || s.estHours > 0);
    if (!hasWork) {
      throw new PlannerError('Your subjects have no remaining topics or study hours to schedule.', 'nothing-to-do');
    }
    if (!avail || !avail.days || avail.days.length === 0) {
      throw new PlannerError('Select at least one available study day in Availability.', 'no-days');
    }
    if (clockToMin(avail.endTime) <= clockToMin(avail.startTime)) {
      throw new PlannerError('Study end time must be after the start time.', 'bad-window');
    }
    if (!avail.hoursPerDay || avail.hoursPerDay <= 0) {
      throw new PlannerError('Daily available hours must be greater than zero.', 'no-hours');
    }
    for (const s of subjects) {
      if (s.examDate) {
        const d = parseISO(s.examDate);
        if (!d) throw new PlannerError('"' + s.name + '" has an invalid exam date.', 'bad-date');
      }
    }
  }

  function PlannerError(message, code) { this.message = message; this.code = code; this.name = 'PlannerError'; }
  PlannerError.prototype = Object.create(Error.prototype);

  window.Planner = {
    generate,
    redistribute,
    buildPlan,
    neededMinutes,
    remainingTopics,
    daySlots,
    PlannerError,
    helpers: { minToClock, clockToMin, iso, addDays, parseISO }
  };
})();


