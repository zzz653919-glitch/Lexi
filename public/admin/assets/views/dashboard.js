import { h, icon, get, qs, table, tag, when } from '../common.js';
import { barChart } from './charts.js';

export default async function dashboard({ query }) {
  const days = [7, 30, 90].includes(Number(query.get('days'))) ? Number(query.get('days')) : 30;
  const d = await get('/admin/stats' + qs({ days }));
  const t = d.totals;
  const card = (n, label) => h('div', { class: 'stat-card' }, h('b', {}, n == null ? '—' : String(n)), h('span', {}, label));
  const chart = (title, series, label) => h('section', { class: 'card' }, h('h2', {}, title), barChart(series, { label }));
  const el = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, 'Dashboard'), h('label', { class: 'field', style: { margin: 0 } }, h('span', { class: 'sr-only' }, 'Period'), h('select', { class: 'input', style: { width: 'auto' }, onchange: (e) => { history.pushState({}, '', '/admin?days=' + e.target.value); location.reload(); } }, [7, 30, 90].map((n) => h('option', { value: n, selected: n === days }, `Last ${n} days`))))),
    h('div', { class: 'stat-grid' }, card(t.users, 'Registered users'), card(d.active.d1, 'Active today'), card(d.active.d7, 'Active in 7 days'), card(d.active.d30, 'Active in 30 days'), card(`${t.publishedCourses}/${t.courses}`, 'Published courses'), card(t.lessons, 'Lessons'), card(t.exercises, 'Exercises'), card(t.vocabulary, 'Vocabulary words'), card(t.completedLessons, 'Lessons completed'), card(t.exerciseAttempts, 'Exercise attempts'), card(t.accuracy == null ? '—' : t.accuracy + '%', 'Answer accuracy'), card(t.suspended, 'Suspended accounts')),
    h('div', { class: 'grid two' }, chart('New sign-ups', d.signups, 'New sign-ups per day'), chart('Active learners', d.activeUsers, 'Active learners per day'), chart('Lessons completed', d.completions, 'Lessons completed per day'), chart('Exercise attempts', d.attemptsPerDay, 'Exercise attempts per day')),
    h('section', { class: 'card' }, h('h2', {}, 'Course completion'), table([
      { label: 'Course', render: (c) => h('a', { href: '/admin/courses/' + c.id }, c.title) }, { label: 'Status', render: (c) => tag(c.status) },
      { label: 'Lessons', render: (c) => String(c.lessons) }, { label: 'Learners started', render: (c) => String(c.learners) }, { label: 'Lessons completed', render: (c) => String(c.completed_lessons) }, { label: 'Learners finished', render: (c) => String(c.finished_learners) },
    ], d.courses)),
    h('section', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, 'Recent administrative activity'), h('a', { href: '/admin/audit' }, 'Full log')), table([
      { label: 'When', render: (a) => when(a.created_at) }, { label: 'Who', render: (a) => a.admin_email }, { label: 'Action', render: (a) => a.action }, { label: 'Item', render: (a) => `${a.entity} ${a.entity_id}` },
    ], d.recentAudit, { empty: 'No activity recorded yet.' })));
  return { el, title: 'Dashboard', nav: 'dashboard' };
}
