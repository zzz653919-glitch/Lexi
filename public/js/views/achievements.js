/* The Achievements page: every achievement with its 3D medal, rewards and progress; totals and completion; filters by category, rarity and state. */
import { h, icon } from '../ui.js';
import { get } from '../api.js';
import { t, fmt } from '../i18n.js';
import { loadAchievementsCss, medal, tilt, rarityPill, rewardChips } from '../achievements/ui.js';

const IC = { flame: 'flame', bolt: 'bolt', trophy: 'trophy', target: 'target', cards: 'cards', flag: 'flag', path: 'path', star: 'star' };
export const achievementIcon = (name) => IC[name] || 'star';

export default async function achievements() {
  const [d] = await Promise.all([get('/achievements'), loadAchievementsCss()]);
  const st = { category: '', rarity: '', status: '' };
  const sum = d.summary;
  const grid = h('div', { class: 'ach-grid', id: 'ach-grid' }), counter = h('span', { class: 'muted small', id: 'ach-shown', 'aria-live': 'polite' });
  const chipRow = (key, values, label, nameOf) => {
    const row = h('div', { class: 'ach-filter-row', role: 'group', 'aria-label': label }, h('b', {}, label));
    const btns = [['', t('ach.all')], ...values.map((v) => [v, nameOf(v)])].map(([v, text]) => {
      const b = h('button', { type: 'button', class: 'ach-chip', 'data-filter': key, 'data-value': v, 'aria-pressed': String(st[key] === v), onclick: () => { st[key] = v; btns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.value === st[key]))); draw(); } }, text);
      return b;
    });
    row.append(...btns);
    return row;
  };
  const statusRow = chipRow('status', ['unlocked', 'locked'], t('ach.filter_status'), (v) => t('ach.status_' + v));
  const catRow = chipRow('category', d.categories.filter((c) => sum.category[c] && sum.category[c].total > 0), t('ach.filter_category'), (c) => `${t('ach.cat.' + c)} (${sum.category[c].unlocked}/${sum.category[c].total})`);
  const rarRow = chipRow('rarity', d.rarities.filter((r) => sum.rarity[r] && sum.rarity[r].total > 0), t('ach.filter_rarity'), (r) => `${t('ach.rarity.' + r)} (${sum.rarity[r].unlocked}/${sum.rarity[r].total})`);

  function item(a) {
    const med = medal(a, icon, { size: 88, locked: !a.unlocked });
    const prog = a.unlocked
      ? h('div', { class: 'ach-when' }, icon('check'), ' ', t('ach.earned', { date: fmt.date(a.earnedAt) }))
      : h('div', { class: 'ach-prog' }, h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': a.target, 'aria-valuenow': a.progress, 'aria-label': a.title }, h('i', { style: { width: a.percent + '%' } })),
        h('small', {}, h('span', {}, t('ach.progress', { have: a.progress, total: a.target })), h('span', {}, a.percent + '%')));
    const card = h('article', { class: `card ach-item r-${a.rarity} ${a.unlocked ? 'is-unlocked' : 'locked'}`, 'data-code': a.code, 'data-category': a.category, 'data-rarity': a.rarity, 'data-unlocked': a.unlocked ? '1' : '0' },
      med, h('div', { class: 'ach-body' }, h('div', { class: 'row between' }, h('h3', {}, a.title), rarityPill(a.rarity)), h('p', {}, a.description),
        h('div', { class: 'ach-rewards', 'aria-label': t('ach.rewards') }, rewardChips(a, { earned: a.unlocked })), prog));
    tilt(card, med);
    return card;
  }
  function draw() {
    const list = d.items.filter((a) => (!st.category || a.category === st.category) && (!st.rarity || a.rarity === st.rarity) && (!st.status || (st.status === 'unlocked') === a.unlocked));
    grid.replaceChildren(...(list.length ? list.map(item) : [h('p', { class: 'muted', id: 'ach-empty' }, t('ach.empty'))]));
    counter.textContent = `${list.length} / ${d.items.length}`;
  }
  draw();

  const el = h('div', { class: 'stack ach-page' },
    h('div', { class: 'page-head' }, h('h1', {}, t('nav.achievements')), counter),
    h('section', { class: 'card ach-hero', 'aria-labelledby': 'ach-sum' },
      h('div', { class: 'ach-ring', style: { '--p': sum.percent }, role: 'img', 'aria-label': t('ach.completion', { pct: sum.percent }) }, h('b', { id: 'ach-pct' }, sum.percent + '%')),
      h('div', {}, h('h2', { id: 'ach-sum', style: { margin: 0 } }, t('ach.summary', { done: sum.unlocked, total: sum.total })), h('p', { class: 'muted', style: { margin: '2px 0' } }, t('ach.completion', { pct: sum.percent })),
        h('div', { class: 'ach-stats' }, h('span', { class: 'ach-reward xp' }, icon('bolt'), `${sum.xp} · ${t('ach.total_xp')}`), h('span', { class: 'ach-reward tok' }, icon('coin'), `${sum.tokens} · ${t('ach.total_tokens')}`)))),
    h('div', { class: 'ach-filters' }, catRow, rarRow, statusRow), grid);
  return { el, title: t('nav.achievements'), nav: 'achievements' };
}
