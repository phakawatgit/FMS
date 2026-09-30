const facultySelect = document.getElementById("facultySelect");
const facultyBranchSelect = document.getElementById("branchSelect");

const facultyBranches = {
  all: [
    "วิศวกรรมไฟฟ้า แขนงไฟฟ้ากำลัง",
    "วิศวกรรมไฟฟ้า แขนงอิเล็กทรอนิกส์และไฟฟ้าสื่อสาร",
    "วิศวกรรมหุ่นยนต์และอิเล็กทรอนิกส์อัจฉริยะ",
    "วิศวกรรมเครื่องกล",
    "วิศวกรรมคอมพิวเตอร์",
    "วิศวกรรมอุตสาหการและการผลิต",
    "วิศวกรรมโยธา",
    "เทคโนโลยีการจัดการผลิตพืช / เทคโนโลยีการผลิตพืชด้วยศาสตร์พระราชา",
    "สัตวศาสตร์ แขนงการผลิตและธุรกิจปศุสัตว์",
    "สัตวศาสตร์ แขนงการผลิตและธุรกิจสัตว์เลี้ยง",
    "วิทยาศาสตร์การประมงและทรัพยากรทางน้ำ",
    "บริหารธุรกิจและการเป็นผู้ประกอบการ",
    "นวัตกรรมอาหารและการจัดการ"
  ],
  engineering: [
    "วิศวกรรมไฟฟ้า แขนงไฟฟ้ากำลัง",
    "วิศวกรรมไฟฟ้า แขนงอิเล็กทรอนิกส์และไฟฟ้าสื่อสาร",
    "วิศวกรรมหุ่นยนต์และอิเล็กทรอนิกส์อัจฉริยะ",
    "วิศวกรรมเครื่องกล",
    "วิศวกรรมคอมพิวเตอร์",
    "วิศวกรรมอุตสาหการและการผลิต",
    "วิศวกรรมโยธา"
  ],
  agriculture: [
    "เทคโนโลยีการจัดการผลิตพืช / เทคโนโลยีการผลิตพืชด้วยศาสตร์พระราชา",
    "สัตวศาสตร์ แขนงการผลิตและธุรกิจปศุสัตว์",
    "สัตวศาสตร์ แขนงการผลิตและธุรกิจสัตว์เลี้ยง",
    "วิทยาศาสตร์การประมงและทรัพยากรทางน้ำ"
  ],
  business: ["บริหารธุรกิจและการเป็นผู้ประกอบการ", "นวัตกรรมอาหารและการจัดการ"]
};

function renderBranchOptions() {
  const selected = facultyBranchSelect.value;
  const branches = facultyBranches[facultySelect.value] || facultyBranches.all;
  facultyBranchSelect.innerHTML = [
    '<option value="all">ทั้งหมด</option>',
    ...branches.map((branch) => '<option value="' + branch.replace(/"/g, "&quot;") + '">' + branch + "</option>")
  ].join("");
  facultyBranchSelect.value = selected === "all" || branches.includes(selected) ? selected : "all";
  if (!facultyBranchSelect.value) facultyBranchSelect.value = "all";
  rebuildCustomSelect(facultyBranchSelect);
}

function syncCustomSelect(select) {
  const wrapper = select.closest(".custom-select");
  if (!wrapper) return;
  const current = select.options[select.selectedIndex];
  wrapper.querySelector(".custom-select-value").textContent = current?.textContent || "";
  wrapper.classList.toggle("is-disabled", select.disabled);
  wrapper.querySelector(".custom-select-trigger").disabled = select.disabled;
  wrapper.querySelectorAll("[data-custom-value]").forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.customValue === select.value);
  });
}

function rebuildCustomSelect(select) {
  const wrapper = select.closest(".custom-select");
  if (!wrapper) return;
  wrapper.querySelector(".custom-select-menu").innerHTML = Array.from(select.options)
    .map((option) => '<button type="button" role="option" class="custom-select-option' + (option.value === select.value ? " is-selected" : "") + '" data-custom-value="' + option.value.replace(/"/g, "&quot;") + '">' + option.textContent + "</button>")
    .join("");
  syncCustomSelect(select);
}

function enhanceCustomSelect(select) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.hidden = true;
  wrapper.insertAdjacentHTML("beforeend", '<button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="custom-select-value"></span><svg class="custom-select-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="M5.75 7.5 10 11.75 14.25 7.5" /></svg></button><div class="custom-select-menu" role="listbox" hidden></div>');
  const trigger = wrapper.querySelector(".custom-select-trigger");
  trigger.addEventListener("click", () => {
    if (select.disabled) return;
    const open = wrapper.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(open));
    wrapper.querySelector(".custom-select-menu").hidden = !open;
  });
  wrapper.addEventListener("click", (event) => {
    const option = event.target.closest("[data-custom-value]");
    if (!option || select.disabled) return;
    select.value = option.dataset.customValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    wrapper.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    wrapper.querySelector(".custom-select-menu").hidden = true;
    syncCustomSelect(select);
  });
  rebuildCustomSelect(select);
}

function syncFacultyBranchAccess() {
  const isExternal = document.querySelector(".visitor-check:checked")?.closest(".visitor-option")?.dataset.type === "external";
  facultySelect.disabled = isExternal;
  facultyBranchSelect.disabled = isExternal;
  if (isExternal) {
    facultySelect.value = "all";
    renderBranchOptions();
  }
  syncCustomSelect(facultySelect);
  syncCustomSelect(facultyBranchSelect);
}

facultySelect.addEventListener("change", renderBranchOptions);
document.querySelectorAll(".visitor-option .visitor-check").forEach((input) => input.addEventListener("change", syncFacultyBranchAccess));
document.getElementById("visitForm")?.addEventListener("reset", () => {
  setTimeout(() => {
    facultySelect.disabled = false;
    facultyBranchSelect.disabled = false;
    facultySelect.value = "all";
    renderBranchOptions();
    syncCustomSelect(facultySelect);
    syncCustomSelect(facultyBranchSelect);
  }, 0);
});

[facultySelect, facultyBranchSelect, document.querySelector("[name=gender]"), document.querySelector("[name=blood]"), document.querySelector("[name=medicine]")].forEach((select) => {
  if (select) enhanceCustomSelect(select);
});
renderBranchOptions();
