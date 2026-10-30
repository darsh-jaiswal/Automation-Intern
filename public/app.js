const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('operator-token') || '';
let state = null;
function el(tag, text, className) { const n = document.createElement(tag); if(text !== undefined) n.textContent = text; if(className) n.className = className; return n; }
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
async function api(path, data) {
  const res = await fetch(path, { method: data ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await res.json(); if(!res.ok) throw Error(result.error || `HTTP ${res.status}`); return result;
}
async function refresh() {
  const health = await (await fetch('/health')).json();
  $('configuration').replaceChildren(...Object.entries(health.configured).map(([name, ok]) => el('span', `${name.replace('_',' ')}: ${ok ? 'configured' : 'not configured'}`, ok ? '' : 'missing')));
  if(!token) return;
  try { state = await api('/api/state'); $('connection').hidden = true; $('workspace').hidden = false; render(); }
  catch(e) { message(e.message, true); }
}
function render() {
  const s = state.summary;
  const metrics = [['Original sessions', state.sessions.length], ['People', state.contacts.length], ['Hot leads', s.hot], ['Validated drafts', s.drafts], ['Review / errors', s.review + s.errors]];
  $('metrics').replaceChildren(...metrics.map(([label,value]) => { const n=el('div',undefined,'metric'); n.append(el('strong',value), el('span',label)); return n; }));
  const filter = $('filter').value;
  const contacts = state.contacts.filter(c => { const a=state.assessments.find(a=>a.contact_id===c.id); return filter==='all' || filter==='review' && a && (a.status==='needs_review'||a.status.includes('error')||a.crm_status==='error') || a?.tier===filter; });
  $('row-count').textContent = `${contacts.length} contacts shown`;
  $('leads').replaceChildren(...contacts.map(c => {
    const a = state.assessments.find(a => a.contact_id === c.id); const tr=el('tr');
    const person=el('td');person.append(el('strong',`${c.first_name} ${c.last_name}`),el('small',c.company||c.designation||'No company provided'));
    const fit=el('td');fit.append(el('strong',a?`${a.score}/10`:'Pending'),el('small',a?.service?.replaceAll('_',' ')||'Not assessed'));
    const route=el('td');route.append(el('span',a?.tier?.replaceAll('_',' ')||'pending',`pill ${a?.tier||''}`));if(a?.status==='needs_review'||a?.status?.includes('error')) route.append(el('div',a.status.replaceAll('_',' '),'pill review'));
    const button=el('button','Open','secondary inspect');button.addEventListener('click',()=>detail(c.id));const action=el('td');action.append(button);
    tr.append(person,el('td',state.sessions.filter(s=>s.contact_id===c.id).length),fit,route,el('td',a?.crm_status?.replaceAll('_',' ')||'pending'),action);return tr;
  }));
  $('events').replaceChildren(...state.events.map(e=>{const n=el('div',undefined,`event ${e.level}`);n.append(el('time',new Date(e.created_at).toLocaleString()),el('span',`${e.stage}: ${e.message}`));return n;}));
}
function detail(id) {
  const c=state.contacts.find(c=>c.id===id), a=state.assessments.find(a=>a.contact_id===id), n=$('detail-body');
  n.replaceChildren(el('h2',`${c.first_name} ${c.last_name}`),el('p',`${c.designation} · ${c.company||'Company not provided'}`),el('p',c.email||'Email not provided'));
  if(a){n.append(el('h3',`Fit: ${a.score}/10 · ${a.tier.replaceAll('_',' ')}`),el('p',a.reason),el('p',`Status: ${a.status}; CRM: ${a.crm_status}`),el('pre',JSON.stringify(a.points,null,2)),el('p',`Flags: ${a.flags.join(', ')||'none'}`));if(a.error)n.append(el('pre',a.error));n.append(el('h3','Email draft'),el('pre',a.draft?`${a.draft.subject}\n\n${a.draft.body}`:'No draft. This record was excluded, is held for review, or has not completed processing.'));if(a.validation)n.append(el('p',JSON.stringify(a.validation)));if(a.analysis)n.append(el('h3',`AI evidence / ${a.model}`),el('pre',JSON.stringify(a.analysis,null,2)));}
  n.append(el('h3','Original sessions'));
  for(const session of state.sessions.filter(s=>s.contact_id===id)){const block=el('div',undefined,'session');block.append(el('strong',`${session.id} / ${session.source_tool}`),el('p',`Recorded: ${session.created_at}`),el('pre',`INPUT\n${session.tool_input||'(missing)'}\n\nOUTPUT\n${session.tool_output||'(missing)'}`));n.append(block);}
  $('detail').showModal();
}
$('login').addEventListener('submit', async e=>{e.preventDefault();token=$('token').value;sessionStorage.setItem('operator-token',token);$('token').value='';await refresh();});
$('filter').addEventListener('change',render);$('refresh').addEventListener('click',refresh);$('close-detail').addEventListener('click',()=>$('detail').close());
for(const id of ['import','run'])$(''+id).addEventListener('click',async()=>{const buttons=[...document.querySelectorAll('.actions button')];buttons.forEach(b=>b.disabled=true);message(id==='run'?'Processing contacts. AI calls may take a few minutes.':'Importing all sample sessions…');try{const result=await api(`/api/${id}`,{});await refresh();message(JSON.stringify(result));}catch(e){message(e.message,true);}finally{buttons.forEach(b=>b.disabled=false);}});
refresh().catch(e=>message(e.message,true));
