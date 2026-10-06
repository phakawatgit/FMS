document.getElementById("assessmentList").addEventListener("click", (event) => {
  if (event.target.closest(".status,.hospital-entry")) return;
  const card = event.target.closest(".assessment-card");
  if (card) window.location.assign(`./assessment-detail.html?id=${encodeURIComponent(card.dataset.id)}`);
});
