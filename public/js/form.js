(() => {
  "use strict";

  const TOTAL_STEPS = 6;
  const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  const toBn = (n) => String(n).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);

  const STEP_TITLES = {
    1: "ব্যক্তিগত তথ্য",
    2: "একাডেমিক তথ্য",
    3: "যোগাযোগ ও ঠিকানা",
    4: "অংশগ্রহণ, প্রতিভা ও পরামর্শ",
    5: "ছবি ও পরিচয়পত্র",
    6: "তথ্য যাচাই ও জমা",
  };

  const state = {
    currentStep: 1,
    profile_photo: null,
    id_document_photo: null,
    processingProfile: false,
    processingId: false,
  };

  const $ = (id) => document.getElementById(id);

  const form = $("registrationForm");
  const progressTrack = $("progressTrack");
  const stepTitleEl = $("stepTitle");
  const stepCountEl = $("stepCount");
  const backBtn = $("backBtn");
  const nextBtn = $("nextBtn");
  const submitError = $("submitError");
  const formShell = $("formShell");
  const successScreen = $("successScreen");

  const sameAddressCheckbox = $("sameAddress");
  const presentAddressInput = $("present_address");
  const permanentAddressField = $("field_permanent_address");
  const permanentAddressInput = $("permanent_address");

  const specialTalentField = $("field_special_talent");
  const specialTalentInput = $("special_talent");
  const declarationCheckbox = $("declaration_confirmed");

  window.$ = $;

  // ---------- Live Camera Viewfinder Engine (WebRTC) ----------

  let activeCameraStream = null;
  let currentTargetPhotoKey = null;
  let currentFacingMode = "user";

  const cameraModal = $("cameraModal");
  const cameraVideo = $("cameraVideo");
  const cameraGuide = $("cameraGuide");
  const cameraModalTitle = $("cameraModalTitle");
  const cameraSwitchBtn = $("cameraSwitchBtn");
  const cameraCloseBtn = $("cameraCloseBtn");
  const cameraCaptureBtn = $("cameraCaptureBtn");

  async function startCameraStream() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      };

      activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = activeCameraStream;
      cameraVideo.classList.toggle("mirror", currentFacingMode === "user");
    } catch (err) {
      alert("ক্যামেরা চালু করা যায়নি। অনুগ্রহ করে ব্রাউজারে ক্যামেরা অনুমতি দিন অথবা 'ফাইল নির্বাচন' ব্যবহার করুন।");
      closeCameraModal();
    }
  }

  function openCamera(targetKey) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("আপনার ব্রাউজারে সরাসরি ক্যামেরা সুবিধা নেই। অনুগ্রহ করে 'ফাইল নির্বাচন' ব্যবহার করুন।");
      $(targetKey).click();
      return;
    }

    currentTargetPhotoKey = targetKey;
    if (targetKey === "profile_photo") {
      cameraModalTitle.textContent = "প্রোফাইল ছবি তুলুন";
      currentFacingMode = "user";
      cameraGuide.className = "camera-guide guide-profile";
    } else {
      cameraModalTitle.textContent = "আইডি কার্ড / ভর্তি রশিদের ছবি তুলুন";
      currentFacingMode = "environment";
      cameraGuide.className = "camera-guide guide-document";
    }

    cameraModal.classList.add("active");
    startCameraStream();
  }

  function closeCameraModal() {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((track) => track.stop());
      activeCameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.classList.remove("active");
    currentTargetPhotoKey = null;
  }

  cameraCloseBtn.addEventListener("click", closeCameraModal);
  cameraModal.addEventListener("click", (e) => {
    if (e.target === cameraModal) closeCameraModal();
  });

  cameraSwitchBtn.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    startCameraStream();
  });

  cameraCaptureBtn.addEventListener("click", async () => {
    if (!activeCameraStream) return;

    const canvas = $("cameraCanvas");
    canvas.width = cameraVideo.videoWidth || 1280;
    canvas.height = cameraVideo.videoHeight || 960;
    const ctx = canvas.getContext("2d");

    if (currentFacingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    const isProfile = currentTargetPhotoKey === "profile_photo";
    const previewEl = $(isProfile ? "profilePreview" : "idDocPreview");
    const labelEl = $(isProfile ? "profileUploadLabel" : "idDocUploadLabel");

    state[currentTargetPhotoKey] = rawDataUrl;
    previewEl.innerHTML = `<img src="${rawDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
    labelEl.textContent = "ছবি তোলা সম্পন্ন ✓";

    closeCameraModal();
  });

  window.openCamera = openCamera;

  // ---------- Progress bar ----------

  function buildProgressTrack() {
    progressTrack.innerHTML = "";
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const segment = document.createElement("div");
      segment.className = "segment";
      segment.dataset.segment = String(i);
      segment.innerHTML = '<div class="fill"></div>';
      progressTrack.appendChild(segment);
    }
  }

  function updateProgress() {
    document.querySelectorAll(".segment").forEach((seg) => {
      const i = Number(seg.dataset.segment);
      seg.classList.toggle("done", i < state.currentStep);
      seg.classList.toggle("current", i === state.currentStep);
    });
    stepTitleEl.textContent = STEP_TITLES[state.currentStep];
    stepCountEl.textContent = `ধাপ ${toBn(state.currentStep)} / ${toBn(TOTAL_STEPS)}`;
  }

  // ---------- Step navigation ----------

  function showStep(step) {
    document.querySelectorAll(".step").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.step) === step);
    });
    state.currentStep = step;
    updateProgress();

    backBtn.style.visibility = step === 1 ? "hidden" : "visible";

    if (step === TOTAL_STEPS) {
      nextBtn.textContent = "নিবন্ধন জমা দিন";
    } else if (step === TOTAL_STEPS - 1) {
      nextBtn.textContent = "তথ্য যাচাই করুন";
    } else {
      nextBtn.textContent = "পরবর্তী";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setError(fieldId, isValid) {
    const el = $(fieldId);
    if (el) el.classList.toggle("has-error", !isValid);
    return isValid;
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function getRadioValue(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "";
  }

  function validateStep(step) {
    let valid = true;

    if (step === 1) {
      valid = setError("field_full_name", $("full_name").value.trim() !== "") && valid;
      valid = setError("field_father_name", $("father_name").value.trim() !== "") && valid;
      valid = setError("field_mother_name", $("mother_name").value.trim() !== "") && valid;
    }

    if (step === 2) {
      valid = setError("field_session", $("session").value.trim() !== "") && valid;
      valid = setError("field_student_id", $("student_id").value.trim() !== "") && valid;
    }

    if (step === 3) {
      valid = setError("field_phone", $("phone").value.trim() !== "") && valid;
      valid = setError("field_email", isEmail($("email").value.trim())) && valid;
      valid = setError("field_present_address", presentAddressInput.value.trim() !== "") && valid;
      syncAddress();
      valid = setError("field_permanent_address", permanentAddressInput.value.trim() !== "") && valid;
    }

    if (step === 4) {
      const willAttend = getRadioValue("will_attend");
      valid = setError("field_will_attend", willAttend === "হ্যাঁ" || willAttend === "না") && valid;

      const hasTalent = getRadioValue("has_talent");
      if (hasTalent === "হ্যাঁ") {
        valid = setError("field_special_talent", specialTalentInput.value.trim() !== "") && valid;
      } else {
        setError("field_special_talent", true);
      }
    }

    if (step === 5) {
      if (state.processingProfile || state.processingId) return false;
    }

    if (step === 6) {
      valid = setError("field_declaration", declarationCheckbox.checked) && valid;
    }

    return valid;
  }

  backBtn.addEventListener("click", () => {
    if (state.currentStep > 1) showStep(state.currentStep - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (state.currentStep === TOTAL_STEPS) {
      if (!validateStep(TOTAL_STEPS)) return;
      submitForm();
      return;
    }

    if (!validateStep(state.currentStep)) return;

    const next = state.currentStep + 1;
    if (next === TOTAL_STEPS) buildReview();
    showStep(next);
  });

  // Same address toggle
  function syncAddress() {
    if (sameAddressCheckbox.checked) {
      permanentAddressInput.value = presentAddressInput.value;
    }
  }

  sameAddressCheckbox.addEventListener("change", () => {
    permanentAddressField.style.display = sameAddressCheckbox.checked ? "none" : "block";
    syncAddress();
  });

  presentAddressInput.addEventListener("input", syncAddress);

  // Talent toggle
  document.querySelectorAll('input[name="has_talent"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const show = getRadioValue("has_talent") === "হ্যাঁ";
      specialTalentField.style.display = show ? "block" : "none";
      if (!show) {
        specialTalentInput.value = "";
        setError("field_special_talent", true);
      }
    });
  });

  declarationCheckbox.addEventListener("change", () => {
    if (declarationCheckbox.checked) setError("field_declaration", true);
  });

  // ---------- Image Compression ----------

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

  function wireUploadInput(inputId, previewId, labelId, stateKey, processingKey) {
    const input = $(inputId);
    const preview = $(previewId);
    const label = $(labelId);
    const originalLabel = label.textContent;

    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      state[processingKey] = true;
      label.textContent = "ছবি প্রক্রিয়াকরণ চলছে…";

      try {
        const dataUrl = await compressImage(file);
        state[stateKey] = dataUrl;
        preview.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />`;
        label.textContent = "ছবি প্রস্তুত ✓";
      } catch (err) {
        state[stateKey] = null;
        label.textContent = originalLabel;
        input.value = "";
      } finally {
        state[processingKey] = false;
      }
    });
  }

  wireUploadInput("profile_photo", "profilePreview", "profileUploadLabel", "profile_photo", "processingProfile");
  wireUploadInput("id_document_photo", "idDocPreview", "idDocUploadLabel", "id_document_photo", "processingId");

  // ---------- Review & Submit ----------

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function fieldLabel(value, fallback = "—") {
    const v = (value || "").toString().trim();
    return v === "" ? fallback : escapeHtml(v);
  }

  function collectData() {
    syncAddress();
    const hasTalent = getRadioValue("has_talent") || "না";
    return {
      full_name: $("full_name").value.trim(),
      father_name: $("father_name").value.trim(),
      mother_name: $("mother_name").value.trim(),

      session: $("session").value.trim(),
      student_id: $("student_id").value.trim(),

      phone: $("phone").value.trim(),
      email: $("email").value.trim(),
      present_address: presentAddressInput.value.trim(),
      permanent_address: permanentAddressInput.value.trim(),

      will_attend: getRadioValue("will_attend"),
      has_talent: hasTalent,
      special_talent: hasTalent === "হ্যাঁ" ? specialTalentInput.value.trim() : "",
      suggestions: $("suggestions").value.trim(),

      profile_photo: state.profile_photo,
      id_document_photo: state.id_document_photo,

      declaration_confirmed: declarationCheckbox.checked,
      website_url: $("website_url").value,
    };
  }

  function buildReview() {
    const d = collectData();

    const section = (title, items) => `
      <div class="review-section">
        <h3>${title}</h3>
        <div class="review-grid">
          ${items.map(([k, v, full]) => `<div class="review-item${full ? " full" : ""}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}
        </div>
      </div>`;

    let html = "";

    if (d.profile_photo || d.id_document_photo) {
      html += `<div class="review-photos">`;
      if (d.profile_photo) html += `<img src="${d.profile_photo}" alt="প্রোফাইল ছবি" />`;
      if (d.id_document_photo) html += `<img src="${d.id_document_photo}" alt="আইডি কার্ড বা ভর্তি রশিদ" />`;
      html += `</div>`;
    }

    html += section("ব্যক্তিগত তথ্য", [
      ["শিক্ষার্থীর পূর্ণ নাম", fieldLabel(d.full_name), true],
      ["পিতার নাম", fieldLabel(d.father_name)],
      ["মাতার নাম", fieldLabel(d.mother_name)],
    ]);

    html += section("একাডেমিক ও যোগাযোগ", [
      ["শিক্ষাবর্ষ", fieldLabel(d.session)],
      ["শিক্ষার্থী আইডি / রোল নম্বর", fieldLabel(d.student_id)],
      ["মোবাইল নম্বর", fieldLabel(d.phone)],
      ["ই-মেইল ঠিকানা", fieldLabel(d.email)],
      ["বর্তমান ঠিকানা", fieldLabel(d.present_address), true],
      ["স্থায়ী ঠিকানা", fieldLabel(d.permanent_address), true],
    ]);

    html += section("অনুষ্ঠান ও প্রতিভা", [
      ["অনুষ্ঠানে অংশগ্রহণ", fieldLabel(d.will_attend)],
      ["বিশেষ প্রতিভা / পরিবেশনা", d.has_talent === "হ্যাঁ" ? fieldLabel(d.special_talent) : "না"],
      ["পরামর্শ বা প্রত্যাশা", fieldLabel(d.suggestions), true],
    ]);

    $("reviewContent").innerHTML = html;
  }

  async function submitForm() {
    submitError.classList.remove("active");
    nextBtn.disabled = true;
    backBtn.disabled = true;
    const originalText = nextBtn.textContent;
    nextBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const payload = collectData();
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "নিবন্ধন সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
      }

      formShell.classList.add("hidden");
      successScreen.classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      submitError.textContent = err.message || "একটি সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।";
      submitError.classList.add("active");
      submitError.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      nextBtn.disabled = false;
      backBtn.disabled = false;
      nextBtn.textContent = originalText;
    }
  }

  $("submitAnotherBtn").addEventListener("click", () => window.location.reload());
  form.addEventListener("submit", (e) => e.preventDefault());

  buildProgressTrack();
  showStep(1);
})();
