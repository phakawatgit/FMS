const nativeFacultySelect = document.getElementById("facultySelect");
const nativeBranchSelect = document.getElementById("branchSelect");

window.FMSReference.fill(nativeFacultySelect);
const nativeFacultyBranches = window.FMSReference.branches();

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
