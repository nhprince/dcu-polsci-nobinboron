(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const toBn = (n) => String(n).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);

  const loginScreen = $("loginScreen");
  const appShell = $("appShell");
  const loginForm = $("loginForm");
  const loginError = $("loginError");
  const loginBtn = $("loginBtn");

  const searchInput = $("searchInput");
  const attendFilter = $("attendFilter");
  const talentFilter = $("talentFilter");
  const statusFilter = $("statusFilter");
  const sortSelect = $("sortSelect");
  const exportBtn = $("exportBtn");
  const membersTableBody = $("membersTableBody");
  const resultCount = $("resultCount");
  const selectAllCheckbox = $("selectAllCheckbox");
  const selectPendingBtn = $("selectPendingBtn");
  const bulkBar = $("bulkBar");
  const bulkCount = $("bulkCount");
  const bulkConfirmBtn = $("bulkConfirmBtn");
  const bulkClearBtn = $("bulkClearBtn");

  let overviewChart = null;
  let currentDeleteId = null;
  let searchDebounce = null;
  let currentMembers = [];
  const selectedIds = new Set();

  // ---------- Helpers ----------

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function initials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]).join("").toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
  }

  function openModal(id) {
    $(id).classList.add("active");
  }

  function closeModal(id) {
    $(id).classList.remove("active");
  }

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closeModal(el.dataset.close));
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("active");
    });
  });

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error("সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "একটি সমস্যা হয়েছে।");
    return data;
  }

  // ---------- Auth ----------

  function showLogin() {
    appShell.classList.remove("active");
    loginScreen.style.display = "flex";
  }

  function showApp() {
    loginScreen.style.display = "none";
    appShell.classList.add("active");
    initDashboard();
  }

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/check");
      if (res.ok) {
        showApp();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("active");
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const password = $("password").value;
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "লগইন ব্যর্থ হয়েছে।");
      $("password").value = "";
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.add("active");
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "লগইন করুন";
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  });

  // ---------- Dashboard init ----------

  let dashboardInitialized = false;

  function initDashboard() {
    loadStats();
    loadMembers();

    if (!dashboardInitialized) {
      dashboardInitialized = true;

      searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(loadMembers, 350);
      });
      attendFilter.addEventListener("change", loadMembers);
      talentFilter.addEventListener("change", loadMembers);
      statusFilter.addEventListener("change", loadMembers);
      sortSelect.addEventListener("change", loadMembers);
      exportBtn.addEventListener("click", () => {
        const [sortCol, sortOrder] = sortSelect.value.split(":");
        const params = new URLSearchParams({
          attend: attendFilter.value,
          talent: talentFilter.value,
          status: statusFilter.value,
          sort: sortCol,
          order: sortOrder,
        });
        window.location.href = `/api/admin/export?${params.toString()}`;
      });

      selectAllCheckbox.addEventListener("change", () => {
        membersTableBody.querySelectorAll(".row-check").forEach((cb) => {
          cb.checked = selectAllCheckbox.checked;
          toggleSelected(Number(cb.dataset.id), selectAllCheckbox.checked);
        });
        updateBulkBar();
      });

      membersTableBody.addEventListener("change", (e) => {
        if (!e.target.classList.contains("row-check")) return;
        toggleSelected(Number(e.target.dataset.id), e.target.checked);
        updateBulkBar();
      });

      selectPendingBtn.addEventListener("click", () => {
        currentMembers
          .filter((m) => m.confirmation_status !== "confirmed")
          .forEach((m) => selectedIds.add(m.id));
        membersTableBody.querySelectorAll(".row-check").forEach((cb) => {
          cb.checked = selectedIds.has(Number(cb.dataset.id));
        });
        updateBulkBar();
      });

      bulkClearBtn.addEventListener("click", clearSelection);
      bulkConfirmBtn.addEventListener("click", confirmBulk);
    }
  }

  // ---------- Stats ----------

  async function loadStats() {
    try {
      const stats = await api("/api/admin/stats");

      $("statTotal").textContent = toBn(stats.total);
      $("statAttending").textContent = toBn(stats.attending);
      $("statTalents").textContent = toBn(stats.talents);
      $("statRecent").textContent = toBn(stats.recent);

      renderChart(stats);
    } catch (err) {
      showToast(err.message);
    }
  }

  function renderChart(stats) {
    const canvas = $("overviewChart");
    if (!canvas) return;

    const labels = [
      "অংশগ্রহণ (হ্যাঁ)",
      "অংশগ্রহণ (না)",
      "বিশেষ প্রতিভা",
      "ই-মেইল নিশ্চিত",
      "অপেক্ষমাণ",
    ];
    const counts = [
      stats.attending || 0,
      stats.not_attending || 0,
      stats.talents || 0,
      stats.confirmed || 0,
      stats.pending || 0,
    ];
    const colors = ["#162a52", "#8d9ab3", "#c59638", "#16794c", "#9c7422"];

    if (typeof Chart !== "undefined") {
      const ctx = canvas.getContext("2d");
      if (overviewChart) {
        overviewChart.data.labels = labels;
        overviewChart.data.datasets[0].data = counts;
        overviewChart.update();
        return;
      }

      overviewChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "সংখ্যা",
            data: counts,
            backgroundColor: colors,
            borderRadius: 6,
            maxBarThickness: 48,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#e6ebf4" } },
            x: { grid: { display: false } },
          },
        },
      });
      return;
    }

    renderNativeCanvasChart(canvas, labels, counts, colors);
  }

  function renderNativeCanvasChart(canvas, labels, counts, colors) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 230;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const maxCount = Math.max(...counts, 1);
    const paddingBottom = 40;
    const paddingTop = 25;
    const paddingLeft = 30;
    const paddingRight = 20;
    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    ctx.strokeStyle = "#dce2ee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    const barWidth = Math.min(44, Math.max(18, (chartW / labels.length) * 0.55));
    const step = chartW / labels.length;

    labels.forEach((label, i) => {
      const val = counts[i];
      const barH = (val / maxCount) * chartH;
      const x = paddingLeft + i * step + (step - barWidth) / 2;
      const y = height - paddingBottom - barH;

      ctx.fillStyle = colors[i] || "#162a52";
      ctx.beginPath();
      const r = Math.min(6, barH);
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [r, r, 0, 0]) : ctx.rect(x, y, barWidth, barH);
      ctx.fill();

      ctx.fillStyle = "#0e1c3a";
      ctx.font = "bold 12px Hind Siliguri, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(toBn(val), x + barWidth / 2, y - 6);

      ctx.fillStyle = "#556178";
      ctx.font = "11px Hind Siliguri, sans-serif";
      const shortLabel = label.length > 14 ? label.slice(0, 13) + "…" : label;
      ctx.fillText(shortLabel, x + barWidth / 2, height - paddingBottom + 18);
    });
  }

  // ---------- Members table ----------

  async function loadMembers() {
    membersTableBody.innerHTML = '<tr class="loading-row"><td colspan="9">তালিকা লোড হচ্ছে…</td></tr>';

    const [sortCol, sortOrder] = sortSelect.value.split(":");
    const params = new URLSearchParams({
      search: searchInput.value.trim(),
      attend: attendFilter.value,
      talent: talentFilter.value,
      status: statusFilter.value,
      sort: sortCol,
      order: sortOrder,
    });

    try {
      const data = await api(`/api/admin/members?${params.toString()}`);
      clearSelection();
      currentMembers = data.members;
      renderMembers(data.members);
    } catch (err) {
      membersTableBody.innerHTML = `<tr class="loading-row"><td colspan="9">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderMembers(members) {
    resultCount.textContent = `মোট ${toBn(members.length)} জন শিক্ষার্থী পাওয়া গেছে`;

    if (members.length === 0) {
      membersTableBody.innerHTML = `
        <tr><td colspan="9">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem;"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <div>খোঁজার শর্ত অনুযায়ী কোনো তথ্য পাওয়া যায়নি।</div>
          </div>
        </td></tr>`;
      return;
    }

    membersTableBody.innerHTML = members.map((m) => {
      const avatar = m.has_profile_photo
        ? `<img class="avatar" src="/api/admin/members/${m.id}/photo?field=profile_photo" alt="" />`
        : `<div class="avatar">${escapeHtml(initials(m.full_name))}</div>`;
      const confirmed = m.confirmation_status === "confirmed";
      const attends = m.will_attend === "হ্যাঁ";
      const talentText = m.special_talent ? escapeHtml(m.special_talent) : "—";

      return `
      <tr>
        <td class="col-check"><input type="checkbox" class="row-check" data-id="${m.id}" /></td>
        <td class="member-name-td" data-label="শিক্ষার্থীর নাম">
          <div class="member-name-cell">
            ${avatar}
            <div class="details">
              <strong>${escapeHtml(m.full_name)}</strong>
              <span>শিক্ষাবর্ষ: ${escapeHtml(m.session)}</span>
            </div>
          </div>
        </td>
        <td data-label="আইডি / রোল">${escapeHtml(m.student_id)}</td>
        <td data-label="যোগাযোগ">${escapeHtml(m.phone)}<br /><span class="text-muted">${escapeHtml(m.email)}</span></td>
        <td data-label="অংশগ্রহণ">
          <span class="attend-badge ${attends ? "attend-yes" : "attend-no"}">${escapeHtml(m.will_attend)}</span>
        </td>
        <td data-label="বিশেষ প্রতিভা">${talentText}</td>
        <td data-label="নিবন্ধনের তারিখ">${formatDate(m.created_at)}</td>
        <td data-label="অবস্থা">
          <span class="status-badge ${confirmed ? "status-confirmed" : "status-pending"}">${confirmed ? "নিশ্চিতকৃত" : "অপেক্ষমাণ"}</span>
        </td>
        <td data-label="">
          <div class="row-actions">
            <button class="icon-btn" title="বিস্তারিত দেখুন" onclick="AdminPanel.viewMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="icon-btn" title="${confirmed ? "পুনরায় নিশ্চিতকরণ ই-মেইল পাঠান" : "নিশ্চিতকরণ ই-মেইল পাঠান"}" onclick="AdminPanel.confirmMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9 6 9-6"></path><rect x="3" y="5" width="18" height="14" rx="2"></rect></svg>
            </button>
            <button class="icon-btn" title="সম্পাদনা করুন" onclick="AdminPanel.editMember(${m.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
            </button>
            <button class="icon-btn danger" title="মুছে ফেলুন" onclick="AdminPanel.deleteMember(${m.id}, '${escapeHtml(m.full_name).replace(/'/g, "\\'")}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join("");
  }

  // ---------- Bulk selection & bulk confirm ----------

  function toggleSelected(id, isSelected) {
    if (isSelected) selectedIds.add(id);
    else selectedIds.delete(id);
  }

  function clearSelection() {
    selectedIds.clear();
    membersTableBody.querySelectorAll(".row-check").forEach((cb) => (cb.checked = false));
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateBulkBar();
  }

  function updateBulkBar() {
    const count = selectedIds.size;
    bulkCount.textContent = `${toBn(count)} টি নির্বাচিত`;
    bulkBar.classList.toggle("active", count > 0);
  }

  async function confirmBulk() {
    if (selectedIds.size === 0) return;

    bulkConfirmBtn.disabled = true;
    const originalText = bulkConfirmBtn.textContent;
    bulkConfirmBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const data = await api("/api/admin/members/confirm-bulk", {
        method: "POST",
        body: JSON.stringify({ ids: [...selectedIds] }),
      });

      const parts = [];
      if (data.sent) parts.push(`${toBn(data.sent)} টি পাঠানো হয়েছে`);
      if (data.failed && data.failed.length) parts.push(`${toBn(data.failed.length)} টি ব্যর্থ`);
      if (data.skipped && data.skipped.length) parts.push(`${toBn(data.skipped.length)} টি দৈনিক সীমায় বাদ পড়েছে`);
      showToast(data.warning || (parts.length ? parts.join(", ") + "।" : "কোনো ই-মেইল পাঠানো হয়নি।"));

      clearSelection();
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message || "একত্রে ই-মেইল পাঠানো যায়নি।");
    } finally {
      bulkConfirmBtn.disabled = false;
      bulkConfirmBtn.textContent = originalText;
    }
  }

  // ---------- View modal ----------

  async function viewMember(id) {
    openModal("viewModal");
    $("viewModalBody").innerHTML = '<p class="text-muted">তথ্য লোড হচ্ছে…</p>';

    try {
      const { member: m } = await api(`/api/admin/members/${id}`);

      let html = "";

      if (m.profile_photo || m.id_document_photo) {
        html += `<div class="modal-photos">`;
        if (m.profile_photo) html += `<div><img src="${m.profile_photo}" alt="প্রোফাইল ছবি" /><div class="photo-label">প্রোফাইল ছবি</div></div>`;
        if (m.id_document_photo) html += `<div><img src="${m.id_document_photo}" alt="আইডি / ভর্তি রশিদ" /><div class="photo-label">আইডি / ভর্তি রশিদ</div></div>`;
        html += `</div>`;
      }

      const confirmed = m.confirmation_status === "confirmed";
      html += `<div class="modal-section-title">নিবন্ধন নিশ্চিতকরণ</div><div class="detail-grid">`;
      html += `<div><div class="k">অবস্থা</div><div class="v"><span class="status-badge ${confirmed ? "status-confirmed" : "status-pending"}">${confirmed ? "নিশ্চিতকৃত" : "অপেক্ষমাণ"}</span></div></div>`;
      html += `<div><div class="k">${confirmed ? "নিশ্চিতকরণের তারিখ" : "ই-মেইল"}</div><div class="v">${m.confirmed_at ? formatDate(m.confirmed_at) : "—"}</div></div>`;
      html += `<div class="detail-full"><button type="button" class="btn btn-ghost btn-sm" onclick="AdminPanel.confirmMember(${m.id})">${confirmed ? "পুনরায় নিশ্চিতকরণ ই-মেইল পাঠান" : "নিশ্চিতকরণ ই-মেইল পাঠান"}</button></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">ব্যক্তিগত ও একাডেমিক তথ্য</div><div class="detail-grid">`;
      html += `<div class="detail-full"><div class="k">শিক্ষার্থীর পূর্ণ নাম</div><div class="v">${escapeHtml(m.full_name)}</div></div>`;
      html += `<div><div class="k">পিতার নাম</div><div class="v">${escapeHtml(m.father_name)}</div></div>`;
      html += `<div><div class="k">মাতার নাম</div><div class="v">${escapeHtml(m.mother_name)}</div></div>`;
      html += `<div><div class="k">শিক্ষাবর্ষ</div><div class="v">${escapeHtml(m.session)}</div></div>`;
      html += `<div><div class="k">শিক্ষার্থী আইডি / রোল নম্বর</div><div class="v">${escapeHtml(m.student_id)}</div></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">যোগাযোগ ও ঠিকানা</div><div class="detail-grid">`;
      html += `<div><div class="k">মোবাইল নম্বর</div><div class="v">${escapeHtml(m.phone)}</div></div>`;
      html += `<div><div class="k">ই-মেইল ঠিকানা</div><div class="v">${escapeHtml(m.email)}</div></div>`;
      html += `<div class="detail-full"><div class="k">বর্তমান ঠিকানা</div><div class="v">${escapeHtml(m.present_address) || "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">স্থায়ী ঠিকানা</div><div class="v">${escapeHtml(m.permanent_address) || "—"}</div></div>`;
      html += `</div>`;

      html += `<div class="modal-section-title">অনুষ্ঠান, প্রতিভা ও পরামর্শ</div><div class="detail-grid">`;
      html += `<div><div class="k">নবীনবরণে অংশগ্রহণ</div><div class="v">${escapeHtml(m.will_attend)}</div></div>`;
      html += `<div><div class="k">বিশেষ প্রতিভা বা পরিবেশনা</div><div class="v">${m.special_talent ? escapeHtml(m.special_talent) : "না"}</div></div>`;
      html += `<div class="detail-full"><div class="k">পরামর্শ বা প্রত্যাশা</div><div class="v">${escapeHtml(m.suggestions) || "—"}</div></div>`;
      html += `<div class="detail-full"><div class="k">নিবন্ধনের সময়</div><div class="v">${formatDate(m.created_at)}</div></div>`;
      html += `</div>`;

      $("viewModalBody").innerHTML = html;
    } catch (err) {
      $("viewModalBody").innerHTML = `<p class="text-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Edit modal ----------

  const editPhotoState = {};

  function compressImage(file, maxDim = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("ফাইলটি পড়া যায়নি।"));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("ছবিটি পড়া যায়নি।"));
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else if (height >= width && height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function editField(id, label, value, type = "text") {
    if (type === "textarea") {
      return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><textarea id="${id}" rows="2">${escapeHtml(value || "")}</textarea></div>`;
    }
    return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><input type="${type}" id="${id}" value="${escapeHtml(value || "")}" /></div>`;
  }

  function editSelectField(id, label, value, options) {
    const optsHtml = options
      .map((opt) => `<option value="${escapeHtml(opt)}"${value === opt ? " selected" : ""}>${escapeHtml(opt)}</option>`)
      .join("");
    return `<div class="field"><label for="${id}">${escapeHtml(label)}</label><select id="${id}">${optsHtml}</select></div>`;
  }

  function photoEditField(fieldKey, label, currentValue) {
    const hasPhoto = !!currentValue;
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <div class="upload-card">
          <div class="upload-preview" id="editPreview_${fieldKey}">
            ${hasPhoto
              ? `<img src="${currentValue}" alt="" />`
              : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"></path></svg>`}
          </div>
          <div class="upload-content">
            <strong id="editLabel_${fieldKey}">${hasPhoto ? "ছবি সংরক্ষিত আছে" : "কোনো ছবি নেই"}</strong>
            <span class="upload-subtext">JPG বা PNG, স্বয়ংক্রিয়ভাবে সাইজ সমন্বয় হবে</span>
            <div class="upload-btn-group">
              <button type="button" class="btn-action btn-browse" data-photo-trigger="${fieldKey}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                ছবি পরিবর্তন করুন
              </button>
            </div>
          </div>
          <input type="file" id="editFile_${fieldKey}" accept="image/*" class="visually-hidden" />
        </div>
      </div>`;
  }

  async function handleEditPhotoChange(fieldKey, file) {
    if (!file) return;
    const label = $(`editLabel_${fieldKey}`);
    const originalLabel = label.textContent;
    label.textContent = "ছবি প্রক্রিয়াকরণ চলছে…";

    try {
      const dataUrl = await compressImage(file);
      editPhotoState[fieldKey] = dataUrl;
      $(`editPreview_${fieldKey}`).innerHTML = `<img src="${dataUrl}" alt="" />`;
      label.textContent = "নতুন ছবি নির্বাচিত হয়েছে ✓";
    } catch {
      label.textContent = originalLabel;
      showToast("ছবিটি পড়া যায়নি — অনুগ্রহ করে অন্য ফাইল চেষ্টা করুন।");
    }
  }

  async function editMember(id) {
    openModal("editModal");
    $("editModalBody").innerHTML = '<p class="text-muted">লোড হচ্ছে…</p>';
    $("edit_id").value = id;
    editPhotoState.profile_photo = undefined;
    editPhotoState.id_document_photo = undefined;

    try {
      const { member: m } = await api(`/api/admin/members/${id}`);

      let html = "";
      html += photoEditField("profile_photo", "প্রোফাইল ছবি", m.profile_photo);
      html += `<div class="field-row">${editField("edit_full_name", "শিক্ষার্থীর পূর্ণ নাম", m.full_name)}${editField("edit_student_id", "শিক্ষার্থী আইডি / রোল", m.student_id)}</div>`;
      html += `<div class="field-row">${editField("edit_father_name", "পিতার নাম", m.father_name)}${editField("edit_mother_name", "মাতার নাম", m.mother_name)}</div>`;
      html += `<div class="field-row">${editField("edit_session", "শিক্ষাবর্ষ", m.session)}${editSelectField("edit_will_attend", "অনুষ্ঠানে অংশগ্রহণ", m.will_attend, ["হ্যাঁ", "না"])}</div>`;
      html += `<div class="field-row">${editField("edit_phone", "মোবাইল নম্বর", m.phone, "tel")}${editField("edit_email", "ই-মেইল ঠিকানা", m.email, "email")}</div>`;
      html += editField("edit_present_address", "বর্তমান ঠিকানা", m.present_address, "textarea");
      html += editField("edit_permanent_address", "স্থায়ী ঠিকানা", m.permanent_address, "textarea");
      html += editField("edit_special_talent", "বিশেষ প্রতিভা বা পরিবেশনা (প্রতিভার নাম)", m.special_talent);
      html += editField("edit_suggestions", "পরামর্শ বা প্রত্যাশা", m.suggestions, "textarea");
      html += photoEditField("id_document_photo", "আইডি কার্ড / ভর্তি রশিদ", m.id_document_photo);

      $("editModalBody").innerHTML = html;

      $("editModalBody").querySelectorAll("[data-photo-trigger]").forEach((btn) => {
        const fieldKey = btn.dataset.photoTrigger;
        btn.addEventListener("click", () => $(`editFile_${fieldKey}`).click());
        $(`editFile_${fieldKey}`).addEventListener("change", (e) => {
          handleEditPhotoChange(fieldKey, e.target.files && e.target.files[0]);
        });
      });
    } catch (err) {
      $("editModalBody").innerHTML = `<p class="text-muted">${escapeHtml(err.message)}</p>`;
    }
  }

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("edit_id").value;
    const saveBtn = $("saveEditBtn");
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.innerHTML = '<span class="spinner"></span>';

    const specialTalent = $("edit_special_talent").value.trim();

    const payload = {
      full_name: $("edit_full_name").value.trim(),
      father_name: $("edit_father_name").value.trim(),
      mother_name: $("edit_mother_name").value.trim(),
      student_id: $("edit_student_id").value.trim(),
      session: $("edit_session").value.trim(),
      will_attend: $("edit_will_attend").value,
      phone: $("edit_phone").value.trim(),
      email: $("edit_email").value.trim(),
      present_address: $("edit_present_address").value.trim(),
      permanent_address: $("edit_permanent_address").value.trim(),
      has_talent: specialTalent ? "হ্যাঁ" : "না",
      special_talent: specialTalent,
      suggestions: $("edit_suggestions").value.trim(),
    };

    if (editPhotoState.profile_photo) payload.profile_photo = editPhotoState.profile_photo;
    if (editPhotoState.id_document_photo) payload.id_document_photo = editPhotoState.id_document_photo;

    try {
      await api(`/api/admin/members/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      closeModal("editModal");
      showToast("তথ্য হালনাগাদ করা হয়েছে।");
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });

  // ---------- Delete ----------

  function deleteMember(id, name) {
    currentDeleteId = id;
    $("deleteMemberName").textContent = name;
    openModal("deleteModal");
  }

  $("confirmDeleteBtn").addEventListener("click", async () => {
    if (!currentDeleteId) return;
    const btn = $("confirmDeleteBtn");
    btn.disabled = true;

    try {
      await api(`/api/admin/members/${currentDeleteId}`, { method: "DELETE" });
      closeModal("deleteModal");
      showToast("নিবন্ধন মুছে ফেলা হয়েছে।");
      loadMembers();
      loadStats();
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
      currentDeleteId = null;
    }
  });

  // ---------- Confirmation email ----------

  const confirmInFlight = new Set();

  async function confirmMember(id) {
    if (confirmInFlight.has(id)) return;
    confirmInFlight.add(id);

    try {
      const data = await api(`/api/admin/members/${id}/confirm`, { method: "POST" });
      showToast(data.warning || data.message || "নিশ্চিতকরণ ই-মেইল পাঠানো হয়েছে।");
      loadMembers();
      loadStats();
      if (document.getElementById("viewModal").classList.contains("active")) {
        viewMember(id);
      }
    } catch (err) {
      showToast(err.message || "নিশ্চিতকরণ ই-মেইল পাঠানো যায়নি।");
    } finally {
      confirmInFlight.delete(id);
    }
  }

  window.AdminPanel = { viewMember, editMember, deleteMember, confirmMember };

  checkAuth();
})();
