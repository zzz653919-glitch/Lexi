import { h, get, post, table, tag, crumbs, toast, confirmDialog, typedConfirm, when, session, t, fmt } from '../common.js';
import { barChart } from './charts.js';

export default async function user({ params }) {
  const id = Number(params.id);
  const holder = h('div', {});
  async function load() { draw(await get('/admin/users/' + id)); }
  function draw(d) {
    const u = d.user, me = session.user.id === u.id;
    const act = async (fn, msg) => { try { await fn(); toast(msg, 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); } };
    const roleSel = h('select', { class: 'input', 'aria-label': t('adm.col.role'), disabled: me, style: { width: 'auto' } }, ['learner', 'editor', 'admin'].map((r) => h('option', { value: r, selected: r === u.role }, t('adm.role.' + r))));
    const week = d.week.map((x) => ({ date: x.date, value: x.xp }));
    holder.replaceChildren(
      crumbs({ href: '/admin/users', label: t('adm.nav.users') }, { label: u.displayName }),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, u.displayName), h('div', { class: 'row' }, tag(u.status), h('span', { class: 'badge' }, t('adm.role.' + u.role)), h('span', { class: 'muted small' }, u.email))),
        h('div', { class: 'row' }, u.status === 'active' ? h('button', { class: 'btn danger small', disabled: me, onclick: async () => { if (await confirmDialog(t('adm.suspend_title'), t('adm.suspend_text', { name: u.displayName }), t('adm.suspend'), true)) act(() => post(`/admin/users/${id}/suspend`), t('adm.suspended')); } }, t('adm.suspend')) : h('button', { class: 'btn small', onclick: () => act(() => post(`/admin/users/${id}/reactivate`), t('adm.reactivated')) }, t('adm.reactivate')))),
      h('div', { class: 'stat-grid' }, [['XP', u.xpTotal], [t('stats.streak'), d.streak.current], [t('adm.longest_streak'), d.streak.longest], [t('adm.stat.completed_lessons'), d.lessonsCompleted], [t('adm.answers'), d.attempts], [t('adm.stat.accuracy'), d.accuracy == null ? '—' : d.accuracy + '%'], [t('adm.words_in_review'), d.reviewWords]].map(([l, v]) => h('div', { class: 'stat-card' }, h('b', {}, typeof v === 'number' ? fmt.number(v) : String(v)), h('span', {}, l)))),
      h('div', { class: 'grid two' },
        h('section', { class: 'card' }, h('h2', {}, t('profile.settings')), h('dl', { class: 'kv' }, h('dt', {}, t('adm.col.joined')), h('dd', {}, when(u.createdAt)), h('dt', {}, t('adm.col.last_active')), h('dd', {}, when(u.lastActiveAt)), h('dt', {}, t('profile.timezone')), h('dd', {}, u.timezone), h('dt', {}, t('stats.hearts')), h('dd', {}, d.hearts.enabled ? `${d.hearts.hearts} / ${d.hearts.max}` : t('adm.off')), h('dt', {}, t('adm.today')), h('dd', {}, `${d.today.xp} / ${d.today.goal} XP`), h('dt', {}, t('nav.achievements')), h('dd', {}, d.achievements.map((c) => t('ach.' + c + '.title')).join(', ') || t('adm.none_yet')))),
        h('section', { class: 'card' }, h('h2', {}, t('adm.xp_week')), barChart(week, { label: t('adm.xp_per_day') }))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.col.role')), h('p', { class: 'muted small' }, me ? t('err.cannot_change_own_role') : t('adm.role_help')),
        h('div', { class: 'row' }, roleSel, h('button', { class: 'btn small', disabled: me, onclick: () => act(() => post(`/admin/users/${id}/role`, { role: roleSel.value }), t('adm.role_updated')) }, t('adm.change_role')))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.recent')), table([{ label: t('adm.col.started'), render: (a) => when(a.started_at) }, { label: t('adm.col.what'), render: (a) => a.lesson || (a.kind === 'mistakes' ? t('lesson.mistakes_reviewed') : t('adm.lesson')) }, { label: t('adm.col.result'), render: (a) => t('adm.result', { right: a.correct, wrong: a.incorrect }) }, { label: t('adm.col.status'), render: (a) => tag(a.status) }], d.recent, { empty: t('adm.no_activity_yet') })),
      h('section', { class: 'card' }, h('h2', {}, t('adm.danger_zone')), h('p', { class: 'muted' }, t('adm.reset_help')),
        h('button', { class: 'btn danger small', onclick: async () => { if (await typedConfirm(t('adm.reset_progress'), t('adm.reset_text', { name: u.displayName }), u.email, t('adm.reset_progress'))) act(() => post(`/admin/users/${id}/reset-progress`, { confirmEmail: u.email }), t('adm.progress_reset')); } }, t('adm.reset_progress') + '…')));
  }
  await load();
  return { el: holder, title: t('adm.user'), nav: 'users' };
}
