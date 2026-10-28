/* The result of the most recent placement test (opened from the profile) with the personalised plan. */
import { h } from '../ui.js';
import { get } from '../api.js';
import { t } from '../i18n.js';
import { resultCard, levelName } from './level-info.js';

export default async function results() {
  const lv = await get('/me/level');
  if (!lv.assessment) return { el: h('div', { class: 'card center' }, h('h1', {}, t('result.none_title')), h('p', { class: 'muted' }, t('result.none_text')), h('a', { class: 'btn', href: '/profile' }, t('result.take_test'))), title: t('result.title'), nav: 'profile' };
  const a = lv.assessment;
  const note = lv.level !== a.level ? h('p', { class: 'notice' }, t('result.level_changed_since', { current: levelName(lv.level), tested: levelName(a.level) })) : null;
  const el = h('div', { class: 'result-wrap' }, note, resultCard(a, lv.plan, { after: h('div', { class: 'stack' }, h('a', { class: 'btn block', href: '/' }, t('result.start_learning')), h('a', { class: 'btn secondary block', href: '/profile' }, t('result.back_profile'))) }));
  return { el, title: t('result.title'), nav: 'profile' };
}
