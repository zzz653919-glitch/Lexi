import { h, icon, speak, canSpeak, toast, spinner } from '../ui.js';
import { get, post } from '../api.js';
import { t, n } from '../i18n.js';
import { showLoader } from '../loaders.js';

const FILTERS = ['all', 'new', 'learning', 'due', 'difficult'];
const MODES = [['flashcards', 'cards'], ['choice', 'list'], ['typed', 'edit'], ['spelling', 'volume']];

export default async function vocabulary({ query }) {
  const st = { q: query.get('q') || '', filter: query.get('filter') || 'all', page: 1, level: '' };
  const list = h('div', { class: 'stack', 'aria-live': 'polite' });
  const pager = h('div', { class: 'pager' });
  const summary = await get('/review/summary');
  const qInput = h('input', { class: 'input', type: 'search', placeholder: t('vocab.search_ph'), 'aria-label': t('vocab.search'), value: st.q });
  const chips = h('div', { class: 'filter-chips', role: 'group', 'aria-label': t('vocab.filter') });

  async function load() {
    const stop = showLoader(list, 'vocab', { compact: true, onRetry: () => load() });
    const params = new URLSearchParams({ filter: st.filter, page: String(st.page), pageSize: '15' });
    if (st.q) params.set('q', st.q); if (st.level) params.set('level', st.level);
    let data;
    try { data = await get('/vocabulary?' + params); } finally { stop(); }
    chips.replaceChildren(...FILTERS.map((v) => h('button', { type: 'button', class: 'fchip', 'aria-pressed': String(st.filter === v), onclick: () => { st.filter = v; st.page = 1; load(); } }, t('vocab.filter_' + v))));
    if (!data.items.length) list.replaceChildren(h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('p', {}, st.filter === 'all' && !st.q ? t('vocab.empty') : t('vocab.no_match'))));
    else list.replaceChildren(...data.items.map(wordCard));
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    pager.replaceChildren(h('button', { class: 'btn secondary small', disabled: st.page <= 1, onclick: () => { st.page--; load(); } }, t('common.previous')), h('span', { class: 'muted' }, t('vocab.page_of', { page: st.page, pages, words: n('count.words', data.total) })), h('button', { class: 'btn secondary small', disabled: st.page >= pages, onclick: () => { st.page++; load(); } }, t('common.next')));
  }
  function wordCard(w) {
    const dBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': String(w.difficult), 'aria-label': t('vocab.mark_difficult', { word: w.en }), title: t('vocab.difficult_word'), onclick: async () => { const next = dBtn.getAttribute('aria-pressed') !== 'true'; await post(`/vocabulary/${w.id}/difficult`, { difficult: next }); dBtn.setAttribute('aria-pressed', String(next)); toast(next ? t('vocab.difficult_added') : t('vocab.difficult_removed'), 'info', 1800); } }, icon('flag'));
    const status = { new: [t('vocab.filter_new'), ''], learning: [t('vocab.filter_learning'), 'info'], due: [t('vocab.filter_due'), 'warn'] }[w.status];
    const acts = h('div', { class: 'acts' }, canSpeak() || w.audio_url ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('vocab.hear', { word: w.en }), onclick: () => speak(w.audio_url ? { url: w.audio_url } : { text: w.en }) }, icon('volume')) : null, dBtn,
      w.status === 'new' ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('vocab.add_to_review', { word: w.en }), title: t('vocab.add_to_review_short'), onclick: async (e) => { const btn = e.currentTarget; await post('/vocabulary/add-to-review', { ids: [w.id] }); btn.disabled = true; toast(t('vocab.added_to_review'), 'success', 1800); } }, icon('plus')) : null);
    return h('article', { class: 'card word' }, h('div', {}, h('div', { class: 'en', lang: 'en' }, w.en, ' ', h('span', { class: `chip ${status[1]}`, style: { marginLeft: '6px' } }, status[0])), h('div', { class: 'uz', lang: w.translationLanguage }, w.translation, w.pos ? h('span', { class: 'muted small' }, ' · ' + w.pos) : null, w.level ? h('span', { class: 'badge', style: { marginLeft: '6px' } }, w.level) : null)), acts,
      w.example ? h('div', { class: 'ex', lang: 'en' }, w.example, w.example_translation ? h('div', { lang: w.translationLanguage }, w.example_translation) : null) : null);
  }
  let timer; qInput.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { st.q = qInput.value.trim(); st.page = 1; load(); }, 300); });
  const levelSel = h('select', { class: 'input', 'aria-label': t('vocab.level'), onchange: (e) => { st.level = e.target.value; st.page = 1; load(); } }, [['', t('vocab.all_levels')], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2'], ['C1', 'C1']].map(([v, l]) => h('option', { value: v }, l)));
  const el = h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('h1', {}, t('nav.vocabulary')), h('div', { class: 'chips' }, h('span', { class: 'chip warn' }, t('vocab.n_due', { n: summary.due })), h('span', { class: 'chip' }, t('vocab.n_in_review', { n: summary.total })), h('span', { class: 'chip bad' }, icon('flag'), t('vocab.n_difficult', { n: summary.difficult })))),
    h('section', { class: 'card' }, h('h2', {}, t('vocab.practise')), h('div', { class: 'grid two' }, MODES.map(([m, ic]) => h('a', { class: 'card mode-card', href: '/review?mode=' + m, style: { textDecoration: 'none', color: 'inherit', marginTop: 0 } }, h('div', { class: 'ico' }, icon(ic)), h('div', {}, h('h3', {}, t('review.mode.' + m)), h('p', {}, t('vocab.mode.' + m))))))),
    h('section', {}, h('div', { class: 'search-row' }, qInput, levelSel), chips, list, pager));
  await load();
  return { el, title: t('nav.vocabulary'), nav: 'vocabulary' };
}
