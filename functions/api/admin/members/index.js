import { requireAuth, jsonResponse, unauthorized } from "../../../_utils/auth.js";

const STATUS_FILTERS = new Set(["confirmed", "pending"]);
const ATTEND_FILTERS = new Set(["হ্যাঁ", "না"]);

const SORTABLE_COLUMNS = new Set([
  "created_at",
  "full_name",
  "student_id",
  "session",
  "will_attend",
]);

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim();
  const attend = (url.searchParams.get("attend") || "").trim();
  const talent = (url.searchParams.get("talent") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const sortParam = url.searchParams.get("sort") || "created_at";
  const orderParam = (url.searchParams.get("order") || "desc").toLowerCase();

  const sortCol = SORTABLE_COLUMNS.has(sortParam) ? sortParam : "created_at";
  const order = orderParam === "asc" ? "ASC" : "DESC";

  let query = `
    SELECT id, full_name, father_name, mother_name, student_id, session,
           phone, email, will_attend, has_talent, special_talent, suggestions,
           created_at, confirmation_status, confirmed_at,
           (profile_photo IS NOT NULL) AS has_profile_photo,
           (id_document_photo IS NOT NULL) AS has_id_document_photo
    FROM registrations
    WHERE 1 = 1
  `;
  const params = [];

  if (search) {
    query += ` AND (full_name LIKE ? OR student_id LIKE ? OR email LIKE ? OR phone LIKE ? OR father_name LIKE ? OR special_talent LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  if (ATTEND_FILTERS.has(attend)) {
    query += ` AND will_attend = ?`;
    params.push(attend);
  }

  if (talent === "হ্যাঁ") {
    query += ` AND (has_talent = 'হ্যাঁ' OR (special_talent IS NOT NULL AND TRIM(special_talent) != ''))`;
  }

  if (STATUS_FILTERS.has(status)) {
    query += ` AND confirmation_status = ?`;
    params.push(status);
  }

  query += ` ORDER BY ${sortCol} ${order}`;

  try {
    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse({ members: results });
  } catch (err) {
    return jsonResponse({ error: "নিবন্ধনের তালিকা লোড করা যায়নি।" }, { status: 500 });
  }
}
