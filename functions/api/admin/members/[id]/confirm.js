import { requireAuth, jsonResponse, unauthorized } from "../../../../_utils/auth.js";
import { sendConfirmationEmail } from "../../../../_utils/email.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "সঠিক আইডি নয়।" }, { status: 400 });

  const member = await env.DB.prepare(`SELECT id, full_name, email FROM registrations WHERE id = ?`)
    .bind(id)
    .first();
  if (!member) return jsonResponse({ error: "শিক্ষার্থীর তথ্য পাওয়া যায়নি।" }, { status: 404 });

  try {
    await sendConfirmationEmail(env, { to: member.email, fullName: member.full_name });
  } catch (err) {
    return jsonResponse({ error: err.message }, { status: err.status === 429 ? 429 : 502 });
  }

  try {
    await env.DB.prepare(
      `UPDATE registrations SET confirmation_status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`
    )
      .bind(id)
      .run();
  } catch {
    return jsonResponse({
      success: true,
      warning: "ই-মেইল পাঠানো হয়েছে, কিন্তু স্ট্যাটাস হালনাগাদ করা যায়নি। পৃষ্ঠাটি রিফ্রেশ করে দেখুন।",
    });
  }

  return jsonResponse({ success: true, message: `${member.email} ঠিকানায় নিশ্চিতকরণ ই-মেইল পাঠানো হয়েছে।` });
}
