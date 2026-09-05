/* ===== ui.js — reusable UI primitives: icons, toasts, modals, components ===== */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* ---- Icon set (inline SVG, currentColor) ---- */
  const P = {
    dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
    plus: 'M12 5v14M5 12h14',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    week: 'M3 4h18v16H3zM3 9h18M9 9v11M15 9v11',
    book: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Zm2 13h12',
    chart: 'M4 20V10M10 20V4M16 20v-6M22 20H2',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z|M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z',
    check: 'M20 6 9 17l-5-5',
    x: 'M18 6 6 18M6 6l12 12',
    skip: 'M5 4l10 8-10 8V4ZM19 5v14',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z',
    flame: 'M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5.5-2.5S6 11 6 13a6 6 0 0 0 12 0c0-4-3-7-6-11Z',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    trend: 'M23 6l-9.5 9.5-5-5L1 18',
    alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01',
    sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z',
    arrow: 'M5 12h14M12 5l7 7-7 7',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
    notes: 'M4 3h11l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v6h6M8 13h8M8 17h5',
    quiz: 'M9.1 9a3 3 0 1 1 4 2.8c-.9.4-1.6 1.2-1.6 2.2M12 18h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
    heart: 'M12 21s-7.5-4.6-10-9.3C.4 8.3 2 4.8 5.3 4.4c2-.3 3.7.9 4.7 2.3 1-1.4 2.7-2.6 4.7-2.3C18 4.8 19.6 8.3 18 11.7 15.5 16.4 12 21 12 21Z',
    route: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 9v6a3 3 0 0 0 3 3h6',
    upload: 'M12 15V3m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    play: 'M6 4l14 8-14 8V4Z',
    pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
    leaf: 'M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 8-4 13-9 13ZM4 20c2-4 5-6 9-7',
    lungs: 'M12 3v9M8 12c0 5-1 8-4 8s-2-6-2-9 3-4 6-2ZM16 12c0 5 1 8 4 8s2-6 2-9-3-4-6-2Z',
    star: 'M12 3l2.6 6.6L21 10l-5 4.3L17.5 21 12 17.3 6.5 21 8 14.3 3 10l6.4-.4L12 3Z',
    timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z'
  };

  function icon(name, cls) {
    const raw = P[name] || P.info;
    const paths = raw.split('|').map(d => `<path d="${d}"/>`).join('');
    return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }

  /* ---- Toasts ---- */
  const toastRoot = () => document.getElementById('toast-root');
  function toast(msg, type) {
    const root = toastRoot();
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.setAttribute('role', 'status');
    const ic = type === 'ok' ? 'check' : type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'info';
    el.innerHTML = icon(ic) + '<span>' + esc(msg) + '</span>';
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

  /* ---- Modal (focus-trapped, ESC + backdrop close) ---- */
  let activeModal = null;
  function modal({ title, body, footer, onMount, size }) {
    closeModal();
    const root = document.getElementById('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML =
      '<div class="modal fade-in" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"' +
      (size ? ' style="max-width:' + size + 'px"' : '') + '>' +
        '<div class="modal-head"><h3>' + esc(title) + '</h3>' +
          '<button class="icon-btn" data-close aria-label="Close dialog">' + icon('x') + '</button></div>' +
        '<div class="modal-body">' + body + '</div>' +
        (footer ? '<div class="modal-foot">' + footer + '</div>' : '') +
      '</div>';
    root.appendChild(back);
    activeModal = back;

    const close = e => { if (e.target === back || e.target.closest('[data-close]')) closeModal(); };
    back.addEventListener('click', close);
    document.addEventListener('keydown', onEscape);

    const focusable = back.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable[0]) setTimeout(() => {
      const firstField = back.querySelector('input, select, textarea');
      (firstField || focusable[0]).focus();
    }, 30);
    if (onMount) onMount(back);
    return back;
  }
  function onEscape(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    if (activeModal) { activeModal.remove(); activeModal = null; document.removeEventListener('keydown', onEscape); }
  }

  /* ---- Confirm dialog ---- */
  function confirm({ title, message, confirmText, danger }) {
    return new Promise(resolve => {
      const m = modal({
        title: title || 'Are you sure?',
        body: '<p style="color:var(--text-2);font-size:14px">' + esc(message) + '</p>',
        footer:
          '<button class="btn btn-ghost" data-cancel>Cancel</button>' +
          '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(confirmText || 'Confirm') + '</button>'
      });
      m.querySelector('[data-ok]').addEventListener('click', () => { closeModal(); resolve(true); });
      m.querySelector('[data-cancel]').addEventListener('click', () => { closeModal(); resolve(false); });
    });
  }

  /* ---- Small view helpers ---- */
  function statCard({ label, value, sub, icon: ic, tone }) {
    return '<div class="card stat fade-in">' +
      '<div class="stat-top">' +
        '<div><div class="stat-val">' + value + '</div>' +
        '<div class="stat-label">' + esc(label) + '</div></div>' +
        '<div class="stat-ico ' + (tone || 'tone-indigo') + '">' + icon(ic) + '</div>' +
      '</div>' +
      (sub ? '<div class="stat-sub ' + (sub.tone || '') + '" style="color:var(--muted)">' + sub.text + '</div>' : '') +
    '</div>';
  }

  const badge = (text, cls) => '<span class="badge ' + (cls || 'b-muted') + '">' + esc(text) + '</span>';

  function progress(pct, tone) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    return '<div class="progress ' + (tone || '') + '"><span style="width:' + pct + '%"></span></div>';
  }

  function ring(pct, label) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const r = 52, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return '<div class="ring-wrap">' +
      '<svg viewBox="0 0 120 120" width="120" height="120">' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="10"/>' +
        '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--primary)" stroke-width="10" ' +
          'stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" ' +
          'transform="rotate(-90 60 60)"/>' +
      '</svg>' +
      '<div class="ring-label"><b>' + pct + '%</b><small>' + esc(label || '') + '</small></div>' +
    '</div>';
  }

  function empty({ icon: ic, title, text, actionHtml }) {
    return '<div class="card"><div class="empty">' +
      '<div class="empty-ico">' + icon(ic || 'inbox') + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' +
      (actionHtml || '') +
    '</div></div>';
  }

  const KIND_LABEL = { study: 'Study', revision: 'Revision', practice: 'Practice' };
  const KIND_BADGE = { study: 'b-indigo', revision: 'b-info', practice: 'b-medium' };

  /* ---- Session card ---- */
  function sessionCard(s, opts) {
    opts = opts || {};
    const diffCls = { Easy: 'b-easy', Medium: 'b-medium', Hard: 'b-hard' }[s.difficulty] || 'b-muted';
    const done = s.status === 'done', skipped = s.status === 'skipped';
    const cls = 'session' + (done ? ' done' : '') + (skipped ? ' skipped' : '');
    const accentColor = done ? 'var(--success)' : skipped ? 'var(--muted)' : 'var(--primary)';
    let actions = '';
    if (opts.actions !== false) {
      actions = '<div class="s-actions">' +
        '<button class="icon-btn" data-act="toggle" data-id="' + s.id + '" aria-label="' + (done ? 'Mark as not done' : 'Mark complete') + '" title="' + (done ? 'Undo' : 'Complete') + '">' + icon(done ? 'reset' : 'check') + '</button>' +
        (done ? '' : '<button class="icon-btn" data-act="skip" data-id="' + s.id + '" aria-label="Skip session" title="Skip">' + icon('skip') + '</button>') +
        '<button class="icon-btn" data-act="edit" data-id="' + s.id + '" aria-label="Edit session" title="Edit / reschedule">' + icon('edit') + '</button>' +
      '</div>';
    }
    const tags = [
      '<span class="s-time">' + s.start + '–' + s.end + '</span>',
      badge(KIND_LABEL[s.kind] || 'Study', KIND_BADGE[s.kind] || 'b-indigo'),
      s.difficulty ? badge(s.difficulty, diffCls) : '',
      s.rescheduled ? badge('Moved', 'b-muted') : '',
      s.custom ? badge('Custom', 'b-muted') : '',
      skipped ? badge('Skipped', 'b-muted') : ''
    ].join('');
    return '<article class="' + cls + '" data-session="' + s.id + '">' +
      '<div class="session-accent" style="background:' + accentColor + '"></div>' +
      '<div class="s-body">' +
        '<div class="s-row1">' + tags + '</div>' +
        '<div class="s-title">' + esc(s.subject) + '</div>' +
        '<div class="s-sub">' + esc(s.topic || '') + ' · ' + (s.durationMins || 0) + ' min</div>' +
      '</div>' + actions +
    '</article>';
  }

  window.UI = {
    esc, icon, toast, modal, closeModal, confirm,
    statCard, badge, progress, ring, empty, sessionCard,
    KIND_LABEL
  };
})();

