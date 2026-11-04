/* The IELTS Preparation Center: strategy lessons, practice tests with estimated bands, Writing and Speaking practice. */
import { h, icon } from '../ui.js';
import { get } from '../api.js';
import { t } from '../i18n.js';
import { startAttempt } from './start.js';

const SKILL_ICON = { listening: 'volume', reading: 'book', writing: 'edit', speaking: 'volume', mixed: 'list' };

export default async function ielts() {
  const d = await get('/ielts');
  if (!d.course) return { el: h('div', { class: 'card empty' }, h('h2', {}, t('ielts.unavailable')), h('p', {}, t('ielts.unavailable_text'))), title: t('ielts.title'), nav: 'learn' };
  const band = (v) => h('div', { class: 'card stat band-card' }, h('div', {}, h('b', {}, v === null ? '—' : v.toFixed(1)), h('span', {}, '')));
  const bandBox = (label, v) => h('div', { class: 'card stat' }, h('div', {}, h('b', {}, v === null ? '—' : v.toFixed(1)), h('span', {}, label)));
  const lessonRow = (l) => h('li', { class: 'ielts-lesson ' + l.state },
    h('span', { class: 'ico' }, icon(l.state === 'completed' ? 'check' : SKILL_ICON[l.skill] || 'play')),
    h('div', { class: 'ielts-info' }, h('b', {}, l.title), h('div', { class: 'muted small' }, l.kind === 'practice_test' ? t('ielts.kind_test', { n: l.exercises }) : t('ielts.kind_lesson', { n: l.exercises }), l.band ? ' · ' + t('ielts.best_band', { band: l.band }) : l.bestScore !== null && l.bestScore !== undefined ? ' · ' + l.bestScore + '%' : '')),
    h('button', { class: 'btn small' + (l.state === 'completed' ? ' secondary' : ''), type: 'button', onclick: () => startAttempt(l.id) }, l.inProgress ? t('common.continue') : l.state === 'completed' ? t('path.practise_again') : t('common.start')));
  const el = h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, t('ielts.title')), h('p', { class: 'muted', style: { margin: 0 } }, t('ielts.subtitle')))),
    h('p', { class: 'notice', role: 'note' }, t('ielts.disclaimer')),
    h('div', { class: 'stat-row' }, bandBox(t('ielts.band_listening'), d.bands.listening), bandBox(t('ielts.band_reading'), d.bands.reading), bandBox(t('ielts.band_overall'), d.bands.overall)),
    d.units.map((u) => h('section', { class: 'card', 'aria-label': u.title }, h('div', { class: 'row between' }, h('h2', {}, u.title), h('span', { class: 'muted small' }, t('dashboard.lessons_progress', { done: u.done, total: u.total }))), h('ul', { class: 'ielts-list' }, u.lessons.map(lessonRow)))));
  return { el, title: t('ielts.title'), nav: 'learn' };
}
