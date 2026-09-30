const dateKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const shift = (key, days) => new Date(Date.parse(key + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
function filters(query, now = new Date()) {
  const end = query.end || dateKey(now), start = query.start || shift(end, -29);
  for (const key of [start, end]) if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key)) || shift(key, 0) !== key) throw Object.assign(Error('วันที่ไม่ถูกต้อง'), { status: 400 });
  if (start > end) throw Object.assign(Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'), { status: 400 });
  return { start, end, faculty: typeof query.faculty === 'string' ? query.faculty : 'all', branch: typeof query.branch === 'string' ? query.branch : 'all' };
}
function aggregate(visits, medicines, range, now = new Date()) {
  const today = dateKey(now), monthly = (Date.parse(range.end) - Date.parse(range.start)) / 86400000 >= 90;
  const buckets = new Map(), drugs = new Map(), symptoms = new Map(), hospitals = new Map();
  const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  let cursor = monthly ? range.start.slice(0, 7) + '-01' : range.start;
  while (cursor <= range.end) {
    buckets.set(monthly ? cursor.slice(0, 7) : cursor, 0);
    cursor = monthly ? new Date(Date.UTC(Number(cursor.slice(0, 4)), Number(cursor.slice(5, 7)), 1)).toISOString().slice(0, 10) : shift(cursor, 1);
  }
  const gender = { male: 0, female: 0, other: 0 }; let referrals = 0, missingHospital = 0;
  for (const visit of visits) {
    increment(buckets, dateKey(visit.createdAt).slice(0, monthly ? 7 : 10));
    increment(symptoms, visit.symptom.trim().replace(/\s+/g, ' ') || 'ไม่ระบุ');
    const sex = (visit.gender || '').toLowerCase();
    gender[['male', 'ชาย', 'm'].includes(sex) ? 'male' : ['female', 'หญิง', 'f'].includes(sex) ? 'female' : 'other']++;
    if (visit.status === 'refer') { referrals++; const name = visit.hospitalName?.trim(); name ? increment(hospitals, name) : missingHospital++; }
    const seen = new Set();
    for (const item of visit.dispensations) {
      const row = drugs.get(item.medicineId) || { medicineId: item.medicineId, name: item.medicine?.name || item.name, code: item.code, count: 0, quantities: {} };
      if (!seen.has(item.medicineId)) row.count++;
      seen.add(item.medicineId); row.quantities[item.unit] = (row.quantities[item.unit] || 0) + item.quantity; drugs.set(item.medicineId, row);
    }
  }
  const ranked = map => [...map].map(([name, count]) => ({ name, count })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name));
  const stock = medicines.map(item => {
    const remaining = item.total - item.used, lowStockThreshold = Math.max(1, Math.ceil(item.total * .2));
    const expiry = item.expiry ? item.expiry.toISOString().slice(0,10) : null;
    const daysLeft = expiry ? (Date.parse(expiry) - Date.parse(today)) / 86400000 : null;
    const status = daysLeft !== null && daysLeft < 0 ? 'expired' : daysLeft !== null && daysLeft <= 30 ? 'expiring' : remaining <= lowStockThreshold ? 'low' : 'normal';
    return { ...item, image:item.imageType?`/api/medicines/${item.id}/image`:null, expiry, remaining, lowStockThreshold, daysLeft, status };
  });
  return { totalVisits: visits.length, trend: [...buckets].map(([date,count]) => ({date,count})), trendInterval: monthly ? 'month' : 'day', gender,
    topMedicines: [...drugs.values()].sort((a,b)=>b.count-a.count || a.code.localeCompare(b.code)).slice(0,10), symptoms: ranked(symptoms),
    referrals: { count: referrals, hospitals: ranked(hospitals).slice(0,3), missingHospital }, stock };
}
module.exports = { dateKey, shift, filters, aggregate };
