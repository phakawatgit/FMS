(() => {
  const languageSelector = [
    ".topbar .language",
    ".topbar .language-tool",
    ".topbar .language-switcher",
    ".topbar #languageButton",
    ".admin-topbar .topbar-language",
  ].join(", ");

  // Shared Thai/English copy used by every Front-end page. Page-specific
  // scripts can still provide richer translations for their own data.
  const copy = {
    "กลับหน้าเมนู": "Back to menu",
    "กลับไปหน้าเมนู": "Back to menu",
    "กลับหน้าระบบการยืมคืน": "Back to Borrowing & Return",
    "กลับหน้าการยืม-คืน": "Back to Borrowing & Return",
    "กลับหน้ากรอกข้อมูลการยืม": "Back to Borrowing Form",
    "กลับหน้ารายการยืม-คืน": "Back to Borrowing & Return",
    "กลับหน้ารายการยืม": "Back to Borrowing List",
    "กลับหน้าคลังยา": "Back to Inventory",
    "กลับหน้าคลังทั้งหมด": "Back to Inventory",
    "กลับหน้า Catalog": "Back to Catalog",
    "กลับหน้าบันทึก": "Back to Visit Form",
    "ไทย": "Thai",
    "อังกฤษ": "English",
    "English": "English",
    "เมนู": "Menu",
    "การแจ้งเตือน": "Notifications",
    "อ่านทั้งหมด": "Mark all as read",
    "ออกจากระบบ": "Log out",
    "บันทึก": "Save",
    "บันทึกข้อมูล": "Save data",
    "ยกเลิก": "Cancel",
    "ล้างข้อมูล": "Clear",
    "ตกลง": "OK",
    "ค้นหา": "Search",
    "เลือกสาขา": "Select branch",
    "ชื่อ-นามสกุล": "Full name",
    "ชื่อเล่น": "Nickname",
    "รหัสนักศึกษา": "Student ID",
    "เบอร์โทรศัพท์": "Phone number",
    "สัญญาการยืมคืน": "Borrowing & Return Agreement",
    "ยา และเวชภัณฑ์": "Medicines & Medical Supplies",
    "ยาและเวชภัณฑ์ที่จะยืม": "Medicines & Supplies to Borrow",
    "รายละเอียดของยา": "Medicine Details",
    "ชื่อสินค้า": "Product name",
    "ชื่อสามัญ": "Generic name",
    "ประเภท": "Category",
    "รหัสยา": "Medicine code",
    "รูปแบบ": "Form",
    "ขนาด": "Size",
    "หน่วยนับ": "Unit",
    "สถานะสินค้า": "Product status",
    "สรรพคุณ": "Benefits",
    "อาการที่ใช้": "Indications",
    "วิธีใช้โดยทั่วไป": "General usage",
    "ข้อควรระวัง": "Precautions",
    "วันหมดอายุ": "Expiry date",
    "ทั้งหมด": "All",
    "ยากิน": "Oral medicine",
    "ยาทา": "Topical medicine",
    "เวชภัณฑ์": "Medical supplies",
    "ปกติ": "Normal",
    "ใกล้หมด": "Low stock",
    "หมด": "Out of stock",
    "เพิ่มยา": "Add medicine",
    "รูปภาพยา": "Medicine image",
    "เลือกรูปยา": "Choose image",
    "คงคลัง": "Inventory",
    "ทั้งหมด": "Total",
    "ใช้/เบิก": "Used/Issued",
    "เหลือ": "Remaining",
    "หน่วย": "units",
    "รอประเมิน": "Pending assessment",
    "กลับไปหน้ารอประเมิน": "Back to Pending Assessment",
    "ประวัติ": "History",
    "ประวัติการยืม-คืน": "Borrowing & Return History",
    "ประวัติคลังยา": "Inventory History",
    "กรุณาเลือกประเภทบุคลากรก่อนบันทึก": "Please select a staff type before saving",
    "กรุณาเลือกสถานะก่อนบันทึก": "Please select a status before saving",
    "กลับเมนู": "Back to menu",
    "การตั้งค่า": "Settings",
    "จัดการการตั้งค่าระบบสำหรับผู้ดูแลระบบ": "Manage system settings for administrators",
    "ภาพรวมข้อมูล": "Data overview",
    "ข้อมูล Database": "Database data",
    "ตัวเลือก Dropdown": "Dropdown options",
    "กิจกรรมผู้ใช้": "User activity",
    "ข้อมูลที่ถูกลบ": "Deleted data",
    "เมนูตั้งค่า": "Settings menu",
    "ข้อมูลในระบบ": "System data",
    "ข้อมูลที่ระบบเก็บอยู่ใน Browser Database": "Data stored in the browser database",
    "ชุดข้อมูล": "Collection",
    "จำนวน": "Count",
    "อัปเดตล่าสุด": "Last updated",
    "เพิ่มข้อมูลตัวเลือก": "Add dropdown option",
    "พิมพ์ข้อมูลที่ต้องการเพิ่ม": "Enter the option to add",
    "＋ เพิ่มข้อมูล": "+ Add option",
    "หลักสูตร": "Program",
    "สาขา": "Branch",
    "ยา": "Medicine",
    "ประวัติการเข้าใช้งานและการกระทำ": "Access and action history",
    "เวลา": "Time",
    "การกระทำ": "Action",
    "ผู้กระทำ": "Actor",
    "รายละเอียด": "Details",
    "ข้อมูลที่ถูกลบจากฝั่งผู้ใช้": "Data deleted by users",
    "เก็บเป็นประวัติสำหรับ Admin ตรวจสอบ": "Stored for admin review",
    "ประเภทข้อมูลที่ถูกลบ": "Deleted data type",
    "อื่น ๆ": "Other",
    "เวลาที่ลบ": "Deleted at",
    "เมนู": "Menu",
    "รายการ": "Item",
    "เหตุผล": "Reason",
    "ยังไม่มีข้อมูล": "No data yet",
    "ยังไม่มีประวัติการใช้งาน": "No activity history yet",
    "ยังไม่มีข้อมูลที่ถูกลบในประเภทนี้": "No deleted data in this category",
    "ลบ": "Delete",
    "แผงควบคุมผู้ดูแลระบบ": "ADMIN PANEL",
    "ฐานข้อมูล": "Database",
    "คีย์จัดเก็บข้อมูล": "Storage key",
    "ตัวเลือก Dropdown": "Dropdown options",
    "กิจกรรมผู้ใช้": "User Activity",
    "ข้อมูลที่ถูกลบ": "Deleted Data",
    "สมัครบัญชี / Google / ลืมรหัสผ่าน": "Create account / Google / Forgot password",
    "คลังยา": "Stock",
    "แคตตาล็อก": "Catalog",
    "การเข้าห้องพยาบาล": "Infirmary Visit",
    "การยืมและคืน": "Borrow & Return",
    "ตารางเข้าเวร": "Duty Shift",
    "ฟอร์มการเข้าใช้ห้องพยาบาล": "Infirmary visit form",
    "บุคลากรภายใน": "Internal visitor",
    "บุคลากรภายนอก": "External visitor",
    "เลือกประเภทบุคลากรก่อน": "Select staff type first",
    "ระบุอาการ": "Describe symptoms",
    "ผลการวัดความดัน": "Vital signs",
    "เลือกยา": "Select medicine",
    "จำนวนยา /หน่วย": "Medicine quantity",
    "รอดูอาการ": "Observation",
    "ส่งโรงพยาบาล": "Hospital referral",
    "ตะกร้าสินค้า": "Shopping cart",
    "ยังไม่มีรายการยา": "No medicines in inventory",
    "ยังไม่มีรายการสินค้าในแคตตาล็อก": "No products in the catalog",
    "ยังไม่มีรายการสินค้า": "No products in the catalog",
    "ยังไม่มีข้อมูล": "No data yet",
  };
  const reverseCopy = Object.fromEntries(Object.entries(copy).map(([thai, english]) => [english, thai]));
  const languageStorageKey = "fms-language";
  let savedLanguage = "";
  try { savedLanguage = localStorage.getItem(languageStorageKey) || ""; } catch (_) {}
  let pageIsEnglish = savedLanguage === "en" || (!savedLanguage && document.documentElement.lang === "en");
  let translating = false;

  const translatePage = (isEnglish) => {
    if (translating) return;
    translating = true;
    pageIsEnglish = isEnglish;
    const table = isEnglish ? copy : reverseCopy;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.parentElement?.closest("script,style,textarea")) return;
      const value = node.nodeValue;
      const trimmed = value.trim();
      if (!trimmed || !Object.prototype.hasOwnProperty.call(table, trimmed)) return;
      node.nodeValue = value.replace(trimmed, table[trimmed]);
    });
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((element) => {
      ["placeholder", "aria-label", "title"].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value && Object.prototype.hasOwnProperty.call(table, value)) element.setAttribute(attribute, table[value]);
      });
    });
    translating = false;
  };

  const style = document.createElement("style");
  style.textContent = `
    .topbar .actions,
    .topbar .top-actions,
    .topbar .topbar-actions,
    .topbar .page-tools {
      display: flex !important;
      flex: 0 0 auto !important;
      align-items: center !important;
      gap: 8px !important;
      min-width: max-content !important;
    }
    ${languageSelector} {
      display: inline-flex !important;
      flex: 0 0 80px !important;
      width: 80px !important;
      min-width: 80px !important;
      max-width: 80px !important;
      height: 34px !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0 !important;
      padding: 0 8px !important;
      border: 0 !important;
      border-radius: 8px !important;
      background: #fff !important;
      color: #214967 !important;
      box-shadow: none !important;
      font: 700 12px/1 Kanit, Arial, sans-serif !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      overflow: visible !important;
    }
    ${languageSelector} > svg {
      display: none !important;
      width: 16px !important;
      height: 16px !important;
      flex: 0 0 16px !important;
      fill: none !important;
      stroke: #08aeb8 !important;
      stroke-width: 1.8 !important;
    }
    .topbar fieldset.language-switcher::before { content: none !important; display: none !important; }
    .topbar fieldset.language-switcher > svg {
      display: block !important;
      width: 16px !important;
      height: 16px !important;
      flex: 0 0 16px !important;
      fill: none !important;
      stroke: #08aeb8 !important;
      stroke-width: 1.8 !important;
    }
    ${languageSelector} > i { display: none !important; }
    ${languageSelector} > span {
      display: inline-block !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      white-space: nowrap !important;
      overflow: visible !important;
      line-height: 1 !important;
    }
    .topbar fieldset.language-switcher > label { display: none !important; }
    .topbar fieldset.language-switcher > label:has(input:checked) {
      display: inline-flex !important;
      align-items: center !important;
      margin: 0 !important;
      color: #214967 !important;
      font: inherit !important;
    }
    .topbar fieldset.language-switcher input { display: none !important; }
  `;
  document.head.append(style);

  const ensureLanguageButton = (button) => {
    button.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });

    button.querySelectorAll("svg").forEach((icon) => icon.remove());

    let label = button.querySelector("span");
    if (!label) {
      label = document.createElement("span");
      button.append(label);
    }

    button.dataset.languageShared = "true";
  };
  const updateLanguageButton = (button, isEnglish) => {
    ensureLanguageButton(button);
    const label = button.querySelector("span");

    document.documentElement.lang = isEnglish ? "en" : "th";
    try { localStorage.setItem(languageStorageKey, isEnglish ? "en" : "th"); } catch (_) {}

    if (label) {
      label.textContent = isEnglish ? "English" : "ไทย";
    }

    translatePage(isEnglish);

    button.setAttribute(
      "aria-label",
      isEnglish ? "Switch to Thai" : "เปลี่ยนภาษา",
    );
  };

  document.querySelectorAll(languageSelector).forEach(ensureLanguageButton);

  const translationObserver = new MutationObserver(() => {
    if (pageIsEnglish) translatePage(true);
  });
  translationObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest?.(languageSelector);
    if (!button) return;
    button.classList.remove("language-pop");
    void button.offsetWidth;
    button.classList.add("language-pop");
    window.setTimeout(() => button.classList.remove("language-pop"), 360);
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(languageSelector);
    if (!button) return;

    button.classList.remove("language-pop");
    void button.offsetWidth;
    button.classList.add("language-pop");
    window.setTimeout(() => button.classList.remove("language-pop"), 320);

    // Existing page handlers get the first chance to translate their content.
    // The shared fallback only runs when a page has no language handler.
    event.__fmsLanguageBefore = {
      lang: document.documentElement.lang,
      label: button.querySelector("span")?.textContent,
    };
    window.setTimeout(() => {
      const isEnglish = document.documentElement.lang === "en";
      pageIsEnglish = isEnglish;
      translatePage(isEnglish);
      ensureLanguageButton(button);
      const label = button.querySelector("span");
      if (label) label.textContent = isEnglish ? "English" : "ไทย";
      button.setAttribute("aria-label", isEnglish ? "Switch to Thai" : "เปลี่ยนภาษา");
      try { localStorage.setItem(languageStorageKey, isEnglish ? "en" : "th"); } catch (_) {}
    }, 0);
  }, true);

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(languageSelector);
    const before = event.__fmsLanguageBefore;
    if (!button || !before) return;

    const labelChanged = button.querySelector("span")?.textContent !== before.label;
    if (document.documentElement.lang !== before.lang || labelChanged) return;

    event.preventDefault();
    updateLanguageButton(button, document.documentElement.lang !== "en");
  });

  // Apply the language chosen on another FMS page after that page's own
  // renderer has initialized. This keeps page-specific translations working
  // while preventing navigation from silently resetting to Thai.
  if (savedLanguage && savedLanguage !== (document.documentElement.lang === "en" ? "en" : "th")) {
    window.setTimeout(() => document.querySelector(languageSelector)?.click(), 0);
  }
})();
