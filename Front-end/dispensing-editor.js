(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.DispensingEditor = async function (container, existing = []) {
    const medicines = await FMSData.request('medicines');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
    container.innerHTML = '<fieldset><legend>ยาที่จ่ายจากคลัง</legend><div data-drug-rows></div><button type="button" data-add-drug>เพิ่มรายการยา</button><p>จำนวนตามหน่วยในคลัง ไม่แปลงกล่อง/แผง/เม็ดอัตโนมัติ</p></fieldset>';
    const list = container.querySelector('[data-drug-rows]');
    const unavailableReason = (medicine, own = 0) => {
      if (!medicine.active) return 'เลิกใช้งานแล้ว';
      if (!medicine.unit) return 'ยังไม่ได้กำหนดหน่วยใน Stock';
      if (medicine.expiry && medicine.expiry < today) {
        const [year, month, day] = medicine.expiry.split('-');
        return `หมดอายุ ${day}/${month}/${year}`;
      }
      if (medicine.remaining + own <= 0) return 'สต็อกหมด';
      return '';
    };
    const unavailable = medicines.filter(m => m.active && unavailableReason(m));
    if (unavailable.length) {
      const notice = document.createElement('p');
      notice.setAttribute('role', 'status');
      notice.textContent = 'รายการที่จ่ายไม่ได้: ' + unavailable.map(m => `${m.name} (${m.code}) — ${unavailableReason(m)}`).join('; ') + ' ตรวจสอบข้อมูลได้ที่หน้า Stock';
      container.querySelector('fieldset').append(notice);
    }
    function add(saved = {}) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center';
      row.innerHTML = `<select aria-label="ยาที่จ่าย" required><option value="">เลือกยา</option>${medicines.filter(m => m.active || m.id === saved.medicineId).map(m => {
        const own = existing.find(i => i.medicineId === m.id)?.quantity || 0;
        const reason = unavailableReason(m, own);
        return `<option value="${esc(m.id)}" ${reason && m.id !== saved.medicineId ? 'disabled' : ''}>${esc(m.name)} · ${esc(m.code)} · เหลือ ${m.remaining} ${esc(m.unit || '(ยังไม่มีหน่วย)')}${reason ? ' — ' + esc(reason) : ''}</option>`;
      }).join('')}</select><input type="number" min="1" step="1" required aria-label="จำนวนยาที่จ่าย" style="width:110px"><span data-unit></span><button type="button" data-remove>นำออก</button>`;
      const select = row.querySelector('select'), input = row.querySelector('input');
      select.value = saved.medicineId || ''; input.value = saved.quantity || '';
      function sync() { const m = medicines.find(i => i.id === select.value); row.querySelector('[data-unit]').textContent = m?.unit || ''; if (m) input.max = m.remaining + (existing.find(i => i.medicineId === m.id)?.quantity || 0); else input.removeAttribute('max'); }
      select.onchange = sync; row.querySelector('[data-remove]').onclick = () => row.remove(); sync(); list.append(row);
    }
    existing.forEach(add); container.querySelector('[data-add-drug]').onclick = () => add();
    return { clear() { list.replaceChildren(); }, read() {
      const rows = [...list.children].map(row => ({ medicineId: row.querySelector('select').value, quantity: Number(row.querySelector('input').value) }));
      if (rows.some(r => !r.medicineId || !Number.isInteger(r.quantity) || r.quantity < 1) || new Set(rows.map(r => r.medicineId)).size !== rows.length) throw Error('เลือกยาไม่ซ้ำและระบุจำนวนเต็มบวก');
      return rows;
    } };
  };
})();
