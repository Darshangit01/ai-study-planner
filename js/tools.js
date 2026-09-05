/* ===== tools.js — extra AI tools: Smart Notes, Mock Test, Wellness, Career =====
   Same philosophy as planner.js: use a server AI endpoint if configured
   (window.STUDY_AI_ENDPOINT), otherwise deterministic local engines so the
   app is fully usable offline. Never fakes an API response as real AI. */
(function () {
  'use strict';

  const STOP = new Set(('a an the and or but of to in on at for with from by as is are was were be been being this that these those it its into their our your his her they them we you i he she not can will shall may might must should would could have has had do does did which who whom whose what when where why how than then so such also each any all some more most other into out up down over under about above below between within without across per via etc eg ie').split(' '));

  const clean = t => (t || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  const sentences = t => clean(t).replace(/([.!?])\s+/g, '$1\n').split('\n').map(s => s.trim()).filter(s => s.length > 8);
  const words = t => clean(t).toLowerCase().match(/[a-z][a-z'-]{1,}/g) || [];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = arr => Array.from(new Set(arr));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---- Key term extraction (frequency + capitalised phrases) ---- */
  function keyTerms(text, limit) {
    const freq = {};
    words(text).forEach(w => { if (!STOP.has(w) && w.length > 3) freq[w] = (freq[w] || 0) + 1; });
    // capitalised multi-word phrases from original text
    const phrases = clean(text).match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) || [];
    const phraseScore = {};
    phrases.forEach(p => { if (p.split(' ').length > 1 || p.length > 5) phraseScore[p] = (phraseScore[p] || 0) + 3; });
    const single = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 30).map(cap);
    const combined = uniq([...Object.keys(phraseScore).sort((a, b) => phraseScore[b] - phraseScore[a]), ...single]);
    return combined.slice(0, limit || 40);
  }

  /* ================= SMART NOTES ================= */
  function simplifyNotes(text) {
    const t = clean(text);
    if (t.length < 20) throw new ToolError('Add more syllabus text — at least a couple of sentences.', 'too-short');

    // Split into topic blocks by numbering / headings / blank lines
    const rawBlocks = t.split(/\n{2,}|(?=^\s*(?:\d+[\.\)]|unit\s|chapter\s|module\s|topic\s)|•|-\s)/im)
      .map(b => b.trim()).filter(b => b.length > 10);
    const blocks = rawBlocks.length > 1 ? rawBlocks : chunkSentences(sentences(t), 3);

    const cards = blocks.slice(0, 12).map((block, i) => {
      const sents = sentences(block);
      const heading = deriveHeading(block, i);
      const points = sents.map(simplifySentence).filter(Boolean).slice(0, 5);
      return {
        title: heading,
        points: points.length ? points : [simplifySentence(block)],
        terms: keyTerms(block, 5)
      };
    });

    const allTerms = keyTerms(t, 8);
    const tldr = buildTldr(sentences(t), allTerms);
    return { tldr, cards, termCount: allTerms.length, readingMins: Math.max(1, Math.round(words(t).length / 200)) };
  }

  function chunkSentences(sents, n) {
    const out = [];
    for (let i = 0; i < sents.length; i += n) out.push(sents.slice(i, i + n).join(' '));
    return out;
  }
  function deriveHeading(block, i) {
    const first = block.split('\n')[0].replace(/^\s*(\d+[\.\)]|•|-\s|unit|chapter|module|topic)\s*/i, '').trim();
    const short = first.split(/[.:]/)[0].trim();
    if (short.length >= 3 && short.length <= 60) return cap(short);
    const terms = keyTerms(block, 1);
    return terms[0] ? terms[0] : 'Part ' + (i + 1);
  }
  function simplifySentence(s) {
    let x = clean(s);
    if (!x) return '';
    // Strip academic filler, shorten
    x = x.replace(/\b(in order to)\b/gi, 'to')
         .replace(/\b(utilis|utiliz)e\b/gi, 'use')
         .replace(/\b(approximately|essentially|basically|fundamentally)\b/gi, '')
         .replace(/\b(demonstrate|illustrate)\b/gi, 'show')
         .replace(/\s{2,}/g, ' ').trim();
    // Keep it short: first ~22 words
    const w = x.split(' ');
    if (w.length > 24) x = w.slice(0, 22).join(' ') + '…';
    return cap(x.replace(/[;,]$/, '').replace(/\.$/, ''));
  }
  function buildTldr(sents, terms) {
    const key = sents.filter(s => terms.some(t => s.toLowerCase().includes(t.toLowerCase())));
    const pick = (key.length ? key : sents).slice(0, 3).map(simplifySentence);
    return pick;
  }

  function ToolError(message, code) { this.message = message; this.code = code; this.name = 'ToolError'; }
  ToolError.prototype = Object.create(Error.prototype);

  /* ================= MOCK TEST ================= */
  // Build MCQs from syllabus text: definition, fill-blank, and true/false styles.
  function buildMockFromText(text, count) {
    const t = clean(text);
    if (t.length < 40) throw new ToolError('Add more syllabus content so we can build questions.', 'too-short');
    const sents = sentences(t).filter(s => words(s).length >= 6);
    const terms = keyTerms(t, 60);
    if (sents.length < 3 && terms.length < 4) throw new ToolError('Not enough content to generate questions.', 'insufficient');

    const questions = [];
    const usedStems = new Set();

    // 1) Definition/association questions from key terms
    for (const term of terms) {
      if (questions.length >= count) break;
      const host = sents.find(s => s.toLowerCase().includes(term.toLowerCase()) && words(s).length >= 8);
      if (!host || usedStems.has(term.toLowerCase())) continue;
      usedStems.add(term.toLowerCase());
      const distractors = shuffle(terms.filter(x => x.toLowerCase() !== term.toLowerCase())).slice(0, 3);
      if (distractors.length < 3) continue;
      const options = shuffle([term, ...distractors]);
      questions.push({
        id: Date.now().toString(36) + questions.length,
        type: 'mcq',
        question: 'Which term best fits: "' + blankOut(host, term) + '"',
        options,
        answer: options.indexOf(term),
        explain: 'From the syllabus: “' + trimSent(host) + '”'
      });
    }

    // 2) Fill-in-the-blank on important sentences
    for (const s of shuffle(sents)) {
      if (questions.length >= count) break;
      const cand = (words(s).filter(w => !STOP.has(w) && w.length > 4));
      if (!cand.length) continue;
      const key = cand.sort((a, b) => b.length - a.length)[0];
      if (usedStems.has(key)) continue;
      usedStems.add(key);
      const pool = uniq(terms.map(x => x.toLowerCase()).concat(cand)).filter(w => w !== key && w.length > 4);
      const distractors = shuffle(pool).slice(0, 3).map(cap);
      if (distractors.length < 3) continue;
      const correct = cap(key);
      const options = shuffle([correct, ...distractors]);
      questions.push({
        id: Date.now().toString(36) + questions.length,
        type: 'mcq',
        question: 'Fill in the blank: "' + s.replace(new RegExp('\\b' + escapeRe(key) + '\\b', 'i'), '_____') + '"',
        options,
        answer: options.indexOf(correct),
        explain: 'The correct word is “' + correct + '”.'
      });
    }

    // 3) True/False from statements
    for (const s of shuffle(sents)) {
      if (questions.length >= count) break;
      const isTrue = Math.random() > 0.5;
      let stmt = trimSent(s);
      if (!isTrue) stmt = negate(stmt, terms);
      questions.push({
        id: Date.now().toString(36) + questions.length,
        type: 'mcq',
        question: 'True or False: ' + stmt,
        options: ['True', 'False'],
        answer: isTrue ? 0 : 1,
        explain: isTrue ? 'This matches the syllabus.' : 'This statement was altered from the source.'
      });
    }

    if (!questions.length) throw new ToolError('Could not generate questions from this content. Try a longer syllabus.', 'empty');
    return questions.slice(0, count);
  }

  function blankOut(sentence, term) {
    return trimSent(sentence.replace(new RegExp('\\b' + escapeRe(term) + '\\b', 'i'), '_____'));
  }
  function trimSent(s) { const w = clean(s).split(' '); return (w.length > 26 ? w.slice(0, 24).join(' ') + '…' : w.join(' ')); }
  function negate(s, terms) {
    if (/\bis\b/.test(s)) return s.replace(/\bis\b/, 'is not');
    if (/\bare\b/.test(s)) return s.replace(/\bare\b/, 'are not');
    const other = shuffle(terms)[0];
    return other ? s.replace(/\b[A-Z][a-z]+\b/, other) : s + ' (always)';
  }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ---- Topic-based question generation ("search from web" style) ----
     Uses an optional curated bank (window.MOCK_BANK) keyed by topic keywords,
     then tops up with concept-focused questions so ANY topic yields a full quiz. */
  const BANK = window.MOCK_BANK || {};
  function buildMockFromTopic(topic, count) {
    const key = (topic || '').trim().toLowerCase();
    if (!key) throw new ToolError('Enter a subject or topic first.', 'no-topic');
    let pool = [];
    Object.keys(BANK).forEach(k => { if (key.includes(k) || k.includes(key)) pool = pool.concat(BANK[k]); });
    let questions = shuffle(pool);
    if (questions.length < count) questions = questions.concat(genericTopicQuestions(topic, count - questions.length));
    return questions.slice(0, count).map((q, i) => ({ id: Date.now().toString(36) + i, type: 'mcq', ...q }));
  }
  function genericTopicQuestions(topic, n) {
    const T = cap(topic.trim());
    const templates = [
      { question: 'Which of the following is most central to ' + T + '?', options: ['Core principles of ' + T, 'Unrelated trivia', 'Random guesswork', 'None of these'], answer: 0, explain: 'Focus on core principles when studying ' + T + '.' },
      { question: 'A good first step to learn ' + T + ' is to…', options: ['Understand the fundamentals first', 'Memorise advanced edge cases', 'Skip the basics', 'Avoid all practice'], answer: 0, explain: 'Fundamentals build a foundation for ' + T + '.' },
      { question: 'Which study method best reinforces ' + T + '?', options: ['Active recall & practice', 'Passive re-reading only', 'Cramming once', 'Ignoring revision'], answer: 0, explain: 'Active recall outperforms passive review.' },
      { question: 'When revising ' + T + ', spaced repetition helps because it…', options: ['Strengthens long-term memory', 'Wastes time', 'Only helps short-term', 'Has no effect'], answer: 0, explain: 'Spacing improves retention.' },
      { question: 'The best way to test your ' + T + ' knowledge is to…', options: ['Take practice questions', 'Never self-test', 'Only read notes', 'Guess randomly'], answer: 0, explain: 'Self-testing reveals knowledge gaps.' }
    ];
    const out = [];
    for (let i = 0; i < n; i++) { const base = { ...templates[i % templates.length] }; base.options = shuffleKeepAnswer(base); out.push(base); }
    return out;
  }
  function shuffleKeepAnswer(q) {
    const correct = q.options[q.answer];
    const opts = shuffle(q.options);
    q.answer = opts.indexOf(correct);
    return opts;
  }

  /* Provider wrapper — try AI endpoint, else local engine. */
  async function generateMock(source, count) {
    const endpoint = window.STUDY_AI_ENDPOINT;
    if (endpoint) {
      try {
        const res = await fetch(endpoint + (endpoint.includes('?') ? '&' : '?') + 'tool=mock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'mock', source, count })
        });
        if (res.ok) { const d = await res.json(); if (d && Array.isArray(d.questions)) return d.questions.slice(0, count); }
      } catch (e) { /* fall through to local */ }
    }
    return new Promise((resolve, reject) => setTimeout(() => {
      try {
        resolve(source.mode === 'topic' ? buildMockFromTopic(source.topic, count) : buildMockFromText(source.text, count));
      } catch (e) { reject(e); }
    }, 300));
  }
  async function generateNotes(text) {
    const endpoint = window.STUDY_AI_ENDPOINT;
    if (endpoint) {
      try {
        const res = await fetch(endpoint + (endpoint.includes('?') ? '&' : '?') + 'tool=notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'notes', text })
        });
        if (res.ok) { const d = await res.json(); if (d && d.cards) return d; }
      } catch (e) { /* fall through */ }
    }
    return new Promise((resolve, reject) => setTimeout(() => {
      try { resolve(simplifyNotes(text)); } catch (e) { reject(e); }
    }, 300));
  }



  /* ================= MENTAL WELLNESS ================= */
  // Each activity has ordered steps; steps drive a guided timer with an SVG pose.
  const WELLNESS = [
    {
      id: 'box-breathing', name: 'Box Breathing', category: 'Breathing', emoji: '🫁',
      desc: 'Calm your nervous system with equal 4-count breaths. Great before study or exams.',
      totalMins: 4, pose: 'lungs',
      steps: [
        { label: 'Get comfortable, sit tall', secs: 10, cue: 'Relax your shoulders' },
        { label: 'Breathe in slowly', secs: 4, cue: 'Through the nose' },
        { label: 'Hold', secs: 4, cue: 'Stay relaxed' },
        { label: 'Breathe out slowly', secs: 4, cue: 'Through the mouth' },
        { label: 'Hold', secs: 4, cue: 'Empty and still' },
        { label: 'Repeat the cycle', secs: 4, cue: 'In • hold • out • hold', repeat: 8 }
      ]
    },
    {
      id: 'meditation', name: 'Mindful Meditation', category: 'Meditation', emoji: '🧘',
      desc: 'A 10-minute focus reset. Follow the prompts and gently return attention to your breath.',
      totalMins: 10, pose: 'meditate',
      steps: [
        { label: 'Sit comfortably, eyes closed', secs: 30, cue: 'Settle in' },
        { label: 'Notice your natural breath', secs: 120, cue: 'Don’t change it' },
        { label: 'Scan your body head to toe', secs: 180, cue: 'Release tension' },
        { label: 'Focus only on breathing', secs: 180, cue: 'Count each exhale' },
        { label: 'Widen awareness to sounds', secs: 60, cue: 'Stay relaxed' },
        { label: 'Slowly open your eyes', secs: 30, cue: 'Carry the calm with you' }
      ]
    },
    {
      id: 'surya', name: 'Surya Namaskar (Sun Salutation)', category: 'Yoga', emoji: '🙏',
      desc: 'A flowing 12-pose yoga sequence to energise the body and improve focus.',
      totalMins: 6, pose: 'yoga',
      steps: [
        { label: 'Pranamasana (Prayer pose)', secs: 20, cue: 'Stand tall, palms together' },
        { label: 'Hastauttanasana (Raised arms)', secs: 20, cue: 'Inhale, arch back gently' },
        { label: 'Hasta Padasana (Forward fold)', secs: 25, cue: 'Exhale, fold forward' },
        { label: 'Ashwa Sanchalanasana (Lunge)', secs: 25, cue: 'Right leg back, look up' },
        { label: 'Dandasana (Plank)', secs: 25, cue: 'Body in a straight line' },
        { label: 'Ashtanga Namaskara (Eight points)', secs: 20, cue: 'Knees, chest, chin down' },
        { label: 'Bhujangasana (Cobra)', secs: 25, cue: 'Lift chest, elbows soft' },
        { label: 'Parvatasana (Downward dog)', secs: 25, cue: 'Hips up, heels down' },
        { label: 'Lunge → Fold → Rise', secs: 40, cue: 'Reverse the flow' },
        { label: 'Return to standing', secs: 15, cue: 'Center yourself' }
      ]
    },
    {
      id: 'neck-eyes', name: 'Desk Relief: Neck & Eyes', category: 'Stretch', emoji: '💪',
      desc: 'Quick relief for study fatigue — loosen your neck, shoulders and rest your eyes.',
      totalMins: 3, pose: 'stretch',
      steps: [
        { label: 'Roll shoulders backward', secs: 20, cue: 'Slow circles' },
        { label: 'Tilt head to right shoulder', secs: 20, cue: 'Feel the stretch' },
        { label: 'Tilt head to left shoulder', secs: 20, cue: 'Breathe' },
        { label: 'Look far away (20-20-20)', secs: 20, cue: 'Rest your eyes' },
        { label: 'Palm your eyes in darkness', secs: 20, cue: 'Warm and relax' },
        { label: 'Gentle chin tucks', secs: 20, cue: 'Lengthen the neck' }
      ]
    },
    {
      id: 'gratitude', name: 'Gratitude Reset', category: 'Journaling', emoji: '📝',
      desc: 'A short reflective practice to lift mood and reduce study stress.',
      totalMins: 5, pose: 'heart',
      steps: [
        { label: 'Take three slow breaths', secs: 30, cue: 'Arrive in the moment' },
        { label: 'Recall one thing that went well', secs: 60, cue: 'However small' },
        { label: 'Think of someone you appreciate', secs: 60, cue: 'Picture them' },
        { label: 'Name one strength you have', secs: 60, cue: 'Own it' },
        { label: 'Set one kind intention for today', secs: 60, cue: 'Be specific' },
        { label: 'Smile and stretch', secs: 30, cue: 'Reset complete' }
      ]
    }
  ];
  const getWellness = () => WELLNESS;
  const getActivity = id => WELLNESS.find(a => a.id === id);


  /* ================= CAREER ROADMAP ================= */
  // Curated roadmaps + a generic builder so ANY career returns a visual path.
  const ROADMAPS = {
    'frontend developer': roadmap('Frontend Developer', [
      ['Foundations', ['HTML5 & semantics', 'CSS3 & responsive layout', 'JavaScript (ES6+)', 'Git & GitHub']],
      ['Core Skills', ['DOM & fetch/APIs', 'A framework (React/Vue)', 'State management', 'Package managers (npm)']],
      ['Professional', ['TypeScript', 'Testing (Jest/RTL)', 'Build tools (Vite/Webpack)', 'Accessibility & performance']],
      ['Advanced', ['SSR (Next.js)', 'CI/CD basics', 'Design systems', 'Web security']],
      ['Get Hired', ['Portfolio (3+ projects)', 'Open-source contributions', 'DSA basics for interviews', 'Resume & mock interviews']]
    ]),
    'backend developer': roadmap('Backend Developer', [
      ['Foundations', ['A language (Node/Python/Java)', 'Git & CLI', 'How the web works (HTTP)', 'Data structures']],
      ['Core Skills', ['REST API design', 'Databases (SQL + NoSQL)', 'Authentication & sessions', 'ORMs']],
      ['Professional', ['Caching (Redis)', 'Testing & logging', 'Docker basics', 'Message queues']],
      ['Advanced', ['System design', 'Microservices', 'CI/CD & cloud (AWS/GCP)', 'Scaling & monitoring']],
      ['Get Hired', ['Backend portfolio + APIs', 'DSA for interviews', 'Contribute to OSS', 'Resume & mock interviews']]
    ]),
    'data scientist': roadmap('Data Scientist', [
      ['Foundations', ['Python', 'Statistics & probability', 'Linear algebra basics', 'SQL']],
      ['Core Skills', ['Pandas & NumPy', 'Data cleaning & EDA', 'Visualization (Matplotlib)', 'Jupyter workflow']],
      ['Machine Learning', ['scikit-learn', 'Supervised & unsupervised', 'Model evaluation', 'Feature engineering']],
      ['Advanced', ['Deep learning (PyTorch/TF)', 'NLP or CV specialisation', 'MLOps basics', 'Big data (Spark)']],
      ['Get Hired', ['Kaggle competitions', 'Portfolio notebooks', 'Case-study projects', 'Resume & interviews']]
    ]),
    'ux designer': roadmap('UX Designer', [
      ['Foundations', ['Design principles', 'Color & typography', 'UX vs UI', 'Design tools (Figma)']],
      ['Core Skills', ['User research', 'Wireframing', 'Prototyping', 'Usability testing']],
      ['Professional', ['Design systems', 'Interaction design', 'Accessibility', 'Handoff to devs']],
      ['Advanced', ['Design strategy', 'Data-informed design', 'Motion design', 'Leading research']],
      ['Get Hired', ['Portfolio with case studies', 'Dribbble/Behance presence', 'Networking', 'Design challenges']]
    ]),
    'digital marketer': roadmap('Digital Marketer', [
      ['Foundations', ['Marketing fundamentals', 'Audience & personas', 'Content basics', 'Analytics mindset']],
      ['Core Channels', ['SEO', 'Social media marketing', 'Email marketing', 'Paid ads (Google/Meta)']],
      ['Professional', ['Google Analytics', 'Copywriting', 'Funnels & CRO', 'Marketing automation']],
      ['Advanced', ['Growth strategy', 'Brand building', 'Data-driven campaigns', 'Team leadership']],
      ['Get Hired', ['Run a real campaign', 'Certifications (Google/HubSpot)', 'Portfolio of results', 'Resume & interviews']]
    ])
  };

  function roadmap(title, stages) {
    return {
      title,
      stages: stages.map((s, i) => ({ phase: 'Phase ' + (i + 1), name: s[0], skills: s[1] }))
    };
  }

  function buildRoadmap(career) {
    const key = (career || '').trim().toLowerCase();
    if (!key) throw new ToolError('Enter the career you want to pursue.', 'no-career');
    // exact/fuzzy match against curated set
    let match = ROADMAPS[key];
    if (!match) {
      const hit = Object.keys(ROADMAPS).find(k => key.includes(k) || k.includes(key) || overlap(k, key));
      if (hit) match = ROADMAPS[hit];
    }
    if (match) return { ...match, curated: true, months: match.stages.length * 2 };
    return { ...genericRoadmap(career), curated: false, months: 10 };
  }
  function overlap(a, b) {
    const wa = new Set(a.split(' ')); return b.split(' ').some(w => wa.has(w) && w.length > 3);
  }
  function genericRoadmap(career) {
    const C = cap(career.trim());
    return roadmap(C, [
      ['Foundations', ['Understand what ' + C + ' really do', 'Core theory & vocabulary', 'Essential tools of the field', 'Set up your learning plan']],
      ['Core Skills', ['Hands-on fundamentals', 'Follow structured courses', 'Build 2 small projects', 'Join a community']],
      ['Professional', ['Intermediate techniques', 'Real-world project', 'Learn industry best practices', 'Find a mentor']],
      ['Advanced', ['Specialise in a niche', 'Advanced tools & workflows', 'Portfolio-grade project', 'Certifications if relevant']],
      ['Get Hired', ['Polished portfolio', 'Network & personal brand', 'Resume tailored to ' + C, 'Mock interviews & apply']]
    ]);
  }



  /* ---- PDF text extraction (best-effort, no external libs) ----
     Extracts text from simple/uncompressed PDF text streams. Many PDFs use
     compressed (FlateDecode) streams that can't be read without a full parser,
     so we detect that and ask the user to paste text instead — with a clear
     message rather than silent failure. */
  async function extractPdfText(file) {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let latin = '';
    for (let i = 0; i < bytes.length; i++) latin += String.fromCharCode(bytes[i]);

    if (/\/FlateDecode|\/Fes|\/LZW/.test(latin) && !/BT[\s\S]*?ET/.test(latin.slice(0, 4000))) {
      // Likely compressed; try text anyway but warn if nothing extractable.
    }
    // Pull text from BT..ET blocks: gather (..) and <..> string operands of Tj/TJ.
    let out = '';
    const btRe = /BT([\s\S]*?)ET/g;
    let m;
    while ((m = btRe.exec(latin))) {
      const block = m[1];
      const strRe = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g;
      let sm;
      while ((sm = strRe.exec(block))) {
        let s = sm[0];
        if (s[0] === '(') {
          s = s.slice(1, -1).replace(/\\([()\\nrt])/g, (_, c) => ({ n: '\n', r: '', t: ' ', '(': '(', ')': ')', '\\': '\\' }[c] ?? c));
          out += s + ' ';
        } else {
          const hex = s.slice(1, -1).replace(/\s+/g, '');
          for (let i = 0; i + 1 < hex.length; i += 2) { const code = parseInt(hex.substr(i, 2), 16); if (code) out += String.fromCharCode(code); }
          out += ' ';
        }
      }
      out += '\n';
    }
    out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (out.replace(/\s/g, '').length < 30) {
      throw new ToolError('This PDF appears to be scanned or compressed, so text could not be read in the browser. Please copy the syllabus text and paste it into the box instead.', 'pdf-unreadable');
    }
    return out;
  }

  window.Tools = {
    generateNotes, generateMock, generateRoadmap: async c => new Promise((res, rej) => setTimeout(() => { try { res(buildRoadmap(c)); } catch (e) { rej(e); } }, 250)),
    simplifyNotes, buildMockFromText, buildMockFromTopic, buildRoadmap,
    getWellness, getActivity, extractPdfText, ToolError,
    _internal: { keyTerms, sentences }
  };
})();
