const nativeFacultySelect = document.getElementById("facultySelect");
const nativeBranchSelect = document.getElementById("branchSelect");

const nativeFacultyBranches = {
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

function renderNativeBranches() {
  const selected = nativeBranchSelect.value;
  const branches = nativeFacultyBranches[nativeFacultySelect.value] || nativeFacultyBranches.all;
  nativeBranchSelect.innerHTML = [
    '<option value="all">ทั้งหมด</option>',
    ...branches.map((branch) => '<option value="' + branch.replace(/"/g, "&quot;") + '">' + branch + "</option>")
  ].join("");
  nativeBranchSelect.value = selected === "all" || branches.includes(selected) ? selected : "all";
}

function syncNativeFacultyBranchAccess() {
  const isExternal = document.querySelector(".visitor-check:checked")?.closest(".visitor-option")?.dataset.type === "external";
  nativeFacultySelect.disabled = isExternal;
  nativeBranchSelect.disabled = isExternal;
  if (isExternal) {
    nativeFacultySelect.value = "all";
    renderNativeBranches();
  }
}

nativeFacultySelect.addEventListener("change", renderNativeBranches);
document.querySelectorAll(".visitor-option .visitor-check").forEach((input) => input.addEventListener("change", syncNativeFacultyBranchAccess));
document.getElementById("visitForm")?.addEventListener("reset", () => {
  setTimeout(() => {
    nativeFacultySelect.disabled = false;
    nativeBranchSelect.disabled = false;
    nativeFacultySelect.value = "all";
    renderNativeBranches();
  }, 0);
});

renderNativeBranches();
