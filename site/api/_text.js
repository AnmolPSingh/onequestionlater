// Small text helpers shared by the chat and the voice. The underscore keeps Vercel from serving this file.

// How many single-letter edits turn one word into another.
export function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

// The words in a piece of text, lower case, without punctuation.
export const words = (text = '') => text.toLowerCase().match(/[a-z0-9']+/g) || [];
