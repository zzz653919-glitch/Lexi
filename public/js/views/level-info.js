/* Shared pieces of the placement / level screens: level names, skill bars, the personalised plan and the result card. */
import { h, icon } from '../ui.js';
import { t } from '../i18n.js';
import { burst, countUp, play } from '../motion.js';

export const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const SKILLS = ['vocabulary', 'grammar', 'reading', 'usage', 'listening'];
export const levelName = (code) => t('level.' + code + '.name');
export const levelShort = (code) => t('level.' + code + '.short');
export const skillName = (s) => t('skill.' + s);

/* the level as a coloured badge */
export const levelBadge = (code, cls = '') => h('span', { class: 'level-badge lv-' + code + ' ' + cls, 'aria-label': levelName(code) }, levelShort(code));

/* one bar per skill: share of correct answers, animated from 0 */
export function skillBars(skills) {
  const rows = SKILLS.filter((s) => skills && skills[s]).map((s) => {
    const x = skills[s];
    const fill = h('i', { style: { width: '0%' } });
    setTimeout(() => { fill.style.width = x.percent + '%'; }, 80);
    return h('li', { class: 'skill-row' },
      h('div', { class: 'row between' }, h('b', {}, skillName(s)), h('span', { class: 'muted small' }, x.level ? `${levelShort(x.level)} · ${x.percent}%` : `${x.percent}%`)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': x.percent, 'aria-label': skillName(s) }, fill));
  });
  return h('ul', { class: 'skill-list' }, rows);
}

export const skillChips = (list, cls) => list.map((s) => h('span', { class: 'chip ' + cls }, icon(cls === 'ok' ? 'check' : 'target'), skillName(s)));

/* the plan is stored as data: each step is { key, params } and is worded here, in the interface language */
export function planList(plan) {
  return h('ol', { class: 'plan-list' }, plan.steps.map((s) => {
    const p = { ...s.params };
    if (p.skills) p.skills = p.skills.map(skillName).join(', ');
    if (p.level) p.level = levelShort(p.level);
    return h('li', {}, t('plan.step_' + s.key, p));
  }));
}

/* the full result of a placement test */
export function resultCard(a, plan, { after } = {}) {
  const r = a.result || a;
  const pctEl = h('b', {}, '0%');
  const card = h('div', { class: 'placement-result stack' },
    h('div', { class: 'card result-hero center' },
      h('img', { src: '/img/mascot.svg', alt: '', width: 96, height: 96 }),
      h('span', { class: 'eyebrow' }, t('result.your_level')),
      levelBadge(r.level, 'big pop'),
      h('h1', {}, levelName(r.level)),
      h('p', { class: 'muted' }, t('level.' + r.level + '.desc')),
      h('div', { class: 'result-stats' },
        h('div', { class: 'card acc' }, pctEl, h('span', { class: 'muted small' }, t('result.score'))),
        h('div', { class: 'card' }, h('b', {}, `${r.correct}/${r.asked}`), h('span', { class: 'muted small' }, t('result.correct_of'))),
        h('div', { class: 'card' }, h('b', {}, t('result.confidence_' + r.confidence)), h('span', { class: 'muted small' }, t('result.confidence')))),
      h('p', { class: 'notice small', role: 'note' }, t('result.estimate_note'))),
    Object.keys(r.skills || {}).length ? h('section', { class: 'card' }, h('h2', {}, t('result.skills')), skillBars(r.skills)) : null,
    (r.strengths && r.strengths.length) || (r.weaknesses && r.weaknesses.length) ? h('section', { class: 'card' },
      r.strengths.length ? h('div', {}, h('h2', {}, t('result.strengths')), h('div', { class: 'chips' }, skillChips(r.strengths, 'ok'))) : null,
      r.weaknesses.length ? h('div', { style: { marginTop: r.strengths.length ? '14px' : 0 } }, h('h2', {}, t('result.improve')), h('div', { class: 'chips' }, skillChips(r.weaknesses, 'warn'))) : null) : null,
    plan ? h('section', { class: 'card' }, h('h2', {}, t('result.plan')), planList(plan)) : null,
    after || null);
  setTimeout(() => { countUp(pctEl, 0, r.percent, { format: (v) => v + '%' }); burst(null, { kind: 'confetti' }); play(card.querySelector('.level-badge'), 'stat-pop', 700); }, 150);
  return card;
}
