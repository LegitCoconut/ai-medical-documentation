import nodemailer from 'nodemailer'
import { createHmac } from 'crypto'

/**
 * Email / SMTP utility
 *
 * Required env vars:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=youraddress@gmail.com
 *   SMTP_PASS=your-app-password
 *   SMTP_FROM="PHC Clinic <noreply@yourclinic.com>"
 *   APP_URL=https://your-clinic.example.com    (public-facing base URL, no trailing slash)
 *   APPOINTMENT_LINK_SECRET=some-random-secret  (for signing token links)
 */

function getTransport() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export function emailEnabled(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

// ─── Signed token link ────────────────────────────────────────────────────────

const LINK_ALGO = 'sha256'

/**
 * Build a signed URL: /token/signed?mrn=P-0001&visitId=...&sig=<hmac>
 * The sig covers the mrn + visitId so the URL cannot be guessed or tampered with.
 */
export function buildSignedTokenUrl(mrn: string, visitId: string): string {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const secret = process.env.APPOINTMENT_LINK_SECRET || 'change-me-in-env'
  const payload = `${mrn}:${visitId}`
  const sig = createHmac(LINK_ALGO, secret).update(payload).digest('hex')
  const params = new URLSearchParams({ mrn, visitId, sig })
  return `${base}/token/signed?${params.toString()}`
}

/**
 * Verify a signed token URL.
 * Returns { mrn, visitId } if valid, null if tampered/missing.
 */
export function verifySignedTokenUrl(
  mrn: string,
  visitId: string,
  sig: string
): { mrn: string; visitId: string } | null {
  const secret = process.env.APPOINTMENT_LINK_SECRET || 'change-me-in-env'
  const payload = `${mrn}:${visitId}`
  const expected = createHmac(LINK_ALGO, secret).update(payload).digest('hex')
  if (expected !== sig) return null
  return { mrn, visitId }
}

// ─── Email templates ──────────────────────────────────────────────────────────

export type AppointmentEmailPayload = {
  to: string                // patient email
  patientName: string
  mrn: string
  visitId: string
  tokenNumber: number
  doctorName: string
  doctorDepartment?: string
  reason: string
  appointmentTime: string   // ISO string
}

function buildEmailHtml(payload: AppointmentEmailPayload, signedUrl: string): string {
  const time = new Date(payload.appointmentTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Appointment — Token #${payload.tokenNumber}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #0f172a; padding: 32px 36px; text-align: center; }
    .header h1 { color: #f8fafc; font-size: 20px; margin: 0 0 4px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: #94a3b8; font-size: 13px; margin: 0; }
    .token-badge { background: #1e293b; border: 2px solid #334155; margin: 0 36px; border-radius: 8px; padding: 20px; text-align: center; margin-top: 28px; }
    .token-badge .label { color: #64748b; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    .token-badge .number { color: #f8fafc; font-size: 52px; font-weight: 800; font-family: monospace; line-height: 1; margin: 4px 0; }
    .token-badge .mrn { color: #64748b; font-size: 13px; font-family: monospace; }
    .body { padding: 28px 36px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-value { color: #0f172a; font-weight: 600; text-align: right; max-width: 55%; }
    .cta { margin: 24px 36px 32px; text-align: center; }
    .cta a { display: inline-block; background: #0f172a; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.01em; }
    .footer { background: #f8fafc; padding: 16px 36px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏥 Your Appointment is Confirmed</h1>
      <p>Please keep this email for your visit</p>
    </div>

    <div class="token-badge">
      <div class="label">Your Token Number</div>
      <div class="number">#${payload.tokenNumber}</div>
      <div class="mrn">${payload.mrn}</div>
    </div>

    <div class="body">
      <div class="detail-row">
        <span class="detail-label">Patient Name</span>
        <span class="detail-value">${payload.patientName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reason</span>
        <span class="detail-value">${payload.reason}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Doctor</span>
        <span class="detail-value">Dr. ${payload.doctorName}${payload.doctorDepartment ? `<br/><small style="font-weight:400;color:#64748b">${payload.doctorDepartment}</small>` : ''}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Appointment Time</span>
        <span class="detail-value">${time}</span>
      </div>
    </div>

    <div class="cta">
      <a href="${signedUrl}">Check My Queue Status →</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:12px">
        Live updates on your position in the queue
      </p>
    </div>

    <div class="footer">
      <p>This is an automated message from the clinic management system.<br/>Please arrive 10 minutes before your appointment time.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

function buildEmailText(payload: AppointmentEmailPayload, signedUrl: string): string {
  const time = new Date(payload.appointmentTime).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
  return [
    `Your Appointment is Confirmed`,
    ``,
    `Token Number: #${payload.tokenNumber}`,
    `MRN: ${payload.mrn}`,
    `Patient: ${payload.patientName}`,
    `Reason: ${payload.reason}`,
    `Doctor: Dr. ${payload.doctorName}${payload.doctorDepartment ? ` (${payload.doctorDepartment})` : ''}`,
    `Time: ${time}`,
    ``,
    `Track your queue position: ${signedUrl}`,
    ``,
    `Please arrive 10 minutes before your appointment time.`,
  ].join('\n')
}

// ─── Send appointment email ───────────────────────────────────────────────────

export async function sendAppointmentEmail(payload: AppointmentEmailPayload): Promise<{ sent: boolean; error?: string }> {
  if (!emailEnabled()) return { sent: false, error: 'SMTP not configured' }

  const transport = getTransport()
  if (!transport) return { sent: false, error: 'Failed to create transport' }

  const signedUrl = buildSignedTokenUrl(payload.mrn, payload.visitId)
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@clinic.local'

  try {
    await transport.sendMail({
      from,
      to: payload.to,
      subject: `Your Appointment — Token #${payload.tokenNumber} | ${new Date(payload.appointmentTime).toLocaleDateString('en-GB')}`,
      text: buildEmailText(payload, signedUrl),
      html: buildEmailHtml(payload, signedUrl),
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('email: send failed', message)
    return { sent: false, error: message }
  }
}
