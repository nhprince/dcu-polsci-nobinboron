import { requireAuth, jsonResponse, unauthorized } from "../../../_utils/auth.js";

const MAX_IMAGE_BASE64_LENGTH = 1_500_000; // ~1.1MB decoded
const IMAGE_FIELDS = new Set(["profile_photo", "id_document_photo"]);

const EDITABLE_FIELDS = [
  "full_name",
  "father_name",
  "mother_name",
  "student_id",
  "session",
  "phone",
  "email",
  "present_address",
  "permanent_address",
  "will_attend",
  "has_talent",
  "special_talent",
  "suggestions",
  "profile_photo",
  "id_document_photo",
];

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "সঠিক আইডি নয়।" }, { status: 400 });

  const member = await env.DB.prepare(`SELECT * FROM registrations WHERE id = ?`).bind(id).first();
  if (!member) return jsonResponse({ error: "তথ্য খুঁজে পাওয়া যায়নি।" }, { status: 404 });

  return jsonResponse({ member });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "সঠিক আইডি নয়।" }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "অনুরোধের তথ্য সঠিক নয়।" }, { status: 400 });
  }

  for (const field of IMAGE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field]) {
      if (String(body[field]).length > MAX_IMAGE_BASE64_LENGTH) {
        return jsonResponse({ error: "ছবিটি অনেক বড়। অনুগ্রহ করে ছোট ছবি ব্যবহার করুন।" }, { status: 400 });
      }
    }
  }

  const setClauses = [];
  const values = [];

  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      setClauses.push(`${field} = ?`);
      values.push(body[field] === "" ? null : body[field]);
    }
  }

  if (setClauses.length === 0) {
    return jsonResponse({ error: "হালনাগাদ করার মতো কোনো তথ্য নেই।" }, { status: 400 });
  }

  values.push(id);

  try {
    await env.DB.prepare(`UPDATE registrations SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "তথ্য হালনাগাদ করা যায়নি।" }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "সঠিক আইডি নয়।" }, { status: 400 });

  try {
    await env.DB.prepare(`DELETE FROM registrations WHERE id = ?`).bind(id).run();
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "তথ্য মুছে ফেলা যায়নি।" }, { status: 500 });
  }
}
