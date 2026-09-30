const branchSelect = document.getElementById("branchSelect");

document.querySelectorAll(".visitor-option").forEach((option) => {
  option.querySelector(".visitor-check")?.addEventListener("change", () => {
    const selectedType = document.querySelector(".visitor-check:checked")?.closest(".visitor-option")?.dataset.type || "";
    const isExternal = selectedType === "external";
    branchSelect.disabled = isExternal;
    if (isExternal) branchSelect.value = "";
  });
});

document.getElementById("visitForm")?.addEventListener("reset", () => {
  setTimeout(() => {
    branchSelect.disabled = false;
    branchSelect.value = "";
  }, 0);
});
