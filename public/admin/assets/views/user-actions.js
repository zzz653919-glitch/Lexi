/* Blocking a user and giving tokens: shared by the users list and the user page. */
import { get, post, toast, formDialog, t } from '../common.js';

/* asks for an optional reason, then blocks; returns true when the user was blocked */
export async function blockUser(u) {
  const r = await formDialog({ title: t('adm.block_title') + ' ' + u.displayName, submitLabel: t('adm.block'),
    fields: [{ name: 'reason', label: t('adm.block_reason'), type: 'textarea', rows: 3, maxlength: 200, hint: t('adm.block_text', { name: u.displayName }) }],
    save: async (v) => { await post(`/admin/users/${u.id}/suspend`, { reason: v.reason }); return { ok: true }; } });
  if (r && r.ok) toast(t('adm.blocked'), 'success'); return !!(r && r.ok);
}
export async function unblockUser(u) {
  try { await post(`/admin/users/${u.id}/reactivate`); toast(t('adm.unblocked'), 'success'); return true; } catch (e) { toast(e.message, 'error', 6000); return false; }
}
/* gives LEXIO TOKENS (recorded in the ledger with the administrator's name); returns true when given */
export async function giveTokens(u) {
  const r = await formDialog({ title: t('adm.tokens.give') + ' · ' + u.displayName, submitLabel: t('adm.tokens.give'),
    fields: [{ name: 'amount', label: t('adm.tokens.amount'), type: 'number', min: 1, max: 10000, value: '50', required: true }, { name: 'note', label: t('adm.tokens.note'), maxlength: 100 }],
    save: async (v) => { const n = Number(v.amount); await post(`/admin/avatar/users/${u.id}/grant`, { amount: n, note: v.note }); return { ok: true, n }; } });
  if (r && r.ok) toast(t('adm.tokens.given', { n: r.n, name: u.displayName }), 'success'); return !!(r && r.ok);
}
export const walletOf = (id) => get('/admin/avatar/users/' + id);
