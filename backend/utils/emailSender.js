const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config(); // Load environment variables from .env

// Create a transporter using Gmail's SMTP server
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Gmail address
    pass: process.env.GMAIL_PASS, // Gmail password or app password
  },
});

/**
 * Function to send an email (returns a Promise)
 * Supports:
 *   sendEmail(to, subject, text, html)
 *   sendEmail(to, subject, htmlOrText)
 *   sendEmail({ to, subject, text, html })
 */
const sendEmail = async (toOrOptions, subject, textOrHtml, maybeHtml) => {
  let to = toOrOptions;
  let subj = subject;
  let text = typeof textOrHtml === "string" ? textOrHtml : "";
  let html = maybeHtml;
  let cc = undefined;

  if (typeof toOrOptions === "object" && toOrOptions !== null) {
    to = toOrOptions.to;
    cc = toOrOptions.cc;
    subj = toOrOptions.subject;
    text = toOrOptions.text || "";
    html = toOrOptions.html || "";
  } else if (!maybeHtml && typeof textOrHtml === "string" && textOrHtml.trim().startsWith("<")) {
    html = textOrHtml;
  }

  const mailOptions = {
    from: `"TalentHub SLT" <${process.env.GMAIL_USER}>`,
    to,
    ...(cc && { cc }),
    subject: subj,
    ...(text && { text }),
    ...(html && { html }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailSender] Email successfully sent to ${to}: ${info.response || info.messageId}`);
    return { success: true, info };
  } catch (error) {
    console.error(`[EmailSender] Error sending email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send approval email to a university supervisor
 */
const sendUniversityApprovalEmail = async ({ to, supervisorName, universityName }) => {
  const subject = `🎉 University Access Approved - TalentHub Portal (${universityName})`;
  const portalUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${portalUrl}/university-login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #000066 0%, #006600 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
        .content { padding: 32px 28px; line-height: 1.6; }
        .badge { display: inline-block; padding: 6px 14px; background: #ecfdf5; color: #059669; border-radius: 999px; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 16px; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-value { color: #0f172a; font-weight: 700; }
        .btn-container { text-align: center; margin: 30px 0 10px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #00b4eb, #0056a2); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(0,180,235,0.35); }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TalentHub University Portal</h1>
          <p>SLT Mobitel Internship Management Platform</p>
        </div>
        <div class="content">
          <span class="badge">✓ Access Approved</span>
          <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Welcome, ${supervisorName}!</h2>
          <p>Your registration request to access the TalentHub University Supervision Portal on behalf of <strong>${universityName}</strong> has been officially approved by the TalentHub administration.</p>
          
          <div class="info-box">
            <table width="100%" cellpadding="4" cellspacing="0">
              <tr>
                <td class="info-label">University / Institute:</td>
                <td class="info-value" align="right">${universityName}</td>
              </tr>
              <tr>
                <td class="info-label">Authorized Supervisor:</td>
                <td class="info-value" align="right">${supervisorName}</td>
              </tr>
              <tr>
                <td class="info-label">Registered Email:</td>
                <td class="info-value" align="right">${to}</td>
              </tr>
              <tr>
                <td class="info-label">Approval Status:</td>
                <td class="info-value" align="right" style="color: #059669;">Active / Approved</td>
              </tr>
            </table>
          </div>

          <p>With this access, you can now:</p>
          <ul>
            <li>Monitor daily logbook records & task progress of your university students</li>
            <li>Track live and historical attendance metrics</li>
            <li>Inspect quality scores, working rates, and enrolled projects</li>
            <li>Provide direct guidance comments and feedback to your students</li>
          </ul>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Sign In to University Portal</a>
          </div>

          <p style="font-size: 13px; color: #64748b; text-align: center; margin-top: 20px;">
            Sign in using your Google account: <strong>${to}</strong>
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} SLT Mobitel TalentHub. All rights reserved.<br/>
          This is an automated notification. Please do not reply directly to this email.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, text: `Hello ${supervisorName}, your University access for ${universityName} has been approved. You can sign in at ${loginUrl}` });
};

/**
 * Send rejection email with reason to a university supervisor
 */
const sendUniversityRejectionEmail = async ({ to, supervisorName, universityName, rejectionReason }) => {
  const subject = `Update Regarding Your University Access Request - TalentHub (${universityName})`;
  const portalUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginUrl = `${portalUrl}/university-login`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #000066 0%, #330000 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
        .content { padding: 32px 28px; line-height: 1.6; }
        .badge { display: inline-block; padding: 6px 14px; background: #fef2f2; color: #dc2626; border-radius: 999px; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-bottom: 16px; }
        .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 20px 0; color: #991b1b; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
        .info-label { color: #64748b; font-weight: 500; font-size: 14px; }
        .info-value { color: #0f172a; font-weight: 700; font-size: 14px; }
        .btn-container { text-align: center; margin: 24px 0 10px; }
        .btn { display: inline-block; background: #475569; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TalentHub University Portal</h1>
          <p>SLT Mobitel Internship Management Platform</p>
        </div>
        <div class="content">
          <span class="badge">Request Status: Not Approved</span>
          <h2 style="margin-top: 0; font-size: 20px; color: #0f172a;">Hello, ${supervisorName}</h2>
          <p>Thank you for your interest in the TalentHub University Portal. After reviewing your registration request for <strong>${universityName}</strong>, the administration was unable to approve the request at this time.</p>
          
          <div class="reason-box">
            <strong>Reason for Rejection:</strong>
            <p style="margin: 6px 0 0; font-size: 14px;">${rejectionReason || "Verification could not be completed with the provided institutional details."}</p>
          </div>

          <div class="info-box">
            <table width="100%" cellpadding="4" cellspacing="0">
              <tr>
                <td class="info-label">University / Institute:</td>
                <td class="info-value" align="right">${universityName}</td>
              </tr>
              <tr>
                <td class="info-label">Applicant:</td>
                <td class="info-value" align="right">${supervisorName}</td>
              </tr>
              <tr>
                <td class="info-label">Email:</td>
                <td class="info-value" align="right">${to}</td>
              </tr>
            </table>
          </div>

          <p>If you believe this was in error or you wish to submit updated official credentials, you may re-apply through the portal or contact the TalentHub administrative team.</p>

          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Visit University Portal</a>
          </div>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} SLT Mobitel TalentHub. All rights reserved.<br/>
          This is an automated notification.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject, html, text: `Hello ${supervisorName}, your University access request for ${universityName} was not approved. Reason: ${rejectionReason}` });
};

/**
 * Send security alert when location attendance policy is disabled
 */
const sendSecurityAlertEmail = async ({ adminName, adminEmail }) => {
  const subject = `⚠️ SECURITY ALERT: Attendance Location Policy Disabled`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, sans-serif; background-color: #fef2f2; padding: 20px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #fecaca; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: #ef4444; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 20px;">System Security Alert</h2>
        </div>
        <div style="padding: 24px; line-height: 1.6;">
          <h3 style="margin-top: 0; color: #991b1b;">Location Geofencing Disabled</h3>
          <p>Please be advised that the strict <strong>Location Geofencing Security</strong> for the Face Attendance system has been manually disabled.</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Action Performed By:</strong> ${adminName} (${adminEmail})</p>
            <p style="margin: 0;"><strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}</p>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">If this action was not authorized, please log into the Admin Portal immediately to re-enable location tracking.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ 
    to: ["mgiri@slt.com.lk"], 
    cc: ["send2liyanapathirana@gmail.com"], 
    subject, 
    html, 
    text: `Warning: Location security was disabled by ${adminName} (${adminEmail}).` 
  });
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendUniversityApprovalEmail = sendUniversityApprovalEmail;
module.exports.sendUniversityRejectionEmail = sendUniversityRejectionEmail;
module.exports.sendSecurityAlertEmail = sendSecurityAlertEmail;
