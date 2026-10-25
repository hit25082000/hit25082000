'use strict';
const $ = id => document.getElementById(id);
const KEY = 'dia.planner.v1';
const MAX_TEXT = 500000;
const blankDay = () => ({notes:'',mainPriority:'',priorityDone:false,remember:'',reminders:[],tasks:[],events:[]});
const freshState = () => ({version:1,days:{},weeks:{},settings:{mode:'day',theme:'light',notesWidth:48,planWidth:25,availability:DiaPlan.defaultAvailability(),focusConfigured:false}});
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4))>=1900 && Number(value.slice(0,4))<=2100 && !isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateObject = key => new Date(key+'T12:00:00');
const time = minutes => String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
const minutes = value => Number(value.slice(0,2))*60+Number(value.slice(3,5));
const colors = ['olive','blue','amber','rose'];
function validateState(raw){
  if(!raw || raw.version!==1 || !raw.days || typeof raw.days!=='object' || Array.isArray(raw.days)) throw new Error('Formato de backup inválido.');
  const cleaned=freshState();
  const keys=Object.keys(raw.days);
  if(keys.length>20000) throw new Error('O backup excede o limite de dias.');
  for(const key of keys){
    if(!validDate(key)) throw new Error('O backup contém uma data inválida.');
    const d=raw.days[key];
    if(!d || typeof d!=='object') throw new Error('Dia inválido.');
    for(const field of ['notes','mainPriority','remember']) if(typeof d[field]!=='string' || d[field].length>MAX_TEXT) throw new Error('O backup contém uma anotação inválida.');
    if(typeof d.priorityDone!=='boolean' || !Array.isArray(d.tasks) || !Array.isArray(d.events) || d.tasks.length>5000 || d.events.length>500) throw new Error('O backup contém uma lista inválida.');
    const tasks=d.tasks.map(t=>{if(!t || typeof t.text!=='string' || t.text.length>500 || typeof t.done!=='boolean') throw new Error('Ação inválida.');return {id:typeof t.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(t.id)?t.id:uid(),text:t.text,done:t.done,...DiaPriority.clean(t),...(Object.hasOwn(DiaPlan.TYPES,t.type)?{type:t.type}:{})};});
    const events=d.events.map(e=>{if(!e || typeof e.title!=='string' || !e.title.trim() || e.title.length>200 || typeof e.note!=='string' || e.note.length>3000 || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start<0 || e.end>1440 || e.end<=e.start || e.end-e.start<15 || !colors.includes(e.color)) throw new Error('Bloco de tempo inválido.');return {id:uid(),title:e.title,note:e.note,start:e.start,end:e.end,color:e.color,type:DiaPlan.eventType(e),...DiaPriority.clean(e)};});
    const sorted=events.slice().sort((a,b)=>a.start-b.start);
    if(sorted.some((e,i)=>i>0 && e.start<sorted[i-1].end)) throw new Error('O backup contém blocos sobrepostos.');
    if(d.reminders!==undefined&&(!Array.isArray(d.reminders)||d.reminders.length>1000))throw new Error('Lista de lembretes inválida.');
    const reminders=(d.reminders||[]).map(r=>DiaReminder.validateReminder(r,uid));
    if(new Set(reminders.map(r=>r.id)).size!==reminders.length)throw new Error('Lembretes duplicados no backup.');
    cleaned.days[key]={notes:d.notes,mainPriority:d.mainPriority,remember:d.remember,reminders,priorityDone:d.priorityDone,tasks,events};
  }
  const s=raw.settings||{};
  cleaned.settings={mode:['write','week'].includes(s.mode)?s.mode:'day',theme:s.theme==='dark'?'dark':'light',notesWidth:Number.isFinite(s.notesWidth)?Math.min(66,Math.max(26,s.notesWidth)):48,planWidth:Number.isFinite(s.planWidth)?Math.min(45,Math.max(18,s.planWidth)):25};
  if(cleaned.settings.notesWidth+cleaned.settings.planWidth>81) cleaned.settings.planWidth=81-cleaned.settings.notesWidth;
  cleaned.settings.availability=s.availability===undefined?DiaPlan.defaultAvailability():DiaPlan.validateAvailability(s.availability);
  cleaned.settings.focusConfigured=s.focusConfigured===true;
  if(raw.weeks!==undefined){
    if(!raw.weeks||typeof raw.weeks!=='object'||Array.isArray(raw.weeks))throw new Error('Semanas inválidas.');
    for(const [key,w] of Object.entries(raw.weeks)){if(!validDate(key)||DiaPlan.weekStart(key)!==key||!w||typeof w.goals!=='string'||typeof w.notes!=='string'||w.goals.length>MAX_TEXT||w.notes.length>MAX_TEXT)throw new Error('Planejamento semanal inválido.');cleaned.weeks[key]={goals:w.goals,notes:w.notes};}
  }
  return cleaned;
}
let state=freshState(), readBlocked=false, storageError=false, saveTimer, toastTimer, undoAction=null, editingEvent=null, eventDate=null;
try { const raw=localStorage.getItem(KEY); if(raw) state=validateState(JSON.parse(raw)); } catch(e){readBlocked=true;storageError=true;}
let selectedDate=today();
let day = () => state.days[selectedDate] || (state.days[selectedDate]=blankDay());
function markSaving(){ $('saveText').textContent='Salvando…'; clearTimeout(saveTimer); saveTimer=setTimeout(persist,300); }
function persist(){
  clearTimeout(saveTimer);
  try {
    if(readBlocked) throw new Error('Armazenamento indisponível');
    localStorage.setItem(KEY,JSON.stringify(state));storageError=false;
    $('saveText').textContent='Salvo neste navegador';$('saveStatus').classList.remove('error');
  } catch(e){storageError=true;$('saveText').textContent='Não foi possível salvar — exporte um backup';$('saveStatus').classList.add('error');}
}
function notify(message, undo=null){
  clearTimeout(toastTimer);undoAction=undo;$('toastText').textContent=message;$('undoButton').hidden=!undo;$('toast').hidden=false;
  toastTimer=setTimeout(()=>{$('toast').hidden=true;undoAction=null;},undo?12000:6000);
}
function closeMenu(){ $('optionsMenu').hidden=true;$('menuButton').setAttribute('aria-expanded','false'); }
function renderSettings(){
  const s=state.settings;
  document.body.dataset.theme=s.theme;
  document.documentElement.style.setProperty('--notes',s.notesWidth+'%');
  document.documentElement.style.setProperty('--plan',s.planWidth+'%');
  $('workspace').classList.toggle('write-mode',s.mode==='write');
  $('dayView').classList.toggle('active',s.mode==='day');$('writeView').classList.toggle('active',s.mode==='write');
  $('dayView').setAttribute('aria-pressed',s.mode==='day');$('writeView').setAttribute('aria-pressed',s.mode==='write');
  $('resizeNotes').setAttribute('aria-valuenow',Math.round(s.notesWidth));$('resizePlan').setAttribute('aria-valuenow',Math.round(s.planWidth));
}
function updateWordCount(){const words=day().notes.trim()?day().notes.trim().split(/\s+/).length:0;$('wordCount').textContent=words?`${words} ${words===1?'palavra':'palavras'}`:'Seu espaço de pensar';}
function updateProgress(){const d=day();$('taskProgress').textContent=d.tasks.filter(t=>t.done).length+'/'+d.tasks.length;document.querySelector('.main-priority').classList.toggle('finished',d.priorityDone);}
function resizeTask(el){el.style.height='20px';el.style.height=el.scrollHeight+'px';}
function renderTasks(){
  const list=$('taskList');list.replaceChildren();
  for(const task of day().tasks){
    const row=document.createElement('div');row.className='task-row'+(task.done?' completed':'');
    const check=document.createElement('input');check.type='checkbox';check.className='task-check';check.checked=task.done;check.setAttribute('aria-label','Concluir ação: '+task.text);
    const input=document.createElement('textarea');input.rows=1;input.className='task-text';input.value=task.text;input.maxLength=500;input.setAttribute('aria-label','Texto da ação');
    const del=document.createElement('button');del.className='task-delete';del.title='Excluir ação';del.setAttribute('aria-label','Excluir ação: '+task.text);del.innerHTML='<svg><use href="#i-close"/></svg>';
    check.addEventListener('change',()=>{task.done=check.checked;row.classList.toggle('completed',task.done);updateProgress();markSaving();});
    input.addEventListener('input',()=>{task.text=input.value;resizeTask(input);check.setAttribute('aria-label','Concluir ação: '+task.text);del.setAttribute('aria-label','Excluir ação: '+task.text);markSaving();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('taskInput').focus();}});
    del.addEventListener('click',()=>{const key=selectedDate,index=day().tasks.findIndex(t=>t.id===task.id);day().tasks.splice(index,1);renderTasks();persist();notify('Ação removida.',()=>{state.days[key].tasks.splice(index,0,task);if(selectedDate===key)renderTasks();persist();});});
    row.append(check,input,del);list.append(row);requestAnimationFrame(()=>resizeTask(input));
  }
  updateProgress();
}
function renderEvents(){
  const container=$('events');container.replaceChildren();
  const sorted=day().events.slice().sort((a,b)=>a.start-b.start);
  for(const e of sorted){
    const button=document.createElement('button');button.className='event '+e.color;
    button.style.top=e.start*64/60+1+'px';button.style.height=(e.end-e.start)*64/60-2+'px';
    button.setAttribute('aria-label',`${e.title}, ${time(e.start)} às ${time(e.end)}. Editar bloco.`);
    button.title=DiaPlan.TYPES[DiaPlan.eventType(e)].label+' · '+`${time(e.start)} — ${time(e.end)}\n${e.title}${e.note?'\n'+e.note:''}`;
    const title=document.createElement('strong');title.textContent=e.title;
    const range=document.createElement('span');range.className='event-time';range.textContent=DiaPlan.TYPES[DiaPlan.eventType(e)].label+' · '+time(e.start)+' — '+time(e.end);
    if(e.end-e.start<30){button.style.padding='2px 7px';button.append(title);}else{button.append(range,title);if(e.note&&e.end-e.start>=70){const note=document.createElement('span');note.className='event-note';note.textContent=e.note;button.append(note);}}
    button.addEventListener('click',()=>openBlock(e));container.append(button);
  }
  const total=sorted.reduce((n,e)=>n+e.end-e.start,0);$('scheduledTotal').textContent=total?(Math.floor(total/60)?Math.floor(total/60)+'h ':'')+(total%60?total%60+'min':'')+' planejados':'Sem blocos';
  updateNow();
}
function renderDay(){
  const d=day(),dt=dateObject(selectedDate);
  $('dateLabel').textContent=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long'}).format(dt);
  $('dateButton').title=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(dt);
  $('notesDate').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(dt)+' · '+dt.getFullYear();
  $('agendaDay').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(dt);
  $('todayButton').style.visibility=selectedDate===today()?'hidden':'visible';
  $('notes').value=d.notes;$('mainPriority').value=d.mainPriority;$('priorityDone').checked=d.priorityDone;$('remember').value=d.remember;
  $('taskInput').value='';updateWordCount();renderTasks();renderEvents();
  document.title=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dt)+' · Dia';
}
function goDate(key){if(!validDate(key)){notify('Escolha uma data entre 1900 e 2100.');return;}persist();selectedDate=key;renderDay();}
function shiftDate(n){if(state.settings.mode==='week')n*=7;const dt=dateObject(selectedDate);dt.setDate(dt.getDate()+n);const next=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');goDate(next);}
function updateNow(){
  const line=$('nowLine');line.hidden=selectedDate!==today();
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Cuiaba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const h=Number(parts.find(v=>v.type==='hour').value),m=Number(parts.find(v=>v.type==='minute').value);line.style.top=(h*60+m)*64/60+'px';
}
function openBlock(event=null,start=9*60,date=selectedDate){
  eventDate=date;state.days[date]||=blankDay();editingEvent=event?.id||null;
  $('blockForm').reset();$('blockError').textContent='';$('blockDialogTitle').textContent=event?'Seu bloco de tempo':'Um tempo para…';
  $('blockTitle').value=event?.title||'';$('blockStart').value=time(event?.start??start);$('blockEnd').value=time(event?.end??Math.min(start+60,1439));
  $('blockNote').value=event?.note||'';$('blockType').value=event?DiaPlan.eventType(event):(state.settings.availability.find(w=>w.weekday===dateObject(date).getDay()&&start>=w.start&&start<w.end)?.type||'deep');
  $('blockPurpose').value=event?.purpose||'unclassified';$('deleteBlock').hidden=!event;$('blockDialog').showModal();$('blockTitle').focus();
}
function download(filename,contents,mime){
  const url=URL.createObjectURL(new Blob([contents],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setMode(mode){state.settings.mode=mode;renderSettings();markSaving();if(mode==='write')$('notes').focus();}
for(const [id,field] of [['notes','notes'],['mainPriority','mainPriority'],['remember','remember']]){
  $(id).maxLength=MAX_TEXT;$(id).addEventListener('input',()=>{day()[field]=$(id).value;if(id==='notes')updateWordCount();markSaving();});
}
$('priorityDone').addEventListener('change',()=>{day().priorityDone=$('priorityDone').checked;updateProgress();markSaving();});
$('taskForm').addEventListener('submit',e=>{e.preventDefault();const text=$('taskInput').value.trim();if(!text)return;day().tasks.push({id:uid(),text,done:false,purpose:$('newTaskPurpose').value,priority:2,dueDate:''});$('taskInput').value='';renderTasks();persist();$('taskInput').focus();});
$('prevDay').addEventListener('click',()=>shiftDate(-1));$('nextDay').addEventListener('click',()=>shiftDate(1));$('todayButton').addEventListener('click',()=>goDate(today()));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();goDate(today());});
$('dateButton').addEventListener('click',()=>{$('datePicker').value=selectedDate;$('datePicker').min='1900-01-01';$('datePicker').max='2100-12-31';$('dateDialog').showModal();});
$('dateForm').addEventListener('submit',e=>{e.preventDefault();if(!validDate($('datePicker').value))return;goDate($('datePicker').value);$('dateDialog').close();});
for(const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click',()=>button.closest('dialog').close());
for(const dlg of document.querySelectorAll('dialog'))dlg.addEventListener('click',e=>{if(e.target===dlg){const b=dlg.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dlg.close();}});
$('dayView').addEventListener('click',()=>setMode('day'));$('writeView').addEventListener('click',()=>setMode('write'));
$('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Use F11 no computador para abrir em tela cheia.');}});
$('menuButton').addEventListener('click',()=>{const open=$('optionsMenu').hidden;$('optionsMenu').hidden=!open;$('menuButton').setAttribute('aria-expanded',String(open));});
document.addEventListener('click',e=>{if(!e.target.closest('.menu-wrapper'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
$('themeButton').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='dark'?'light':'dark';renderSettings();persist();closeMenu();});
$('exportButton').addEventListener('click',()=>{persist();download('dia-backup-'+today()+'.json',JSON.stringify(state,null,2),'application/json');notify('Backup exportado. Guarde o arquivo em um lugar seguro.');closeMenu();});
$('markdownButton').addEventListener('click',()=>{const d=day();const md=`# ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(dateObject(selectedDate))}\n\n## Anotações\n\n${d.notes}\n\n## Entrega do dia\n\n- [${d.priorityDone?'x':' '}] ${d.mainPriority}\n\n## Próximas ações\n\n${d.tasks.map(t=>'- ['+(t.done?'x':' ')+'] '+t.text).join('\n')}\n\n## Não esquecer\n\n${d.remember}\n\n## Lembretes com data e horário\n\n${Object.entries(state.days).flatMap(([origin,v])=>(v.reminders||[]).filter(r=>origin===selectedDate||r.date===selectedDate).map(r=>'- ['+(r.done?'x':' ')+'] '+r.title+' — '+r.date+' '+r.time+' (Cuiabá)'+(r.description?' — '+r.description:''))).join('\n')}\n\n## Meu tempo\n\n${d.events.slice().sort((a,b)=>a.start-b.start).map(e=>`- ${time(e.start)}–${time(e.end)}: ${e.title}${e.note?' — '+e.note:''}`).join('\n')}\n`;download('dia-'+selectedDate+'.md',md,'text/markdown;charset=utf-8');closeMenu();});
$('importButton').addEventListener('click',()=>{$('importFile').click();closeMenu();});
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    if(file.size>15000000)throw new Error('O arquivo deve ter até 15 MB.');
    const imported=validateState(JSON.parse(await file.text()));const keys=Object.keys(imported.days);if(!keys.length&&!Object.keys(imported.weeks).length&&!imported.settings.focusConfigured)throw new Error('O backup está vazio.');
    const overlap=keys.filter(k=>Object.hasOwn(state.days,k));
    if(!confirm(`Importar ${keys.length} dia(s), ${Object.keys(imported.weeks).length} semana(s) e as configurações de foco?${overlap.length?' '+overlap.length+' dia(s) existente(s) serão substituídos.':''} Os demais dias serão mantidos.`))return;
    const previous=structuredClone(state);for(const key of keys)state.days[key]=imported.days[key];Object.assign(state.weeks,imported.weeks);state.settings.availability=imported.settings.availability;state.settings.focusConfigured=imported.settings.focusConfigured;
    renderDay();persist();notify(storageError?'Importado na sessão. Exporte um backup: o navegador não permitiu salvar.':'Backup importado.',()=>{state=previous;renderSettings();renderDay();persist();});
  }catch(err){notify('Não foi possível importar. '+err.message);}finally{e.target.value='';}
});
$('addBlock').addEventListener('click',()=>openBlock());
for(let hour=0;hour<24;hour++){
  const button=document.createElement('button');button.className='hour-line';button.setAttribute('aria-label',`Planejar um bloco às ${String(hour).padStart(2,'0')}:00`);const label=document.createElement('span');label.textContent=String(hour).padStart(2,'0')+':00';button.append(label);button.addEventListener('click',()=>openBlock(null,hour*60));$('hourLines').append(button);
}
$('blockForm').addEventListener('submit',e=>{
  e.preventDefault();const start=minutes($('blockStart').value),end=minutes($('blockEnd').value),title=$('blockTitle').value.trim();
  if(!title){$('blockError').textContent='Dê um nome para o bloco.';return;}
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end-start<15){$('blockError').textContent='O bloco precisa ter pelo menos 15 minutos e terminar no mesmo dia, depois do início.';return;}
  const d=state.days[eventDate];if(d.events.some(v=>v.id!==editingEvent&&start<v.end&&end>v.start)){$('blockError').textContent='Já existe um bloco nesse horário. Ajuste o início ou o fim para não sobrepor.';return;}
  const event={id:editingEvent||uid(),title,start,end,note:$('blockNote').value,type:$('blockType').value,color:DiaPlan.TYPES[$('blockType').value].color,...DiaPriority.clean(d.events.find(v=>v.id===editingEvent)||{}),purpose:$('blockPurpose').value};
  const index=d.events.findIndex(v=>v.id===editingEvent);if(index>=0)d.events[index]=event;else d.events.push(event);
  persist();renderEvents();$('blockDialog').close();
});
$('deleteBlock').addEventListener('click',()=>{const key=eventDate,d=state.days[key],index=d.events.findIndex(e=>e.id===editingEvent);if(index<0)return;const [removed]=d.events.splice(index,1);persist();renderEvents();$('blockDialog').close();notify('Bloco removido.',()=>{state.days[key].events.splice(index,0,removed);if(selectedDate===key)renderEvents();persist();});});
$('closeToast').addEventListener('click',()=>{$('toast').hidden=true;undoAction=null;});$('undoButton').addEventListener('click',()=>{undoAction?.();undoAction=null;$('toast').hidden=true;});
function resizeColumns(handle,kind){
  function apply(delta){
    const s=state.settings;
    if(kind==='notes'){s.notesWidth=Math.min(66,Math.max(26,s.notesWidth+delta));if(s.notesWidth+s.planWidth>81)s.planWidth=81-s.notesWidth;}
    else{s.planWidth=Math.max(18,Math.min(81-s.notesWidth,s.planWidth+delta));}
    renderSettings();
  }
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing');let last=e.clientX;
    const move=ev=>{const delta=(ev.clientX-last)/$('workspace').clientWidth*100;last=ev.clientX;apply(delta);};
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);document.body.classList.remove('resizing');persist();};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  });
  handle.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();apply(e.key==='ArrowRight'?1:-1);persist();}});
  handle.addEventListener('dblclick',()=>{state.settings.notesWidth=48;state.settings.planWidth=25;renderSettings();persist();});
}
resizeColumns($('resizeNotes'),'notes');resizeColumns($('resizePlan'),'plan');
window.addEventListener('beforeunload',e=>{persist();if(storageError && (Object.values(state.days).some(d=>d.notes||d.mainPriority||d.remember||d.tasks.length||d.events.length||d.reminders?.length)||Object.values(state.weeks).some(w=>w.goals||w.notes))){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
renderSettings();renderDay();
requestAnimationFrame(()=>{$('timelineScroll').scrollTop=7*64-12;});
setInterval(updateNow,30000);
if(readBlocked){$('saveText').textContent='Armazenamento indisponível';$('saveStatus').classList.add('error');notify('O navegador não permitiu abrir os dados. Exporte um backup antes de fechar.');}
