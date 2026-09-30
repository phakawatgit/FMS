if(record&&record.status==="observe"){const fields=[["firstName","ชื่อ","wide"],["lastName","นามสกุล","wide"],["nickname","ชื่อเล่น"],["age","อายุ"],["studentId","รหัสนักศึกษา"],["branch","สาขา"],["gender","เพศ"],["blood","กรุ๊ปเลือด"],["weight","น้ำหนัก (กก.)"],["height","ส่วนสูง (ซม.)"],["symptom","อาการ","wide","textarea"],["medicine","ยาที่ได้รับ","half"],["quantity","จำนวนยา / หน่วย","half"]],button=document.createElement("button");button.className="edit-button";button.type="button";button.textContent="แก้ไขข้อมูล";target.append(button);button.addEventListener("click",async ()=>{if(target.querySelector(".edit-panel"))return;const panel=document.createElement("form");panel.className="edit-panel";const visitorType=record.visitorType==="บุคคลภายนอก"?"external":"internal";panel.innerHTML=`<h3>แก้ไขข้อมูลผู้รับบริการ</h3><div class="visitor-summary"><label><input type="radio" name="visitorType" value="internal" ${visitorType==="internal"?"checked":""}/> บุคคลภายใน</label><label><input type="radio" name="visitorType" value="external" ${visitorType==="external"?"checked":""}/> บุคคลภายนอก</label></div><div class="edit-grid">${fields.map(([key,label,span,type])=>`<label class="${span||""}">${label}${type==="textarea"?`<textarea name="${key}">${escapeHtml(record[key]??"")}</textarea>`:`<input name="${key}" value="${escapeHtml(record[key]??"")}" />`}</label>`).join("")}<div class="vitals-edit"><strong>ผลการวัดความดัน</strong><label>SYS<input name="sys" value="${escapeHtml(record.sys??"")}" /></label><label>DIA<input name="dia" value="${escapeHtml(record.dia??"")}" /></label><label>PR<input name="pr" value="${escapeHtml(record.pr??"")}" /></label></div><div class="status-readonly">สถานะ: รอดูอาการ</div></div><div class="edit-actions"><button type="button">ยกเลิก</button><button type="submit">บันทึกการแก้ไข</button></div>`;button.after(panel);
const drugArea=document.createElement('div');drugArea.className='wide';
panel.querySelector('[name="medicine"]').closest('label').replaceWith(drugArea);
panel.querySelector('[name="quantity"]').closest('label').remove();
let drugEditor;
const drugReady = DispensingEditor(drugArea, record.dispensations || []).then(editor=>drugEditor=editor);
drugReady.catch(error=>{drugArea.textContent=error.message});
panel.querySelector("button[type=button]").addEventListener("click",()=>panel.remove());panel.addEventListener("submit",async event=>{
 event.preventDefault();
 if(panel.dataset.saving === "true")return;
 const updates=Object.fromEntries(new FormData(panel));
 const errorMessage=panel.querySelector("[role=alert]")||document.createElement("p");
 errorMessage.setAttribute("role","alert");panel.append(errorMessage);
 if(!updates.status){errorMessage.textContent="กรุณาเลือกสถานะ";return;}
 panel.dataset.saving="true";
 const controls=[...panel.querySelectorAll("button,input,textarea,select")];controls.forEach(control=>control.disabled=true);
 errorMessage.textContent="กำลังบันทึก…";
 try{
  await drugReady;
  const payload={...record,...updates,visitorType:updates.visitorType==="external"?"บุคคลภายนอก":"บุคคลภายใน"};
  payload.dispensations=drugEditor.read();delete payload.medicine;delete payload.quantity;
  payload.visitorDetail=updates.visitorDetailExternal??updates.visitorDetail??record.visitorDetail;
  delete payload.visitorDetailExternal;
  if(payload.status!=="refer")payload.hospitalName=null;
  await window.infirmaryApi(`/${encodeURIComponent(record.id)}`,{method:"PATCH",body:JSON.stringify(payload)});
  if(payload.status==="observe")location.reload();else location.href="./infirmary-visit-history.html";
 }catch(error){errorMessage.textContent=error.message;panel.dataset.saving="false";controls.forEach(control=>control.disabled=false);}
})})}
