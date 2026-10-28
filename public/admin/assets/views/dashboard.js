import { h, get, qs, table, tag, when, t, fmt } from '../common.js';
import { barChart } from './charts.js';

export default async function dashboard({ query }) {
  const days = [7, 30, 90].includes(Number(query.get('days'))) ? Number(query.get('days')) : 30;
  const d = await get('/admin/stats' + qs({ days }));
  const tot = d.totals;
  const num = (v) => (v == null ? '—' : fmt.number(v));
  const card = (v, label) => h('div', { class: 'stat-card' }, h('b', {}, v), h('span', {}, label));
  const chart = (title, series, label) => h('section', { class: 'card' }, h('h2', {}, title), barChart(series, { label }));
  const el = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.dashboard')), h('label', { class: 'field', style: { margin: 0 } }, h('span', { class: 'sr-only' }, t('adm.period')), h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { history.pushState({}, '', '/admin?days=' + e.target.value); location.reload(); } }, [7, 30, 90].map((n) => h('option', { value: n, selected: n === days }, t('adm.last_days', { n })))))),
    h('div', { class: 'stat-grid' }, card(num(tot.users), t('adm.stat.users')), card(num(d.active.d1), t('adm.stat.active_today')), card(num(d.active.d7), t('adm.stat.active_7')), card(num(d.active.d30), t('adm.stat.active_30')), card(`${fmt.number(tot.publishedCourses)}/${fmt.number(tot.courses)}`, t('adm.stat.published_courses')), card(num(tot.lessons), t('adm.stat.lessons')), card(num(tot.exercises), t('adm.stat.exercises')), card(num(tot.vocabulary), t('adm.stat.vocabulary')), card(num(tot.completedLessons), t('adm.stat.completed_lessons')), card(num(tot.exerciseAttempts), t('adm.stat.attempts')), card(tot.accuracy == null ? '—' : tot.accuracy + '%', t('adm.stat.accuracy')), card(num(tot.suspended), t('adm.stat.suspended'))),
    h('div', { class: 'grid two' }, chart(t('adm.chart.signups'), d.signups, t('adm.chart.signups_day')), chart(t('adm.chart.active'), d.activeUsers, t('adm.chart.active_day')), chart(t('adm.chart.completions'), d.completions, t('adm.chart.completions_day')), chart(t('adm.chart.attempts'), d.attemptsPerDay, t('adm.chart.attempts_day'))),
    h('section', { class: 'card' }, h('h2', {}, t('adm.course_completion')), table([
      { label: t('adm.col.course'), render: (c) => h('a', { href: '/admin/courses/' + c.id }, c.title) }, { label: t('adm.col.status'), render: (c) => tag(c.status) },
      { label: t('adm.col.lessons'), render: (c) => fmt.number(c.lessons) }, { label: t('adm.col.learners_started'), render: (c) => fmt.number(c.learners) }, { label: t('adm.col.lessons_completed'), render: (c) => fmt.number(c.completed_lessons) }, { label: t('adm.col.learners_finished'), render: (c) => fmt.number(c.finished_learners) },
    ], d.courses)),
    h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, t('adm.recent_activity')), h('a', { href: '/admin/audit' }, t('adm.full_log'))), table([
      { label: t('adm.col.when'), render: (a) => when(a.created_at) }, { label: t('adm.col.who'), render: (a) => a.admin_email }, { label: t('adm.col.action'), render: (a) => a.action }, { label: t('adm.col.item'), render: (a) => `${a.entity} ${a.entity_id}` },
    ], d.recentAudit, { empty: t('adm.no_activity') })));
  return { el, title: t('adm.nav.dashboard'), nav: 'dashboard' };
}
