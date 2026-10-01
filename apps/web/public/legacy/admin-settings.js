(() => {
  if (window.FMSAuth.user?.role !== 'ADMIN') { location.replace('./menu.html'); return; }
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let settings, logs = [], users = [], category = 'all';
  const message = document.createElement('p'); message.setAttribute('role','status'); $('.settings-hero').append(message);
  const form = $('#optionForm');
  const code = document.createElement('input'); code.name = 'code'; code.placeholder = '???????????? ???? engineering'; code.maxLength = 32;
  const faculty = document.createElement('select'); faculty.name = 'facultyId'; faculty.setAttribute('aria-label','???????????????');
  form.insertBefore(code, form.lastElementChild); form.insertBefore(faculty, form.lastElementChild);
  $('#databasePanel .panel-note').textContent = '????????? PostgreSQL';
  $('#deletedPanel').insertAdjacentHTML('beforeend','<div class="table-wrap"><table><tbody id="deletedRows"></tbody></table></div>');
  $('#databasePanel').insertAdjacentHTML('beforeend','<h2>??????????????</h2><div class="table-wrap"><table><tbody id="userRows"></tbody></table></div>');
  const more = document.createElement('button'); more.type='button'; more.textContent='????????????????'; $('#activityPanel').append(more);
  const sections = [['fms-stock-records','Medicine'],['fms-infirmary-visits','InfirmaryVisit'],['fms-borrow-return-records','Loan'],['fms-history-catalog-orders','CatalogOrder'],['fms-local-duty-records','DutyShift']];
  async function run(work) { message.textContent='????????????'; try { await work(); await load(); message.textContent='??????????'; } catch(e) { message.textContent=e.message; } }
  function choose(type) {
    $('#optionTypeValue').value=type; code.hidden=type!=='faculties'; code.required=type==='faculties'; faculty.hidden=type!=='branches'; faculty.required=type==='branches';
    if(type==='medicines') location.href='./stock-add.html';
  }
  function render() {
    const faculties=settings.faculties;
    faculty.replaceChildren(new Option('?????????????',''),...faculties.filter(f=>f.active).map(f=>new Option(f.name,f.id)));
    const lists={faculties,branches:faculties.flatMap(f=>f.branches.map(b=>({...b,label:f.name+' / '+b.name}))),medicines:JSON.parse(FMSData.getItem('fms-stock-records'))};
    for(const [kind,rows] of Object.entries(lists)) $('[data-options-list="'+kind+'"]').innerHTML=rows.map(r=>`<li><span>${esc(r.label||r.name)}${r.active===false?' (??????????)':''}</span>${kind==='medicines'?`<a href="./stock-add.html?edit=${encodeURIComponent(r.id)}">?????</a>`:`<button type="button" data-toggle-kind="${kind}" data-id="${esc(r.id)}" data-active="${!r.active}">${r.active?'???????':'???????'}</button>`}</li>`).join('');
    let count=0;
    $('#databaseRows').innerHTML=sections.map(([key,label])=>{const rows=JSON.parse(FMSData.getItem(key));count+=rows.length;return `<tr><td>${label}</td><td>${label}</td><td>${rows.length}</td><td>${esc(rows[0]?.updatedAt||rows[0]?.createdAt||'-')}</td></tr>`}).join('');
    $('#summaryCollections').textContent=count;
    $('#summaryRecords').textContent=faculties.length+lists.branches.length;
    $('#summaryActivities').textContent=logs.length;
    const deleted=logs.filter(l=>['delete','deactivate'].includes(l.action));
    $('#summaryDeleted').textContent=deleted.length;
    const row=l=>`<tr><td>${esc(new Date(l.createdAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}))}</td><td>${esc(l.action+' '+l.entity)}</td><td>${esc(users.find(u=>u.id===l.actorId)?.email||l.actorId||'system')}</td><td>${esc(l.entityId||'')}</td></tr>`;
    $('#activityRows').innerHTML=logs.map(row).join('');
    const groups={stock:['medicines'],catalog:['CatalogOrder'],infirmary:['infirmary-visits'],borrow:['loans'],duty:['DutyShift']};
    $('#deletedRows').innerHTML=deleted.filter(l=>category==='all'||(groups[category]||[]).includes(l.entity)||category==='other'&&!Object.values(groups).flat().includes(l.entity)).map(row).join('');
    $('#userRows').innerHTML=users.map(u=>`<tr data-user="${esc(u.id)}"><td>${esc(u.email)}</td><td><select aria-label="??????"><option ${u.role==='NURSE'?'selected':''}>NURSE</option><option ${u.role==='ADMIN'?'selected':''}>ADMIN</option></select></td><td><label><input type="checkbox" ${u.active?'checked':''}>??????????</label></td><td><button type="button" data-save-user>??????</button></td></tr>`).join('');
  }
  async function load() {
    await FMSData.hydrate();
    [settings,users,logs]=await Promise.all([FMSAuth.request('settings'),FMSAuth.request('admin/users'),FMSAuth.request('admin/audit?limit=100')]); render(); more.disabled=logs.length<100;
  }
  form.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(form);run(async()=>{await FMSAuth.request('settings/'+data.get('type'),{method:'POST',body:JSON.stringify({name:data.get('value'),code:data.get('code'),facultyId:data.get('facultyId')})});form.querySelector('[name=value]').value='';});});
  $('#optionsGrid').onclick=event=>{const b=event.target.closest('[data-toggle-kind]');if(b)run(()=>FMSAuth.request(`settings/${b.dataset.toggleKind}/${b.dataset.id}`,{method:'PATCH',body:JSON.stringify({active:b.dataset.active==='true'})}));};
  $('#userRows').onclick=event=>{const b=event.target.closest('[data-save-user]');if(!b)return;const tr=b.closest('tr');run(()=>FMSAuth.request('admin/users/'+tr.dataset.user,{method:'PATCH',body:JSON.stringify({role:tr.querySelector('select').value,active:tr.querySelector('input').checked})}));};
  $('#optionTypeButton').onclick=()=>{$('#optionTypeSelect .admin-select-menu').hidden=!$('#optionTypeSelect .admin-select-menu').hidden;};
  document.querySelectorAll('[data-option-type]').forEach(b=>b.onclick=()=>{choose(b.dataset.optionType);$('#optionTypeLabel').textContent=b.textContent;$('#optionTypeSelect .admin-select-menu').hidden=true;});
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.admin-panel').forEach(p=>p.hidden=p.id!==b.dataset.panel);document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('is-active',x===b));});
  document.querySelectorAll('[data-deleted-category]').forEach(b=>b.onclick=()=>{category=b.dataset.deletedCategory;render();});
  more.onclick=async()=>{try{const next=await FMSAuth.request('admin/audit?limit=100&cursor='+encodeURIComponent(logs.at(-1).id));logs.push(...next);render();more.disabled=next.length<100;}catch(e){message.textContent=e.message;}};
  $('#backMenuButton').onclick=()=>location.href='./menu.html';
  choose('faculties');load().catch(e=>message.textContent=e.message);
})();
