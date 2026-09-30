(async function () {
const records=await MedicineAPI.list();
const cart=JSON.parse(window.FMSData.getItem("fms-catalog-cart")||"{}");
const historyOrdersKey="fms-history-catalog-orders";
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const orderTitle=document.getElementById("orderTitle"); orderTitle.value=(window.FMSData.getItem("fms-order-title")||"").replace(/^เอกสารการสั่งซื้อ:?\s*/,""); orderTitle.addEventListener("input",()=>localStorage.setItem("fms-order-title",orderTitle.value)); const items=Object.keys(cart).map(code=>{const record=records.find(row=>String(row.code)===String(code))||{code,name:code};return{...record,...cart[code],quantity:Number(cart[code].quantity)||0}}).filter(item=>item.quantity>0);
document.getElementById("orderDate").textContent=new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"short"}).format(new Date());
document.getElementById("orderCount").textContent=items.length;
document.getElementById("orderList").innerHTML=items.length?items.map(item=>`<article class="order-item">${item.image?`<img src="${item.image}" alt="${esc(item.name||item.productName)}">`:`<div class="order-empty-image">รูปภาพสินค้า</div>`}<div><strong>${esc(item.name||item.productName||"รายการยา")}</strong><small>รหัสยา: ${esc(item.code)}</small><div class="order-meta"><span class="order-option">${esc(item.unit||item.option||"ไม่ระบุหน่วย")}</span><span>จำนวน <b class="order-quantity">x${item.quantity}</b></span></div></div></article>`).join(""):"<p>ยังไม่มีสินค้าในตะกร้า</p>";
const exportModal=document.getElementById("exportModal");
document.getElementById("backToCart").addEventListener("click",()=>location.href="./catalog-cart.html");
let historyOrderRecorded=false;
const saveHistoryButton=document.getElementById("saveOrderToHistory")||{textContent:"",disabled:false,title:"",setAttribute(){},addEventListener(){}};
const historyItemFields=["code","name","productName","genericName","category","form","size","unit","benefit","symptom","usage","warning","status","expiry","option","quantity"];
function compactHistoryItem(item){return Object.fromEntries(historyItemFields.filter(key=>item[key]!==undefined&&item[key]!==null).map(key=>[key,item[key]]))}
let orderRequest = null, saving = null;
const orderSaveError=document.createElement('p');orderSaveError.setAttribute('role','alert');orderSaveError.id='orderSaveError';document.querySelector('.order-page').append(orderSaveError);
async function saveHistoryOrder(){
  if(historyOrderRecorded)return true;
  if(!items.length){orderSaveError.textContent='ไม่มีรายการสินค้าให้บันทึก';return false;}
  if(saving)return saving;
  if(!orderRequest)orderRequest={id:'catalog-'+Date.now()+'-'+Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-'),documentTitle:orderTitle.value.trim(),items:items.map(compactHistoryItem)};
  saveHistoryButton.disabled=true;
  document.getElementById('submitOrder').disabled=true;orderSaveError.textContent='';orderTitle.readOnly=true;
  saving=(async()=>{try{
    await FMSData.request('catalog-orders','',{method:'POST',body:JSON.stringify(orderRequest)});
    historyOrderRecorded=true;saveHistoryButton.textContent='บันทึกแล้ว';return true;
  }catch(error){orderSaveError.textContent=error.message+' — กดสั่งสินค้าอีกครั้งเพื่อลองใหม่';saveHistoryButton.textContent='บันทึกไม่สำเร็จ — ลองใหม่';saveHistoryButton.title=error.message;saveHistoryButton.disabled=false;return false;}finally{saving=null;document.getElementById('submitOrder').disabled=false;}})();
  return saving;
}
saveHistoryButton.addEventListener('click',()=>saveHistoryOrder());
document.getElementById('submitOrder').addEventListener('click',async()=>{if(await saveHistoryOrder())exportModal.hidden=false;});
exportModal.addEventListener('click',event=>{if(event.target===exportModal)exportModal.hidden=true;});

document.getElementById("exportPdf").addEventListener("click",()=>{exportModal.hidden=true;window.print()});
const imageAsDataUrl=async source=>{if(!source)return"";try{const response=await fetch(source);const blob=await response.blob();return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>resolve("");reader.readAsDataURL(blob)})}catch{return""}};
document.getElementById("exportExcel").addEventListener("click",async()=>{const button=document.getElementById("exportExcel");button.disabled=true;button.textContent="กำลังสร้างไฟล์...";const rows=await Promise.all(items.map(async item=>({item,image:await imageAsDataUrl(item.image)})));const body=rows.map(({item,image})=>`<tr style="height:110px;mso-height-source:userset"><td style="width:110px;height:110px;vertical-align:middle;text-align:center"><div style="width:100px;height:100px;overflow:hidden"><img src="${image}" width="96" height="96" style="display:block;width:96px;height:96px;object-fit:contain"></div></td><td>${esc(item.name||item.productName||"รายการยา")}</td><td>${esc(item.code)}</td><td>${esc(item.unit||item.option||"ไม่ระบุหน่วย")}</td><td>${item.quantity}</td></tr>`).join("");const html=`<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;table-layout:fixed;width:760px}th,td{border:1px solid #999;padding:8px;text-align:left}th{background:#dce8ff}td:first-child{width:110px;text-align:center;vertical-align:middle}tr{height:110px}img{display:block}</style></head><body><h2>เอกสารการสั่งซื้อ: ${esc(orderTitle.value||"เอกสารการสั่งซื้อยา และเวชภัณฑ์")}</h2><table><thead><tr style="height:32px"><th style="width:110px">รูปสินค้า</th><th>สินค้า</th><th>รหัสยา</th><th>ตัวเลือก</th><th>จำนวน</th></tr></thead><tbody>${body}</tbody></table></body></html>`;const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="order-document.xls";link.click();URL.revokeObjectURL(url);button.disabled=false;button.textContent="Excel";exportModal.hidden=true});

})().catch(MedicineAPI.error);
