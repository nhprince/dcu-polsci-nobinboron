import { requireAuth, jsonResponse, unauthorized } from "../../_utils/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  try {
    const [{ total }] = (
      await env.DB.prepare(`SELECT COUNT(*) AS total FROM registrations`).all()
    ).results;

    const [{ recent }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS recent FROM registrations WHERE created_at >= datetime('now', '-7 days')`
      ).all()
    ).results;

    const [{ attending }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS attending FROM registrations WHERE will_attend = 'হ্যাঁ'`
      ).all()
    ).results;

    const [{ not_attending }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS not_attending FROM registrations WHERE will_attend = 'না'`
      ).all()
    ).results;

    const [{ talents }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS talents FROM registrations WHERE has_talent = 'হ্যাঁ' OR (special_talent IS NOT NULL AND TRIM(special_talent) != '')`
      ).all()
    ).results;

    const [{ confirmed }] = (
      await env.DB.prepare(
        `SELECT COUNT(*) AS confirmed FROM registrations WHERE confirmation_status = 'confirmed'`
      ).all()
    ).results;

    const { results: bySession } = await env.DB.prepare(
      `SELECT session, COUNT(*) AS count FROM registrations GROUP BY session ORDER BY session DESC`
    ).all();

    return jsonResponse({
      total,
      recent,
      attending,
      not_attending,
      talents,
      confirmed,
      pending: total - confirmed,
      sessions: bySession,
    });
  } catch (err) {
    return jsonResponse({ error: "পরিসংখ্যান লোড করা যায়নি।" }, { status: 500 });
  }
}
