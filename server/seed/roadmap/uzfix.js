/* Uzbek texts are authored in the old spelling and converted to the new alphabet when seeded; English words and quoted English stay as written. */
const fs = require('node:fs');
const path = require('node:path');
const { convertText } = require('../../lib/uz-convert');

let cache = null;
function englishWords() {
  if (cache) return cache;
  const set = new Set();
  try { const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8')); for (const v of Object.values(en)) for (const w of JSON.stringify(v).split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); } catch (_) { /* no file */ }
  return (cache = set);
}
const wordsIn = (s, set) => { for (const w of String(s || '').split(/[^A-Za-z]+/)) if (w) set.add(w.toLowerCase()); return set; };
function toNewUz(text, keep) {
  return String(text).split(/(“[^”]*”)/).map((part, i) => (i % 2 ? part : convertText(part, keep || englishWords()))).join('');
}
module.exports = { toNewUz, englishWords, wordsIn };
