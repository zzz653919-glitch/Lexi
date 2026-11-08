import { h, get, post, table, tag, crumbs, toast, confirmDialog, typedConfirm, formDialog, when, session, t, fmt } from '../common.js';
import { blockUser, unblockUser, giveTokens, walletOf } from './user-actions.js';
import { barChart } from './charts.js';

export default async function user({ params }) {
  const id = Number(params.id);
  const holder = h('div', {});
  async function load() { wal = await walletOf(id).catch(() => null); draw(await get('/admin/users/' + id)); }
  let wal = null;
  const blockBtn = (u, me) => (u.status === 'active'
    ? h('button', { class: 'btn danger small', id: 'user-block', disabled: me, onclick: async () => { if (await blockUser(u)) load(); } }, t('adm.block'))
    : h('button', { class: 'btn small', id: 'user-unblock', onclick: async () => { if (await unblockUser(u)) load(); } }, t('adm.unblock')));
  const tokensCard = (u) => h('section', { class: 'card', id: 'user-tokens' }, h('h2', {}, t('adm.tokens.title')),
    wal ? h('p', {}, h('b', { id: 'user-token-balance', style: { fontSize: '1.4rem' } }, fmt.number(wal.wallet.balance)), ' ', h('span', { class: 'muted small' }, t('adm.tokens.summary', { earned: fmt.number(wal.wallet.earned), spent: fmt.number(wal.wallet.spent) }))) : null,
    h('div', { class: 'row' }, h('button', { class: 'btn small', id: 'user-give-tokens', onclick: async () => { if (await giveTokens(u)) load(); } }, t('adm.tokens.give'))),
    wal && wal.transactions.length ? h('div', {}, h('h3', {}, t('adm.tokens.recent')), table([{ label: t('adm.col.started'), render: (x) => when(x.created_at) }, { label: t('adm.tokens.col.what'), render: (x) => x.reason + (x.kind === 'grant' ? ' · ' + t('adm.avatar.grant') : '') }, { label: t('adm.tokens.col.amount'), render: (x) => (x.amount > 0 ? '+' : '') + x.amount }, { label: t('adm.tokens.col.balance'), render: (x) => x.balance_after }], wal.transactions, { empty: t('adm.tokens.none') })) : h('p', { class: 'muted small' }, t('adm.tokens.none')));
  function draw(d) {
    const u = d.user, me = session.user.id === u.id;
    const act = async (fn, msg) => { try { await fn(); toast(msg, 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); } };
    const roleSel = h('select', { class: 'input', 'aria-label': t('adm.col.role'), disabled: me, style: { width: 'auto' } }, ['learner', 'editor', 'admin'].map((r) => h('option', { value: r, selected: r === u.role }, t('adm.role.' + r))));
    const week = d.week.map((x) => ({ date: x.date, value: x.xp }));
    holder.replaceChildren(
      crumbs({ href: '/admin/users', label: t('adm.nav.users') }, { label: u.displayName }),
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, u.displayName), h('div', { class: 'row' }, tag(u.status), h('span', { class: 'badge' }, t('adm.role.' + u.role)), h('span', { class: 'muted small' }, u.email))),
        h('div', { class: 'row' }, blockBtn(u, me, true))),
      u.status !== 'active' ? h('div', { class: 'card', id: 'user-blocked-note', style: { borderLeft: '6px solid #d6336c' } }, h('b', {}, t('adm.status.suspended')), h('p', { class: 'muted' }, u.blockedReason ? t('adm.blocked_reason_line', { reason: u.blockedReason }) : t('adm.blocked_no_reason')), u.blockedAt ? h('small', { class: 'muted' }, when(u.blockedAt)) : null) : null,
      tokensCard(u),
      h('div', { class: 'stat-grid' }, [['XP', u.xpTotal], [t('stats.streak'), d.streak.current], [t('adm.longest_streak'), d.streak.longest], [t('adm.stat.completed_lessons'), d.lessonsCompleted], [t('adm.answers'), d.attempts], [t('adm.stat.accuracy'), d.accuracy == null ? '—' : d.accuracy + '%'], [t('adm.words_in_review'), d.reviewWords]].map(([l, v]) => h('div', { class: 'stat-card' }, h('b', {}, typeof v === 'number' ? fmt.number(v) : String(v)), h('span', {}, l)))),
      h('div', { class: 'grid two' },
        h('section', { class: 'card' }, h('h2', {}, t('profile.settings')), h('dl', { class: 'kv' }, h('dt', {}, t('adm.col.joined')), h('dd', {}, when(u.createdAt)), h('dt', {}, t('adm.col.last_active')), h('dd', {}, when(u.lastActiveAt)), h('dt', {}, t('profile.timezone')), h('dd', {}, u.timezone), h('dt', {}, t('stats.hearts')), h('dd', {}, d.hearts.enabled ? `${d.hearts.hearts} / ${d.hearts.max}` : t('adm.off')), h('dt', {}, t('adm.today')), h('dd', {}, `${d.today.xp} / ${d.today.goal} XP`), h('dt', {}, t('nav.achievements')), h('dd', {}, d.achievements.map((c) => t('ach.' + c + '.title')).join(', ') || t('adm.none_yet')))),
        h('section', { class: 'card' }, h('h2', {}, t('adm.xp_week')), barChart(week, { label: t('adm.xp_per_day') }))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.col.role')), h('p', { class: 'muted small' }, me ? t('err.cannot_change_own_role') : t('adm.role_help')),
        h('div', { class: 'row' }, roleSel, h('button', { class: 'btn small', disabled: me, onclick: () => act(() => post(`/admin/users/${id}/role`, { role: roleSel.value }), t('adm.role_updated')) }, t('adm.change_role')))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.exam_results')), table([{ label: t('adm.col.started'), render: (x) => when(x.at) }, { label: t('adm.col.what'), render: (x) => x.title }, { label: t('adm.col.score'), render: (x) => x.score + '%' + (x.band ? ` · ${t('exam.band_estimate', { band: x.band })}` : '') }, { label: t('adm.col.status'), render: (x) => (x.kind === 'practice_test' ? '—' : x.passed ? t('adm.exam_passed') : t('adm.exam_failed')) }], d.exams || [], { empty: t('adm.exam_none') })),
      h('section', { class: 'card' }, h('h2', {}, t('adm.recent')), table([{ label: t('adm.col.started'), render: (a) => when(a.started_at) }, { label: t('adm.col.what'), render: (a) => a.lesson || (a.kind === 'mistakes' ? t('lesson.mistakes_reviewed') : t('adm.lesson')) }, { label: t('adm.col.result'), render: (a) => t('adm.result', { right: a.correct, wrong: a.incorrect }) }, { label: t('adm.col.status'), render: (a) => tag(a.status) }], d.recent, { empty: t('adm.no_activity_yet') })),
      h('section', { class: 'card' }, h('h2', {}, t('adm.danger_zone')), h('p', { class: 'muted' }, t('adm.reset_help')),
        h('button', { class: 'btn danger small', onclick: async () => { if (await typedConfirm(t('adm.reset_progress'), t('adm.reset_text', { name: u.displayName }), u.email, t('adm.reset_progress'))) act(() => post(`/admin/users/${id}/reset-progress`, { confirmEmail: u.email }), t('adm.progress_reset')); } }, t('adm.reset_progress') + '…')));
  }
  await load();
  return { el: holder, title: t('adm.user'), nav: 'users' };
}
