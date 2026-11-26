import { requireAuth, jsonResponse, unauthorized } from "../../../../_utils/auth.js";

const ALLOWED_FIELDS = new Set(["profile_photo", "id_document_photo"]);

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  const id = Number(params.id);
  if (!Number.isInteger(id)) return jsonResponse({ error: "সঠিক আইডি নয়।" }, { status: 400 });

  const url = new URL(request.url);
  const field = url.searchParams.get("field");
  if (!ALLOWED_FIELDS.has(field)) {
    return jsonResponse({ error: "অবৈধ ফিল্ড।" }, { status: 400 });
  }

  const row = await env.DB.prepare(`SELECT ${field} AS photo FROM registrations WHERE id = ?`)
    .bind(id)
    .first();

  if (!row || !row.photo) {
    return jsonResponse({ error: "ছবি পাওয়া যায়নি।" }, { status: 404 });
  }

  const match = /^data:([^;]+);base64,(.*)$/s.exec(row.photo);
  if (!match) {
    return jsonResponse({ error: "ছবির ফরম্যাট পড়া যাচ্ছে না।" }, { status: 500 });
  }

  const [, mimeType, base64Data] = match;

  let bytes;
  try {
    const binary = atob(base64Data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return jsonResponse({ error: "ছবি ডিকোড করা যায়নি।" }, { status: 500 });
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="student-${id}-${field}.jpg"`,
    },
  });
}
