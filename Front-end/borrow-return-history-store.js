(function(){
  const HISTORY_KEY="fms-history-borrow-return";
  const LIVE_KEY="fms-borrow-return-records";
  const CLEANUP_KEY="fms-borrow-return-old-data-cleared-v2";
  if(!localStorage.getItem(CLEANUP_KEY)){
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LIVE_KEY);
    localStorage.setItem(CLEANUP_KEY,"1");
  }
  const itemFields=["name","productName","code","productCode","quantity","count","unit","category","form","size","genericName","benefit","symptom","usage","warning","status","expiry"];
  function compactItem(item){const compact={};for(const key of itemFields)if(item?.[key]!==undefined&&item[key]!==null)compact[key]=item[key];return compact}
  function compactRecord(record){const keys=["id","item","fullName","borrower","kind","borrowerType","borrowTypes","date","borrowDate","due","dueDate","extendedDue","returnDueDate","expectedReturnDate","returnedDate","status","role","roles","department","branch","faculty","nickname","studentId","phone","telephone","contact","activity","reason","stockCommitted"];const copy={};for(const key of keys)if(record?.[key]!==undefined&&record[key]!==null)copy[key]=record[key];copy.items=(Array.isArray(record?.items)?record.items:[]).map(compactItem);copy.borrowedItems=(Array.isArray(record?.borrowedItems)?record.borrowedItems:Array.isArray(record?.items)?record.items:[]).map(compactItem);copy.returnHistory=(Array.isArray(record?.returnHistory)?record.returnHistory:[]).map(entry=>({date:entry.date,items:(Array.isArray(entry.items)?entry.items:[]).map(compactItem)}));return copy}
  function removeMockRecords(records){return records.filter((record)=>record?.item!=="คุณ เพ็ญพิชชา ภาญจนพาณิชย์ (แผนก)")}
  function readLive(){try{const records=JSON.parse(localStorage.getItem(LIVE_KEY)||"[]");return Array.isArray(records)?removeMockRecords(records):[]}catch{return[]}}
  function read(){try{const history=JSON.parse(localStorage.getItem(HISTORY_KEY)||"null");if(Array.isArray(history)){const clean=removeMockRecords(history);if(clean.length!==history.length)save(clean);return clean}}catch{}const live=readLive();if(live.length)save(live);return live}
  function save(records){if(!Array.isArray(records))return false;try{localStorage.setItem(HISTORY_KEY,JSON.stringify(records.map(compactRecord)));return true}catch(error){console.error("Could not save History Borrow and Return snapshot",error);return false}}
  window.FMSBorrowHistoryStore={key:HISTORY_KEY,read,save};
})();
