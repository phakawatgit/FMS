(() => {
  const page = document.querySelector(".borrow-page");
  const oldBorrowTab = document.getElementById("borrowTab");
  const oldReturnTab = document.getElementById("returnTab");
  const borrowTab = oldBorrowTab.cloneNode(true);
  const returnTab = oldReturnTab.cloneNode(true);
  oldBorrowTab.replaceWith(borrowTab);
  oldReturnTab.replaceWith(returnTab);
  const calendar = document.getElementById("borrowCalendarSection");
  const listTitle = document.getElementById("borrowListTitle");
  const search = document.getElementById("borrowSearch");

  function showBorrowList() {
    page.classList.add("is-borrow-view");
    borrowTab.classList.add("active");
    returnTab.classList.remove("active");
    calendar.hidden = true;
    listTitle.textContent = "การยืมยา และเวชภัณฑ์";
    search.placeholder = "ค้นหาชื่อผู้ยืม หรือวันที่";
  }

  function showReturnCalendar() {
    page.classList.remove("is-borrow-view");
    returnTab.classList.add("active");
    borrowTab.classList.remove("active");
    calendar.hidden = false;
    listTitle.textContent = "รายการคืนยา และเวชภัณฑ์";
    search.placeholder = "ค้นหาชื่อผู้ยืม หรือวันที่";
  }

  borrowTab.addEventListener("click", showBorrowList);
  returnTab.addEventListener("click", showReturnCalendar);
  showReturnCalendar();
})();
