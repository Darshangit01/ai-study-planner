/* Optional curated MCQ bank for the "Generate by topic" mock test feature.
   Keyed by lowercase topic keywords. The engine tops up with concept
   questions so ANY topic still produces a full quiz even without a match. */
window.MOCK_BANK = {
  'javascript': [
    { question: 'Which keyword declares a block-scoped variable in JavaScript?', options: ['let', 'var', 'function', 'define'], answer: 0, explain: '`let` (and `const`) are block-scoped; `var` is function-scoped.' },
    { question: 'What does `===` check in JavaScript?', options: ['Value and type', 'Only value', 'Only type', 'Reference address'], answer: 0, explain: '`===` is strict equality: value AND type.' },
    { question: 'Which method converts a JSON string into an object?', options: ['JSON.parse()', 'JSON.stringify()', 'JSON.object()', 'parseJSON()'], answer: 0, explain: 'JSON.parse turns a string into an object.' },
    { question: 'What is the result of typeof null?', options: ['"object"', '"null"', '"undefined"', '"number"'], answer: 0, explain: 'A long-standing quirk: typeof null is "object".' },
    { question: 'Which array method creates a new array from a mapping function?', options: ['map()', 'forEach()', 'push()', 'filter()'], answer: 0, explain: 'map() returns a new transformed array.' }
  ],
  'photosynthesis': [
    { question: 'Where does photosynthesis mainly take place?', options: ['Chloroplast', 'Mitochondria', 'Nucleus', 'Ribosome'], answer: 0, explain: 'Chloroplasts contain chlorophyll for photosynthesis.' },
    { question: 'Which gas is absorbed during photosynthesis?', options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], answer: 0, explain: 'Plants absorb CO₂ and release O₂.' },
    { question: 'What pigment captures light energy?', options: ['Chlorophyll', 'Hemoglobin', 'Melanin', 'Carotene only'], answer: 0, explain: 'Chlorophyll is the primary light-absorbing pigment.' },
    { question: 'The products of photosynthesis are glucose and…', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Methane'], answer: 0, explain: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.' }
  ],
  'world war': [
    { question: 'In which year did World War II end?', options: ['1945', '1918', '1939', '1950'], answer: 0, explain: 'WWII ended in 1945.' },
    { question: 'World War I began in which year?', options: ['1914', '1939', '1901', '1920'], answer: 0, explain: 'WWI started in 1914.' },
    { question: 'Which alliance opposed the Axis powers in WWII?', options: ['The Allies', 'The Central Powers', 'The League', 'The Union'], answer: 0, explain: 'The Allies fought the Axis powers.' }
  ]
};
