const borrowBranchSelect = document.querySelector('select[name="branch"]');
const borrowBranchLabel = borrowBranchSelect?.closest("label");

const borrowFacultyBranches = window.FMSReference.branches();

if (borrowBranchSelect && borrowBranchLabel) {
  const facultyLabel = document.createElement("label");
  facultyLabel.className = "borrow-faculty-field";
  facultyLabel.innerHTML = '<span>หลักสูตร</span><select name="faculty"><option value="all">ทั้งหมด</option><option value="engineering">หลักสูตรวิศวกรรมศาสตร์</option><option value="agriculture">หลักสูตรเทคโนโลยีการเกษตรและวิทยาศาสตร์</option><option value="business">หลักสูตรบริหารธุรกิจและนวัตกรรม</option></select>';
  borrowBranchLabel.parentElement.insertBefore(facultyLabel, borrowBranchLabel);
  const branchLabelText = borrowBranchLabel.querySelector("span");
  if (branchLabelText) branchLabelText.textContent = "สาขา";
  const borrowFacultySelect = facultyLabel.querySelector("select");
  window.FMSReference.fill(borrowFacultySelect);

  function renderBorrowBranches() {
    const branches = borrowFacultyBranches[borrowFacultySelect.value] || borrowFacultyBranches.all;
    const selected = borrowBranchSelect.value;
    borrowBranchSelect.innerHTML = ['<option value="all">ทั้งหมด</option>', ...branches.map((branch) => '<option value="' + branch.replace(/"/g, "&quot;") + '">' + branch + "</option>")].join("");
    borrowBranchSelect.value = selected === "all" || branches.includes(selected) ? selected : "all";
  }

  borrowFacultySelect.addEventListener("change", renderBorrowBranches);
  renderBorrowBranches();
}
