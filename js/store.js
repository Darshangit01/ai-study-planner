/* ===== store.js — state + local persistence layer =====
   Clean abstraction so a real DB/API can replace `persist` later. */
(function () {
  'use strict';

  const KEY = 'focus.studyplanner.v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayISO = () => new Date().toISOString().slice(0, 10);

  const DEFAULT_AVAIL = {
    hoursPerDay: 4,
    startTime: '09:00',
    endTime: '21:00',
    days: [1, 2, 3, 4, 5, 6, 0], // 0 = Sun ... 6 = Sat
    sessionMins: 50,
    breakMins: 10
  };

  const defaults = () => ({
    subjects: [],
    availability: { ...DEFAULT_AVAIL },
    plan: null,          // { generatedAt, provider, days:{ '2026-01-01':[session,...] } }
    settings: { theme: 'light', provider: 'auto', reduceRevision: false },
    meta: { streak: 0, lastActiveDate: null, completedDates: [] }
  });

  let state = defaults();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...defaults(), ...parsed };
        state.availability = { ...DEFAULT_AVAIL, ...(parsed.availability || {}) };
        state.settings = { ...defaults().settings, ...(parsed.settings || {}) };
        state.meta = { ...defaults().meta, ...(parsed.meta || {}) };
      }
    } catch (e) {
      console.warn('Store load failed, using defaults', e);
      state = defaults();
    }
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Persist failed', e); }
    }, 120);
  }

  function emit() { listeners.forEach(fn => fn(state)); }
  function commit() { persist(); emit(); }

  const Store = {
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /* ---- Subjects ---- */
    addSubject(data) {
      const s = {
        id: uid(),
        name: data.name.trim(),
        topics: (data.topics || []).map(t => ({
          id: uid(),
          name: typeof t === 'string' ? t : t.name,
          done: typeof t === 'object' ? !!t.done : false
        })),
        difficulty: data.difficulty || 'Medium',
        priority: data.priority || 'Medium',
        examDate: data.examDate || '',
        estHours: Number(data.estHours) || 0,
        createdAt: Date.now()
      };
      state.subjects.push(s);
      commit();
      return s;
    },
    updateSubject(id, patch) {
      const s = state.subjects.find(x => x.id === id);
      if (!s) return;
      if (patch.topics) {
        patch.topics = patch.topics.map(t => ({
          id: t.id || uid(),
          name: typeof t === 'string' ? t : t.name,
          done: typeof t === 'object' ? !!t.done : false
        }));
      }
      Object.assign(s, patch);
      commit();
    },
    deleteSubject(id) {
      state.subjects = state.subjects.filter(x => x.id !== id);
      if (state.plan) {
        Object.keys(state.plan.days).forEach(d => {
          state.plan.days[d] = state.plan.days[d].filter(se => se.subjectId !== id);
        });
      }
      commit();
    },
    toggleTopic(subjectId, topicId) {
      const s = state.subjects.find(x => x.id === subjectId);
      if (!s) return;
      const t = s.topics.find(x => x.id === topicId);
      if (t) { t.done = !t.done; commit(); }
    },

    /* ---- Availability / Settings ---- */
    setAvailability(a) { state.availability = { ...state.availability, ...a }; commit(); },
    setSettings(s) { state.settings = { ...state.settings, ...s }; commit(); },

    /* ---- Plan ---- */
    setPlan(plan) { state.plan = plan; commit(); },
    clearPlan() { state.plan = null; commit(); },

    getSession(id) {
      if (!state.plan) return null;
      for (const d of Object.keys(state.plan.days)) {
        const hit = state.plan.days[d].find(s => s.id === id);
        if (hit) return { session: hit, date: d };
      }
      return null;
    },
    updateSession(id, patch) {
      const found = Store.getSession(id);
      if (!found) return;
      Object.assign(found.session, patch);
      commit();
    },
    moveSession(id, toDate) {
      const found = Store.getSession(id);
      if (!found || found.date === toDate) return;
      state.plan.days[found.date] = state.plan.days[found.date].filter(s => s.id !== id);
      if (!state.plan.days[toDate]) state.plan.days[toDate] = [];
      found.session.rescheduled = true;
      state.plan.days[toDate].push(found.session);
      state.plan.days[toDate].sort((a, b) => a.start.localeCompare(b.start));
      commit();
    },
    addCustomSession(date, session) {
      if (!state.plan) state.plan = { generatedAt: Date.now(), provider: 'manual', days: {} };
      if (!state.plan.days[date]) state.plan.days[date] = [];
      state.plan.days[date].push({ id: uid(), custom: true, status: 'pending', ...session });
      state.plan.days[date].sort((a, b) => a.start.localeCompare(b.start));
      commit();
    },
    removeSession(id) {
      const found = Store.getSession(id);
      if (!found) return;
      state.plan.days[found.date] = state.plan.days[found.date].filter(s => s.id !== id);
      commit();
    },

    /* ---- Streak / completion tracking ---- */
    recordCompletion() {
      const t = todayISO();
      const m = state.meta;
      if (!m.completedDates.includes(t)) {
        m.completedDates.push(t);
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        if (m.lastActiveDate === y) m.streak = m.streak + 1;
        else if (m.lastActiveDate !== t) m.streak = 1;
        m.lastActiveDate = t;
      }
      commit();
    },

    resetAll() { state = defaults(); commit(); },
    exportData: () => JSON.stringify(state, null, 2),
    importData(json) {
      const parsed = JSON.parse(json);
      state = { ...defaults(), ...parsed };
      commit();
    },

    uid, todayISO, DEFAULT_AVAIL
  };

  load();
  window.Store = Store;
})();

