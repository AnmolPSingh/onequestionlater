import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spoken } from '../api/transcribe.js';

const seg = (text, no_speech_prob = 0.01, avg_logprob = -0.2) => ({ text, no_speech_prob, avg_logprob });

test('spoken keeps what was clearly said', () => {
  assert.equal(spoken({ segments: [seg(' I am Rajat.')] }), 'I am Rajat.');
  assert.equal(spoken({ segments: [seg(' Tell me about'), seg(' Global Philanthropic.')] }), 'Tell me about Global Philanthropic.');
});

test('spoken drops stretches that are probably silence or barely guessed', () => {
  assert.equal(spoken({ segments: [seg(' Okay.', 0.8)] }), '');
  assert.equal(spoken({ segments: [seg(' Thank you.', 0.2, -1.4)] }), '');
  assert.equal(spoken({ segments: [seg(' Okay.', 0.9), seg(' How much does it cost?')] }), 'How much does it cost?');
});

test('spoken drops the name hint read back on silence, even misspelt', () => {
  assert.equal(spoken({ segments: [seg(' One Quesion Later, Global Philanthropic.')] }), '');
  assert.equal(spoken({ segments: [seg(' Anmol, Anmol AI, Philanthropel.')] }), '');
});

test('spoken keeps a short real mention of a name', () => {
  assert.equal(spoken({ segments: [seg(' Global Philanthropic.')] }), 'Global Philanthropic.');
  assert.equal(spoken({ segments: [seg(' Hi Anmol.')] }), 'Hi Anmol.');
});

test('spoken falls back to plain text when there are no segments', () => {
  assert.equal(spoken({ text: ' Hello there ' }), 'Hello there');
  assert.equal(spoken({}), '');
});
