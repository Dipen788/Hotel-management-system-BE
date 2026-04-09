/**
 * Email service wrapper. Uses nodemailer's built-in ethereal test account
 * when no SMTP credentials are configured, so the DApp works out-of-the-box
 * for development / grading — messages can be previewed via the URL printed
 * to stdout after each send.
 */
const nodemailer = require("nodemailer");

let cachedTransporter;
let usingEthereal = false;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Ethereal (testing-only SMTP that Nodemailer provides free of charge).
    const testAccount = await nodemailer.createTestAccount();
    usingEthereal = true;
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("[mailer] using Ethereal test account:", testAccount.user);
  }

  return cachedTransporter;
}

/**
 * Send an email. In dev the preview URL is logged so you can visually
 * confirm the payload without setting up real SMTP credentials.
 *
 * @returns {Promise<{messageId: string, previewUrl?: string}>}
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || '"Hotel DApp" <noreply@hotel-dapp.local>',
      to,
      subject,
      html,
      text,
    });

    const result = { messageId: info.messageId };
    if (usingEthereal) {
      result.previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[mailer] preview: ${result.previewUrl}`);
    }
    return result;
  } catch (err) {
    console.warn("[mailer] send failed:", err.message);
    return { error: err.message };
  }
}

// ── Helpers for common templates ──

async function sendBookingConfirmation({ to, guestName, roomName, checkIn, checkOut, totalEth, txHash }) {
  const subject = `Booking confirmed — ${roomName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2>Your booking is confirmed 🎉</h2>
      <p>Hi ${escape(guestName || "guest")},</p>
      <p>Thanks for booking <strong>${escape(roomName)}</strong> through the Hotel DApp.</p>
      <table cellpadding="6" style="border-collapse: collapse; margin: 12px 0;">
        <tr><td><strong>Check-in</strong></td><td>${escape(checkIn)}</td></tr>
        <tr><td><strong>Check-out</strong></td><td>${escape(checkOut)}</td></tr>
        <tr><td><strong>Total paid</strong></td><td>${escape(totalEth)} ETH</td></tr>
        <tr><td><strong>Transaction</strong></td><td><code>${escape(txHash || "—")}</code></td></tr>
      </table>
      <p>We'll email you again closer to your stay. Safe travels!</p>
    </div>`;
  return sendEmail({ to, subject, html });
}

function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = { sendEmail, sendBookingConfirmation };
