import { requireAuth, jsonResponse, unauthorized } from "../../_utils/auth.js";

const STATUS_FILTERS = new Set(["confirmed", "pending"]);
const ATTEND_FILTERS = new Set(["হ্যাঁ", "না"]);

const SORTABLE_COLUMNS = new Set([
  "created_at",
  "full_name",
  "student_id",
  "session",
  "will_attend",
]);

const DB_COLUMNS = [
  "id",
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
  "created_at",
  "confirmation_status",
  "confirmed_at",
];

const CSV_COLUMNS = [...DB_COLUMNS, "profile_photo_url", "id_document_photo_url"];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await requireAuth(request, env))) return unauthorized();

  try {
    const origin = new URL(request.url).origin;
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") || "").trim();
    const attend = (url.searchParams.get("attend") || "").trim();
    const talent = (url.searchParams.get("talent") || "").trim();
    const sortParam = url.searchParams.get("sort") || "created_at";
    const orderParam = (url.searchParams.get("order") || "desc").toLowerCase();
    const sortCol = SORTABLE_COLUMNS.has(sortParam) ? sortParam : "created_at";
    const order = orderParam === "asc" ? "ASC" : "DESC";

    const clauses = [];
    const whereParams = [];
    if (STATUS_FILTERS.has(status)) {
      clauses.push("confirmation_status = ?");
      whereParams.push(status);
    }
    if (ATTEND_FILTERS.has(attend)) {
      clauses.push("will_attend = ?");
      whereParams.push(attend);
    }
    if (talent === "হ্যাঁ") {
      clauses.push("(has_talent = 'হ্যাঁ' OR (special_talent IS NOT NULL AND TRIM(special_talent) != ''))");
    }

    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";

    const { results } = await env.DB.prepare(
      `SELECT ${DB_COLUMNS.join(", ")},
              (profile_photo IS NOT NULL) AS has_profile_photo,
              (id_document_photo IS NOT NULL) AS has_id_document_photo
       FROM registrations${where} ORDER BY ${sortCol} ${order}`
    ).bind(...whereParams).all();

    const lines = [CSV_COLUMNS.join(",")];
    for (const row of results) {
      const values = CSV_COLUMNS.map((col) => {
        if (col === "profile_photo_url") {
          return row.has_profile_photo ? csvEscape(`${origin}/api/admin/members/${row.id}/photo?field=profile_photo`) : "";
        }
        if (col === "id_document_photo_url") {
          return row.has_id_document_photo
            ? csvEscape(`${origin}/api/admin/members/${row.id}/photo?field=id_document_photo`)
            : "";
        }
        return csvEscape(row[col]);
      });
      lines.push(values.join(","));
    }

    // Prepend UTF-8 BOM so Bangla text renders cleanly in Microsoft Excel
    const csv = "\uFEFF" + lines.join("\n");
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dcu-polsci-nobinboron-2025-26-${date}.csv"`,
      },
    });
  } catch (err) {
    return jsonResponse({ error: "ডেটা এক্সপোর্ট করা যায়নি।" }, { status: 500 });
  }
}
