/* Build notifications from the shared frontend records instead of demo data. */
(() => {
  const read = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  const parseDate = (value) => {
    if (!value) return null;
    const text = String(value).trim();
    const thaiDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (thaiDate) {
      let year = Number(thaiDate[3]);
      if (year > 2400) year -= 543;
      const date = new Date(year, Number(thaiDate[2]) - 1, Number(thaiDate[1]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const dateOnly = (value) => { const date = parseDate(value); return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null; };
  const daysFromToday = (value) => { const date = dateOnly(value), today = dateOnly(new Date()); return date ? Math.round((date - today) / 86400000) : null; };
  const dateLabel = (value, language) => { const date = parseDate(value); return date ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(date) : "-"; };

  function stockNotifications(language) {
    const notifications = [];
    read("fms-stock-records").forEach((record) => {
      const name = record.name || record.productName || record.genericName || (language === "th" ? "รายการยา" : "Medicine");
      const remaining = Math.max(0, Number(record.remaining ?? (Number(record.total || 0) - Number(record.used || 0))) || 0);
      const expiryDays = daysFromToday(record.expiry || record.expiryDate);
      if (expiryDays !== null && expiryDays < 0) notifications.push({ level: "critical", title: language === "th" ? "ยาหมดอายุแล้ว" : "Expired medicine", detail: language === "th" ? `${name} หมดอายุแล้ว กรุณานำออกจากคลัง` : `${name} has expired. Remove it from stock.` });
      else if (expiryDays !== null && expiryDays <= 30) notifications.push({ level: "warning", title: language === "th" ? "ยาใกล้หมดอายุ" : "Medicine expiring soon", detail: language === "th" ? `${name} จะหมดอายุวันที่ ${dateLabel(record.expiry || record.expiryDate, language)}` : `${name} expires on ${dateLabel(record.expiry || record.expiryDate, language)}` });
      if (remaining <= 0) notifications.push({ level: "critical", title: language === "th" ? "ยาหมดสต็อก" : "Out of stock", detail: language === "th" ? `${name} ไม่มีคงเหลือ กรุณาเติมสต็อก` : `${name} has no stock remaining.` });
      else if (remaining < 10) notifications.push({ level: "warning", title: language === "th" ? "ยาใกล้หมดสต็อก" : "Low medicine stock", detail: language === "th" ? `${name} เหลือ ${remaining} ${record.unit || "หน่วย"}` : `${name} has ${remaining} ${record.unit || "units"} left` });
    });
    return notifications;
  }

  function borrowNotifications(language) {
    const notifications = [];
    read("fms-borrow-return-records").forEach((record) => {
      const status = String(record.status || "borrowed").toLowerCase();
      const returned = status === "returned" || Boolean(record.returnedDate) || (Array.isArray(record.items) && record.items.length === 0);
      if (returned) return;
      const due = record.extendedDue || record.extensionDate || record.dueDate || record.returnDueDate || record.expectedReturnDate || record.due;
      const days = daysFromToday(due);
      const name = record.item || record.fullName || record.borrower || (language === "th" ? "รายการยืมยา" : "Borrowed item");
      if (status === "overdue" || (days !== null && days < 0)) notifications.push({ level: "critical", title: language === "th" ? "รายการยืมยาเกินกำหนด" : "Overdue borrowed item", detail: language === "th" ? `${name} เกินกำหนดคืนแล้ว` : `${name} is overdue.` });
      else if (days !== null && days <= 7) notifications.push({ level: "warning", title: language === "th" ? "รายการยืมยาใกล้ครบกำหนด" : "Borrowed item due soon", detail: language === "th" ? `${name} ครบกำหนดคืนวันที่ ${dateLabel(due, language)}` : `${name} is due on ${dateLabel(due, language)}` });
    });
    return notifications;
  }

  window.FMSNotifications = { getAll(language = "th") { return [...stockNotifications(language), ...borrowNotifications(language)]; } };
})();
