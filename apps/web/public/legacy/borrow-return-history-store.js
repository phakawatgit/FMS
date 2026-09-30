// Operational history comes from the loans API. Legacy server records are read-only.
window.FMSBorrowHistoryStore = { read: () => JSON.parse(FMSData.getItem('fms-borrow-return-records')), save: () => { throw Error('บันทึกประวัติผ่าน API เท่านั้น'); } };
