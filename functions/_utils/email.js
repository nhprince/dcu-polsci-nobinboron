const DEFAULT_SENDER = "রাষ্ট্রবিজ্ঞান বিভাগ — DCU <nobinboron@stuckstudio.com>";
const SUBJECT = "নবীনবরণ ২০২৫–২৬ নিবন্ধন নিশ্চিতকরণ — রাষ্ট্রবিজ্ঞান বিভাগ";
const LOGO_URL = "https://dcu-polsci-nobinboron.pages.dev/assets/logo.png";

const RESEND_SEND_URL = "https://api.resend.com/emails";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

export function buildEmailText(fullName) {
  return `প্রিয় ${fullName},

ধন্যবাদ!
রাষ্ট্রবিজ্ঞান বিভাগের নবীনবরণ অনুষ্ঠান ২০২৫–২৬-এ আপনার নিবন্ধন সফলভাবে নিশ্চিত করা হয়েছে।

আপনার বিশ্ববিদ্যালয় জীবনের নতুন যাত্রা আনন্দময়, সুন্দর ও সাফল্যমণ্ডিত হোক।

শুভকামনায়,
রাষ্ট্রবিজ্ঞান বিভাগ
ঢাকা সেন্ট্রাল ইউনিভার্সিটি
সরকারি শহীদ সোহরাওয়ার্দী কলেজ ক্যাম্পাস।`;
}

export function buildEmailHtml(fullName) {
  const safeName = escapeHtml(fullName);
  return `<!DOCTYPE html>
<html lang="bn">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:'Hind Siliguri','Noto Sans Bengali',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:500px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde3ef;">
            <tr>
              <td style="background:#162a52;padding:28px 32px;text-align:center;border-bottom:3px solid #c59638;">
                <img src="${LOGO_URL}" width="52" height="52" alt="রাষ্ট্রবিজ্ঞান বিভাগ" style="display:block;margin:0 auto 10px;border:0;" />
                <div style="color:#ffffff;font-weight:700;font-size:17px;">নবীনবরণ ২০২৫–২৬</div>
                <div style="color:#e9d6a6;font-size:13px;margin-top:4px;">রাষ্ট্রবিজ্ঞান বিভাগ · ঢাকা সেন্ট্রাল ইউনিভার্সিটি</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#1b2436;font-size:15px;line-height:1.75;">
                <p style="margin:0 0 16px;">প্রিয় <strong>${safeName}</strong>,</p>
                <p style="margin:0 0 16px;">ধন্যবাদ! রাষ্ট্রবিজ্ঞান বিভাগের নবীনবরণ অনুষ্ঠান ২০২৫–২৬-এ আপনার নিবন্ধন সফলভাবে নিশ্চিত করা হয়েছে।</p>
                <p style="margin:0 0 16px;">আপনার বিশ্ববিদ্যালয় জীবনের নতুন যাত্রা আনন্দময়, সুন্দর ও সাফল্যমণ্ডিত হোক।</p>
                <p style="margin:0;color:#4d5a73;">শুভকামনায়,<br /><strong style="color:#162a52;">রাষ্ট্রবিজ্ঞান বিভাগ</strong><br />ঢাকা সেন্ট্রাল ইউনিভার্সিটি<br />সরকারি শহীদ সোহরাওয়ার্দী কলেজ ক্যাম্পাস।</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function emailPayload(env, to, fullName) {
  return {
    from: env.RESEND_FROM || DEFAULT_SENDER,
    to: [to],
    subject: SUBJECT,
    text: buildEmailText(fullName),
    html: buildEmailHtml(fullName),
  };
}

function ensureConfigured(env) {
  if (!env.RESEND_API_KEY) {
    const err = new Error(
      "ই-মেইল পাঠানোর ব্যবস্থা এখনো কনফিগার করা হয়নি। RESEND_API_KEY সেট করুন।"
    );
    err.code = "NOT_CONFIGURED";
    throw err;
  }
}

function describeResendError(status, data) {
  const message = (data && (data.message || data.name)) || "";
  if (status === 401 || status === 403) return "Resend API key সঠিক নয়। RESEND_API_KEY যাচাই করুন।";
  if (status === 429) return "Resend-এর দৈনিক সীমা পূর্ণ হয়েছে। পরে আবার চেষ্টা করুন।";
  if (status === 400 || status === 422) {
    return message ? `Resend অনুরোধটি গ্রহণ করেনি: ${message}` : "Resend অনুরোধটি গ্রহণ করেনি।";
  }
  return message ? `ই-মেইল পাঠানো যায়নি: ${message}` : "ই-মেইল পাঠানো যায়নি। আবার চেষ্টা করুন।";
}

export async function sendConfirmationEmail(env, { to, fullName }) {
  ensureConfigured(env);

  const res = await fetch(RESEND_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload(env, to, fullName)),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(describeResendError(res.status, data));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function sendConfirmationEmailsBatch(env, recipients) {
  ensureConfigured(env);

  const res = await fetch(RESEND_BATCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recipients.map((r) => emailPayload(env, r.to, r.fullName))),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(describeResendError(res.status, data));
    err.status = res.status;
    throw err;
  }
  return data.data;
}
