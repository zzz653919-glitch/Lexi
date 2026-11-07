/* LEXIO TOKENS: a ledger (token_transactions) and a balance (token_wallets) that always agree. Tokens are earned by learning or spent in the shop;
   they are separate from XP and are never sold. Every change is one row with a `ref`: the same ref can never be paid twice. */
const { now, int } = require('./util');

function make(db) {
  const ensureWallet = (userId) => db.run('INSERT OR IGNORE INTO token_wallets (user_id, updated_at) VALUES (?, ?)', userId, now());

  async function wallet(userId) {
    await ensureWallet(userId);
    const w = await db.get('SELECT balance, earned_total, spent_total FROM token_wallets WHERE user_id = ?', userId);
    return { balance: w.balance, earned: w.earned_total, spent: w.spent_total };
  }
  /* pays a reward once: { paid: false } when this ref was paid before or the amount is zero */
  async function earn(userId, { ref, amount, reason, meta = {}, kind = 'earn' }) {
    amount = int(amount, 0);
    if (!(amount > 0) || !ref) return { paid: false, balance: (await wallet(userId)).balance };
    return db.tx(async () => {
      await ensureWallet(userId);
      if (await db.get('SELECT 1 x FROM token_transactions WHERE user_id = ? AND ref = ?', userId, ref)) return { paid: false, balance: (await wallet(userId)).balance };
      const w = await db.get('SELECT balance FROM token_wallets WHERE user_id = ?', userId), after = w.balance + amount;
      await db.run('INSERT INTO token_transactions (user_id, amount, kind, reason, ref, balance_after, meta, created_at) VALUES (?,?,?,?,?,?,?,?)', userId, amount, kind, reason, ref, after, JSON.stringify(meta), now());
      await db.run('UPDATE token_wallets SET balance = ?, earned_total = earned_total + ?, updated_at = ? WHERE user_id = ?', after, amount, now(), userId);
      return { paid: true, amount, balance: after };
    });
  }
  /* takes tokens for a purchase; the balance can never go below zero. Returns false when there is not enough. */
  async function spend(userId, { ref, amount, reason = 'purchase', meta = {} }) {
    amount = int(amount, 0);
    if (!(amount >= 0) || !ref) return { ok: false, error: 'invalid' };
    return db.tx(async () => {
      await ensureWallet(userId);
      if (await db.get('SELECT 1 x FROM token_transactions WHERE user_id = ? AND ref = ?', userId, ref)) return { ok: false, error: 'duplicate' };
      const r = await db.run('UPDATE token_wallets SET balance = balance - ?, spent_total = spent_total + ?, updated_at = ? WHERE user_id = ? AND balance >= ?', amount, amount, now(), userId, amount);
      if (!r.changes) return { ok: false, error: 'insufficient' };
      const w = await db.get('SELECT balance FROM token_wallets WHERE user_id = ?', userId);
      await db.run('INSERT INTO token_transactions (user_id, amount, kind, reason, ref, balance_after, meta, seen, created_at) VALUES (?,?,?,?,?,?,?,1,?)', userId, -amount, 'spend', reason, ref, w.balance, JSON.stringify(meta), now());
      return { ok: true, balance: w.balance };
    });
  }
  /* rewards whose animation has not been shown yet */
  async function unseen(userId) {
    return (await db.all("SELECT id, amount, reason, created_at FROM token_transactions WHERE user_id = ? AND seen = 0 AND amount > 0 ORDER BY id LIMIT 20", userId));
  }
  const markSeen = (userId) => db.run('UPDATE token_transactions SET seen = 1 WHERE user_id = ? AND seen = 0', userId);
  async function history(userId, limit = 30, before = 0) {
    return (await db.all(`SELECT id, amount, kind, reason, ref, balance_after, meta, created_at FROM token_transactions WHERE user_id = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`, ...(before ? [userId, before, limit] : [userId, limit])))
      .map((r) => ({ ...r, meta: JSON.parse(r.meta || '{}') }));
  }
  return { wallet, earn, spend, unseen, markSeen, history };
}
module.exports = { make };
