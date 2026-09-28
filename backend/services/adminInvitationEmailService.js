const nodemailer = require("nodemailer");

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const createTransporter = () => {
  const port = Number(process.env.ADMIN_INVITE_SMTP_PORT || process.env.SHORT_LEAVE_SMTP_PORT || 25);
  const config = {
    host: process.env.ADMIN_INVITE_SMTP_HOST || process.env.SHORT_LEAVE_SMTP_HOST || "mail.slt.com.lk",
    port,
    secure: port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  const user = process.env.ADMIN_INVITE_EMAIL || process.env.SHORT_LEAVE_EMAIL;
  const password = process.env.ADMIN_INVITE_EMAIL_PASS || process.env.SHORT_LEAVE_EMAIL_PASS;
  if (port !== 25 && user && password) config.auth = { user, pass: password };
  return nodemailer.createTransport(config);
};

const roleLabel = (role) => role === "admin" ? "Administrator" : "Supervisor";

const buildHtml = ({ name, email, role, inviterName, inviterEmail, loginUrl }) => {
  const safeName = escapeHtml(name || "Team member");
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(roleLabel(role));
  const safeInviter = escapeHtml(inviterName || inviterEmail || "TalentHub Administrator");
  const safeLoginUrl = escapeHtml(loginUrl);

  return `<!doctype html>
  <html lang="en"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #dbe4ee">
        <tr><td style="padding:28px 32px;background:linear-gradient(120deg,#000066,#0056a2,#006600);color:#fff">
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.75">SLT-MOBITEL</div>
          <div style="font-size:28px;font-weight:800;margin-top:5px">TalentHub</div>
          <div style="font-size:14px;opacity:.8;margin-top:4px">Administration Portal Invitation</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 14px;font-size:24px">Welcome, ${safeName}</h1>
          <p style="margin:0 0 20px;line-height:1.65;color:#475569">${safeInviter} has invited you to access the TalentHub Administration Portal as a <strong>${safeRole}</strong>.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.8"><strong>Google account:</strong> ${safeEmail}<br><strong>Assigned role:</strong> ${safeRole}</td></tr>
          </table>
          <div style="text-align:center;margin:26px 0"><a href="${safeLoginUrl}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700">Open TalentHub Admin Portal</a></div>
          <p style="margin:0 0 8px;line-height:1.6;color:#475569">Select <strong>Continue with Google</strong> and use the exact account shown above.</p>
          <p style="margin:0;line-height:1.6;color:#64748b;font-size:13px">This email contains no password. If you were not expecting this invitation, contact your TalentHub administrator.</p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center">TalentHub Administration Portal · Secure Google access</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
};

const sendAdminInvitationEmail = async ({ user, inviter }) => {
  const fromEmail = process.env.ADMIN_INVITE_EMAIL || process.env.SHORT_LEAVE_EMAIL;
  if (!fromEmail) throw new Error("Invitation email sender is not configured.");

  const loginUrl = process.env.ADMIN_PORTAL_URL || "http://localhost:3000/admin-login";
  const inviterName = inviter?.name || "";
  const inviterEmail = inviter?.email || "";
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `TalentHub <${fromEmail}>`,
    replyTo: process.env.ADMIN_INVITE_REPLY_TO || fromEmail,
    to: user.email,
    subject: `You are invited to TalentHub as ${roleLabel(user.role)}`,
    text: `${inviterName || inviterEmail || "A TalentHub administrator"} invited you to TalentHub as ${roleLabel(user.role)}. Sign in with Google using ${user.email}: ${loginUrl}`,
    html: buildHtml({
      name: user.name,
      email: user.email,
      role: user.role,
      inviterName,
      inviterEmail,
      loginUrl,
    }),
  });

  return { messageId: info.messageId, accepted: info.accepted || [] };
};

module.exports = { sendAdminInvitationEmail };
