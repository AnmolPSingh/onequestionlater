// Where the thread goes on the philosophy page, in % of the stage. It wanders, doubles back and leaves
// the frame; the same points come back later with new lines between them.
export const FOUND = [
  { line: 'I started with stories.', word: 'stories', at: 0.04, wide: { x: 6, y: 14 }, narrow: { x: 4, y: 8 } },
  { line: 'That led me to journalism.', word: 'journalism', at: 0.13, wide: { x: 32, y: 36 }, narrow: { x: 26, y: 18 } },
  { line: 'Then radio.', word: 'radio', at: 0.22, wide: { x: 12, y: 58 }, narrow: { x: 8, y: 29 } },
  { line: 'Then music.', word: 'music', at: 0.3, wide: { x: 38, y: 78 }, narrow: { x: 62, y: 31 } },
  { line: 'Then film.', word: 'film', at: 0.38, wide: { x: 57, y: 52 }, narrow: { x: 34, y: 42 } },
  { line: 'Then design.', word: 'design', at: 0.46, wide: { x: 50, y: 18 }, narrow: { x: 6, y: 50 } },
  { line: 'Then technology.', word: 'technology', at: 0.54, wide: { x: 72, y: 12 }, narrow: { x: 48, y: 57 } },
  { line: 'Then XR.', word: 'XR', at: 0.62, wide: { x: 88, y: 36 }, narrow: { x: 80, y: 47 } },
  { line: 'Then AI.', word: 'AI', at: 0.7, wide: { x: 74, y: 70 }, narrow: { x: 74, y: 66 } },
  { line: 'And somehow, philanthropy.', word: 'philanthropy', at: 0.82, wide: { x: 16, y: 88 }, narrow: { x: 5, y: 84 } },
];

// What the visitor sees reconnect: journalism and AI, music and XR, design and philanthropy, technology and stories.
export const RECONNECT: [number, number][] = [[1, 8], [3, 7], [5, 9], [6, 0]];

export const LEFT_BEHIND = [
  'Journalism taught me to question.',
  'Music taught me to experiment.',
  'Film taught me to tell stories.',
  'Design taught me to understand before solving.',
  'Technology taught me to build systems.',
  'XR taught me to step inside ideas.',
  'AI changed the scale of what I could explore.',
];
export const KEYWORDS = ['QUESTION', 'EXPERIMENT', 'STORY', 'UNDERSTAND', 'SYSTEM', 'STEP INSIDE', 'SCALE'];

export const LOOP = ['I get curious.', 'I follow it.', 'I learn whatever the question demands.', 'I make something.', 'And somewhere along the way...', 'another door opens.'];
