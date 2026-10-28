import { h, icon, get, post, table, tag, crumbs, toast, confirmDialog, typedConfirm, when, session } from '../common.js';
import { barChart } from './charts.js';

export default async function user({ params }) {
  const id = Number(params.id);
  const holder = h('div', {});
  async function load() { draw(await get('/admin/users/' + id)); }
  function draw(d) {
    const u = d.user, me = session.user.id === u.id;
    const act = async (fn, msg) => { try { await fn(); toast(msg, 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); } };
    const roleSel = h('select', { class: 'input', 'aria-label': 'Role', disabled: me, style: { width: 'auto' } }, ['learner', 'editor', 'admin'].map((r) => h('option', { value: r, selected: r === u.role }, r)));
    const week = d.week.map((x) => ({ date: x.date, value: x.xp }));
    holder.replaceChildren(
      crumbs({ href: '/admin/users', label: 'Users' }, { label: u.displayName }),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, u.displayName), h('div', { class: 'row' }, tag(u.status), h('span', { class: 'badge' }, u.role), h('span', { class: 'muted small' }, u.email))),
        h('div', { class: 'row' }, u.status === 'active' ? h('button', { class: 'btn danger small', disabled: me, onclick: async () => { if (await confirmDialog('Suspend account?', `${u.displayName} will be signed out and cannot sign in until reactivated.`, 'Suspend', true)) act(() => post(`/admin/users/${id}/suspend`), 'Account suspended'); } }, 'Suspend') : h('button', { class: 'btn small', onclick: () => act(() => post(`/admin/users/${id}/reactivate`), 'Account reactivated') }, 'Reactivate'))),
      h('div', { class: 'stat-grid' }, [['XP', u.xpTotal], ['Day streak', d.streak.current], ['Longest streak', d.streak.longest], ['Lessons completed', d.lessonsCompleted], ['Answers', d.attempts], ['Accuracy', d.accuracy == null ? '—' : d.accuracy + '%'], ['Words in review', d.reviewWords]].map(([l, n]) => h('div', { class: 'stat-card' }, h('b', {}, String(n)), h('span', {}, l)))),
      h('div', { class: 'grid two' },
        h('section', { class: 'card' }, h('h2', {}, 'Profile'), h('dl', { class: 'kv' }, h('dt', {}, 'Joined'), h('dd', {}, when(u.createdAt)), h('dt', {}, 'Last active'), h('dd', {}, when(u.lastActiveAt)), h('dt', {}, 'Time zone'), h('dd', {}, u.timezone), h('dt', {}, 'Hearts'), h('dd', {}, d.hearts.enabled ? `${d.hearts.hearts} / ${d.hearts.max}` : 'off'), h('dt', {}, 'Today'), h('dd', {}, `${d.today.xp} / ${d.today.goal} XP`), h('dt', {}, 'Achievements'), h('dd', {}, d.achievements.join(', ') || 'None yet'))),
        h('section', { class: 'card' }, h('h2', {}, 'XP — last 7 days'), barChart(week, { label: 'XP per day' }))),
      h('section', { class: 'card' }, h('h2', {}, 'Role'), h('p', { class: 'muted small' }, me ? 'You cannot change your own role.' : 'Only administrators can change roles. The last administrator cannot be demoted.'),
        h('div', { class: 'row' }, roleSel, h('button', { class: 'btn small', disabled: me, onclick: () => act(() => post(`/admin/users/${id}/role`, { role: roleSel.value }), 'Role updated') }, 'Change role'))),
      h('section', { class: 'card' }, h('h2', {}, 'Recent activity'), table([{ label: 'Started', render: (a) => when(a.started_at) }, { label: 'What', render: (a) => a.lesson || (a.kind === 'mistakes' ? 'Mistakes review' : 'Lesson') }, { label: 'Result', render: (a) => `${a.correct} right, ${a.incorrect} wrong` }, { label: 'Status', render: (a) => a.status }], d.recent, { empty: 'No activity yet.' })),
      h('section', { class: 'card' }, h('h2', {}, 'Danger zone'), h('p', { class: 'muted' }, 'Resetting progress deletes this learner’s XP, streak, lesson progress, achievements and review schedule. The account itself stays.'),
        h('button', { class: 'btn danger small', onclick: async () => { if (await typedConfirm('Reset progress', `This permanently deletes all learning progress of ${u.displayName}.`, u.email, 'Reset progress')) act(() => post(`/admin/users/${id}/reset-progress`, { confirmEmail: u.email }), 'Progress reset'); } }, 'Reset progress…')));
  }
  await load();
  return { el: holder, title: 'User', nav: 'users' };
}
