import { jsonResponse } from "../_utils/auth.js";

const REQUIRED_FIELDS = [
  "full_name",
  "father_name",
  "mother_name",
  "phone",
  "email",
  "present_address",
  "permanent_address",
  "session",
  "student_id",
  "will_attend",
];

// Rough cap so a single row can't balloon D1 storage. Images are compressed
// client-side before upload, so legitimate submissions stay well under this.
const MAX_IMAGE_BASE64_LENGTH = 1_500_000; // ~1.1MB decoded

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "অনুরোধের তথ্য সঠিক নয়।" }, { status: 400 });
  }

  // Honeypot: a hidden field real users never fill in. If it's populated,
  // pretend success so bots don't learn anything, but skip the insert.
  if (body.website_url) {
    return jsonResponse({ success: true });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || String(body[field]).trim() === "") {
      return jsonResponse({ error: `অনুগ্রহ করে সকল আবশ্যক তথ্য পূরণ করুন (${field})।` }, { status: 400 });
    }
  }

  if (!isValidEmail(String(body.email).trim())) {
    return jsonResponse({ error: "অনুগ্রহ করে একটি সঠিক ই-মেইল ঠিকানা দিন।" }, { status: 400 });
  }

  const willAttend = String(body.will_attend).trim();
  if (willAttend !== "হ্যাঁ" && willAttend !== "না") {
    return jsonResponse({ error: "অনুষ্ঠানে অংশগ্রহণের তথ্য সঠিক নয়।" }, { status: 400 });
  }

  if (body.declaration_confirmed !== true) {
    return jsonResponse({ error: "ফর্ম জমা দেওয়ার আগে তথ্যের সঠিকতা নিশ্চিত করুন।" }, { status: 400 });
  }

  for (const key of ["profile_photo", "id_document_photo"]) {
    if (body[key] && String(body[key]).length > MAX_IMAGE_BASE64_LENGTH) {
      return jsonResponse({ error: "আপলোড করা ছবিটি অনেক বড়। অনুগ্রহ করে ছোট ছবি ব্যবহার করুন।" }, { status: 400 });
    }
  }

  const specialTalent = body.special_talent ? String(body.special_talent).trim() : "";
  const hasTalent = body.has_talent === "হ্যাঁ" || specialTalent !== "" ? "হ্যাঁ" : "না";

  try {
    await env.DB.prepare(
      `INSERT INTO registrations (
        full_name, father_name, mother_name,
        session, student_id,
        phone, email, present_address, permanent_address,
        will_attend, has_talent, special_talent, suggestions,
        profile_photo, id_document_photo, declaration_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        String(body.full_name).trim(),
        String(body.father_name).trim(),
        String(body.mother_name).trim(),
        String(body.session).trim(),
        String(body.student_id).trim(),
        String(body.phone).trim(),
        String(body.email).trim().toLowerCase(),
        String(body.present_address).trim(),
        String(body.permanent_address).trim(),
        willAttend,
        hasTalent,
        specialTalent || null,
        body.suggestions ? String(body.suggestions).trim() || null : null,
        body.profile_photo || null,
        body.id_document_photo || null,
        1
      )
      .run();

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: "নিবন্ধন সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" }, { status: 500 });
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}
