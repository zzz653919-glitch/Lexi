import { h, icon, speak, canSpeak, toast, spinner } from '../ui.js';
import { get, post } from '../api.js';
import { navigate } from '../app.js';

const FILTERS = [['all', 'All'], ['new', 'New'], ['learning', 'Learning'], ['due', 'Due'], ['difficult', 'Difficult']];
const MODES = [['flashcards', 'Flashcards', 'cards', 'Flip cards and say if you knew the word.'], ['choice', 'Multiple choice', 'list', 'Pick the right translation.'], ['typed', 'Typed answers', 'edit', 'Type the translation yourself.'], ['spelling', 'Spelling', 'volume', 'Listen and spell the English word.']];

export default async function vocabulary({ query }) {
  const st = { q: query.get('q') || '', filter: query.get('filter') || 'all', page: 1, level: '' };
  const list = h('div', { class: 'stack', 'aria-live': 'polite' });
  const pager = h('div', { class: 'pager' });
  const summary = await get('/review/summary');
  const qInput = h('input', { class: 'input', type: 'search', placeholder: 'Search words…', 'aria-label': 'Search words', value: st.q });
  const chips = h('div', { class: 'filter-chips', role: 'group', 'aria-label': 'Filter' });

  async function load() {
    list.replaceChildren(spinner());
    const params = new URLSearchParams({ filter: st.filter, page: String(st.page), pageSize: '15' });
    if (st.q) params.set('q', st.q); if (st.level) params.set('level', st.level);
    const data = await get('/vocabulary?' + params);
    chips.replaceChildren(...FILTERS.map(([v, l]) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(st.filter === v), onclick: () => { st.filter = v; st.page = 1; load(); } }, l)));
    if (!data.items.length) list.replaceChildren(h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('p', {}, st.filter === 'all' && !st.q ? 'No vocabulary is available for this course yet.' : 'No words match. Try another filter.')));
    else list.replaceChildren(...data.items.map(wordCard));
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    pager.replaceChildren(h('button', { class: 'btn secondary small', disabled: st.page <= 1, onclick: () => { st.page--; load(); } }, 'Previous'), h('span', { class: 'muted' }, `Page ${st.page} of ${pages} · ${data.total} words`), h('button', { class: 'btn secondary small', disabled: st.page >= pages, onclick: () => { st.page++; load(); } }, 'Next'));
  }
  function wordCard(w) {
    const dBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': String(w.difficult), 'aria-label': `Mark “${w.en}” as difficult`, title: 'Difficult word', onclick: async () => { const next = dBtn.getAttribute('aria-pressed') !== 'true'; await post(`/vocabulary/${w.id}/difficult`, { difficult: next }); dBtn.setAttribute('aria-pressed', String(next)); toast(next ? 'Added to your difficult words' : 'Removed from difficult words', 'info', 1800); } }, icon('flag'));
    const status = { new: ['New', ''], learning: ['Learning', 'info'], due: ['Due', 'warn'] }[w.status];
    const acts = h('div', { class: 'acts' }, canSpeak() || w.audio_url ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Hear “${w.en}”`, onclick: () => speak(w.audio_url ? { url: w.audio_url } : { text: w.en }) }, icon('volume')) : null, dBtn,
      w.status === 'new' ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Add “${w.en}” to review`, title: 'Add to review', onclick: async (e) => { await post('/vocabulary/add-to-review', { ids: [w.id] }); e.currentTarget.disabled = true; toast('Added to your review list', 'success', 1800); } }, icon('plus')) : null);
    return h('article', { class: 'card word' }, h('div', {}, h('div', { class: 'en', lang: 'en' }, w.en, ' ', h('span', { class: `chip ${status[1]}`, style: { marginLeft: '6px' } }, status[0])), h('div', { class: 'uz' }, w.uz, w.pos ? h('span', { class: 'muted small' }, ' · ' + w.pos) : null, w.level ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, w.level) : null)), acts,
      w.example ? h('div', { class: 'ex', lang: 'en' }, w.example, w.example_uz ? h('div', {}, w.example_uz) : null) : null);
  }
  let timer; qInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = qInput.value.trim(); st.page = 1; load(); }, 300); });
  const levelSel = h('select', { class: 'input', 'aria-label': 'Level', onchange: (e) => { st.level = e.target.value; st.page = 1; load(); } }, [['', 'All levels'], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2'], ['C1', 'C1']].map(([v, l]) => h('option', { value: v }, l)));
  const el = h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('h1', {}, 'Vocabulary'), h('div', { class: 'chips' }, h('span', { class: 'chip warn' }, `${summary.due} due`), h('span', { class: 'chip' }, `${summary.total} in review`), h('span', { class: 'chip bad' }, icon('flag'), `${summary.difficult} difficult`))),
    h('section', { class: 'card' }, h('h2', {}, 'Practise your words'), h('div', { class: 'grid two' }, MODES.map(([m, label, ic, desc]) => h('a', { class: 'card mode-card', href: '/review?mode=' + m, style: { textDecoration: 'none', color: 'inherit', marginTop: 0 } }, h('div', { class: 'ico' }, icon(ic)), h('div', {}, h('h3', {}, label), h('p', {}, desc)))))),
    h('section', {}, h('div', { class: 'search-row' }, qInput, levelSel), chips, list, pager));
  await load();
  return { el, title: 'Vocabulary', nav: 'vocabulary' };
}
