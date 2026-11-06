/* Sends the e-mails of the site (account confirmation / password recovery) from "Lexio".
   Provider: Resend over HTTPS (works on serverless hosting, no extra package). Configure with environment variables:
     RESEND_API_KEY  the API key of the sending service (never put it in the repository)
     MAIL_FROM       sender address on a verified domain, e.g. no-reply@yourdomain.com  (default: onboarding@resend.dev, test only)
     MAIL_FROM_NAME  sender name shown in the inbox (default: Lexio)
   Without RESEND_API_KEY nothing is sent: the link is written to data/outbox/ and the log, as before. */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  if (!env.RESEND_API_KEY) return null;
  const name = (env.MAIL_FROM_NAME || 'Lexio').replace(/[<>"\r\n]/g, '');
  const from = `${name} <${env.MAIL_FROM || 'onboarding@resend.dev'}>`;
  return async ({ to, subject, text, html }) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error('mail provider answered ' + res.status);
    return true;
  };
}

/* the account-confirmation / password-recovery message in the user's language; `t` is the request translator */
function recoveryMessage({ t, link, brand = 'Lexio' }) {
  const p = { brand, minutes: 60 };
  const subject = t('mail.reset_subject', p), intro = t('mail.reset_intro', p), action = t('mail.reset_action', p), linkLine = t('mail.reset_link', p), ignore = t('mail.reset_ignore', p), foot = t('mail.reset_footer', p);
  const text = `${intro}\n\n${action}: ${link}\n\n${linkLine}\n${link}\n\n${ignore}\n\n${foot}`;
  const html = `<!doctype html><html><body style="margin:0;background:#05061a;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#12143a;border-radius:20px;padding:28px;color:#e8ecff">
<tr><td style="font-size:22px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">${esc(brand)}</td></tr>
<tr><td style="padding-top:18px;font-size:16px;line-height:1.5">${esc(intro)}</td></tr>
<tr><td style="padding:22px 0"><a href="${esc(link)}" style="background:#ff8a6b;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;display:inline-block">${esc(action)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#b4bce6">${esc(linkLine)}<br><span style="word-break:break-all">${esc(link)}</span><br><br>${esc(ignore)}</td></tr>
<tr><td style="padding-top:18px;font-size:12px;color:#8f97c8">${esc(foot)}</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
module.exports = { fromEnv, recoveryMessage, esc };
