import { requireAuth, jsonResponse, unauthorized } from "../../../_utils/auth.js";
import { sendConfirmationEmail, sendConfirmationEmailsBatch } from "../../../_utils/email.js";

const CHUNK_SIZE = 100; // Resend's batch endpoint max per call
const MAX_IDS_PER_REQUEST = 500;

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "অনুরোধের তথ্য সঠিক নয়।" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.map(Number).filter(Number.isInteger))]
    : [];

  if (ids.length === 0) {
    return jsonResponse({ error: "কোনো শিক্ষার্থী নির্বাচন করা হয়নি।" }, { status: 400 });
  }
  if (ids.length > MAX_IDS_PER_REQUEST) {
    return jsonResponse(
      { error: `একবারে সর্বোচ্চ ${MAX_IDS_PER_REQUEST} জন নির্বাচন করা যাবে।` },
      { status: 400 }
    );
  }

  const placeholders = ids.map(() => "?").join(", ");
  const { results: members } = await env.DB.prepare(
    `SELECT id, full_name, email FROM registrations WHERE id IN (${placeholders})`
  )
    .bind(...ids)
    .all();

  if (members.length === 0) {
    return jsonResponse({ error: "নির্বাচিত শিক্ষার্থীদের তথ্য পাওয়া যায়নি।" }, { status: 404 });
  }

  const sent = [];
  const failed = [];
  const skipped = [];
  let rateLimited = false;

  for (let i = 0; i < members.length; i += CHUNK_SIZE) {
    const chunk = members.slice(i, i + CHUNK_SIZE);

    if (rateLimited) {
      chunk.forEach((m) => skipped.push({ id: m.id, email: m.email, reason: "দৈনিক সীমা পূর্ণ হয়েছে" }));
      continue;
    }

    try {
      await sendConfirmationEmailsBatch(
        env,
        chunk.map((m) => ({ to: m.email, fullName: m.full_name }))
      );
      chunk.forEach((m) => sent.push(m.id));
    } catch (err) {
      if (err.status === 429) {
        rateLimited = true;
      }
      for (const m of chunk) {
        if (rateLimited) {
          skipped.push({ id: m.id, email: m.email, reason: "দৈনিক সীমা পূর্ণ হয়েছে" });
          continue;
        }
        try {
          await sendConfirmationEmail(env, { to: m.email, fullName: m.full_name });
          sent.push(m.id);
        } catch (innerErr) {
          if (innerErr.status === 429) {
            rateLimited = true;
            skipped.push({ id: m.id, email: m.email, reason: "দৈনিক সীমা পূর্ণ হয়েছে" });
          } else {
            failed.push({ id: m.id, email: m.email, reason: innerErr.message });
          }
        }
      }
    }
  }

  if (sent.length > 0) {
    const sentPlaceholders = sent.map(() => "?").join(", ");
    try {
      await env.DB.prepare(
        `UPDATE registrations SET confirmation_status = 'confirmed', confirmed_at = datetime('now') WHERE id IN (${sentPlaceholders})`
      )
        .bind(...sent)
        .run();
    } catch {
      return jsonResponse({
        success: true,
        sent: sent.length,
        failed,
        skipped,
        warning: "ই-মেইল পাঠানো হয়েছে, কিন্তু সবার স্ট্যাটাস সংরক্ষণ করা যায়নি। রিফ্রেশ করে দেখুন।",
      });
    }
  }

  return jsonResponse({
    success: true,
    sent: sent.length,
    failed,
    skipped,
  });
}
