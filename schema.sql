-- রাষ্ট্রবিজ্ঞান বিভাগ — নবীনবরণ ২০২৫–২৬
-- ঢাকা সেন্ট্রাল ইউনিভার্সিটি (সরকারি শহীদ সোহরাওয়ার্দী কলেজ ক্যাম্পাস)
-- D1 (SQLite) schema
--
-- NOTE: this file is for a FRESH database only — it drops the table first.

DROP TABLE IF EXISTS registrations;

CREATE TABLE registrations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  -- ব্যক্তিগত তথ্য
  full_name             TEXT NOT NULL,
  father_name           TEXT NOT NULL,
  mother_name           TEXT NOT NULL,

  -- একাডেমিক তথ্য
  session               TEXT NOT NULL,
  student_id            TEXT NOT NULL,

  -- যোগাযোগ ও ঠিকানা
  phone                 TEXT NOT NULL,
  email                 TEXT NOT NULL,
  present_address       TEXT NOT NULL,
  permanent_address     TEXT NOT NULL,

  -- অনুষ্ঠান, প্রতিভা ও পরামর্শ
  will_attend           TEXT NOT NULL,              -- 'হ্যাঁ' | 'না'
  has_talent            TEXT NOT NULL DEFAULT 'না', -- 'হ্যাঁ' | 'না'
  special_talent        TEXT,
  suggestions           TEXT,

  -- ছবি ও কাগজপত্র (ঐচ্ছিক)
  profile_photo         TEXT,                       -- base64 data URI, resized client-side
  id_document_photo     TEXT,                       -- base64 data URI: শিক্ষার্থী আইডি কার্ড বা ভর্তি রশিদ

  -- নিশ্চিতকরণ
  declaration_confirmed INTEGER NOT NULL DEFAULT 1,
  confirmation_status   TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed'
  confirmed_at          TEXT,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_registrations_will_attend ON registrations(will_attend);
CREATE INDEX idx_registrations_session ON registrations(session);
CREATE INDEX idx_registrations_created_at ON registrations(created_at);
CREATE INDEX idx_registrations_student_id ON registrations(student_id);
