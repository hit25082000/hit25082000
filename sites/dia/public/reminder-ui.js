'use strict';
const R=DiaReminder;
let reminderDraft=null;
const allReminders=()=>Object.entries(state.days).flatMap(([origin,d])=>(d.reminders||[]).map(reminder=>({origin,reminder})));
const reminderStatus={local:'Salvo aqui · falta adicionar à agenda',pending:'Google: salvamento ainda não confirmado',confirmed:'Salvo no Google · confirmado por você',changed:'Alterado aqui · ajuste também no Google'};
const shortReminderDate=r=>new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dateObject(r.date))+' · '+r.time;
const renderDayBeforeReminders=renderDay;
renderDay=function(){renderDayBeforeReminders();renderReminders();};
function currentReminder(){return reminderDraft?.id?state.days[reminderDraft.origin]?.reminders?.find(r=>r.id===reminderDraft.id):null;}
function defaultReminderTime(){const next=new Date(Date.now()+60*60000);return new Intl.DateTimeFormat('en-GB',{timeZone:R.TIMEZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(next);}
function renderReminders(){
  const list=$('reminderList');list.replaceChildren();
  const entries=allReminders().filter(({origin,reminder})=>origin===selectedDate||reminder.date===selectedDate).sort((a,b)=>Number(a.reminder.done)-Number(b.reminder.done)||(a.reminder.date+a.reminder.time).localeCompare(b.reminder.date+b.reminder.time));
  $('reminderTip').hidden=entries.length>0;
  for(const {origin,reminder:r} of entries){
    const row=el('article','reminder-card'+(r.done?' done':'')),head=el('div','reminder-card-head'),check=el('input');
    check.type='checkbox';check.checked=r.done;check.setAttribute('aria-label','Concluir lembrete: '+r.title);
    check.addEventListener('change',()=>{r.done=check.checked;persist();renderReminders();if(r.googleStatus!=='local')notify('Conclusão registrada aqui. O evento na sua agenda não foi alterado.');});
    const edit=el('button','reminder-card-title',r.title);edit.setAttribute('aria-label','Editar lembrete: '+r.title);edit.addEventListener('click',()=>openReminder(origin,r));
    head.append(check,edit);row.append(head,el('div','reminder-card-time',shortReminderDate(r)+' · Cuiabá'));
    const status=el('p','reminder-card-status',reminderStatus[r.googleStatus]);
    if(!r.done&&R.toUTC(r.date,r.time).getTime()<Date.now())row.append(el('span','reminder-overdue','Horário passado'));
    row.append(status);
    const actions=el('div','reminder-card-actions'),google=el('button','reminder-google-link',r.googleStatus==='local'?'Adicionar ao Google':'Abrir Agenda');
    google.addEventListener('click',()=>openReminder(origin,r));
    const remove=el('button','reminder-remove','Remover');remove.setAttribute('aria-label','Remover lembrete: '+r.title);
    remove.addEventListener('click',()=>{const reminders=state.days[origin].reminders,index=reminders.findIndex(x=>x.id===r.id);if(index<0)return;reminders.splice(index,1);persist();renderReminders();notify(r.googleStatus==='local'?'Lembrete removido daqui.':'Removido daqui. O evento no Google permanece; exclua-o lá se necessário.',()=>{state.days[origin].reminders.splice(index,0,r);persist();renderReminders();});});
    actions.append(google,remove);row.append(actions);list.append(row);
  }
}
function openReminder(origin=selectedDate,reminder=null){
  reminderDraft={origin,id:reminder?.id||null};$('reminderForm').reset();$('reminderError').textContent='';
  const selection=selectedNotes('remember').trim(),lines=selection.split(/\n+/).filter(Boolean);
  $('reminderTitle').value=reminder?.title||(lines[0]||'').slice(0,200);
  $('reminderDescription').value=reminder?.description||(lines.length>1?lines.slice(1).join('\n'):'').slice(0,3000);
  const nextDate=new Intl.DateTimeFormat('en-CA',{timeZone:R.TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+60*60000));
  $('reminderDate').value=reminder?.date||(selectedDate<=today()?nextDate:selectedDate);$('reminderTime').value=reminder?.time||defaultReminderTime();
  $('reminderDialogTitle').textContent=reminder?'Seu lembrete':'Um lembrete para…';updateReminderDialogStatus();$('reminderDialog').showModal();
}
function updateReminderDialogStatus(){
  const record=currentReminder(),status=record?.googleStatus||'local';
  $('reminderExternalStatus').textContent=record?reminderStatus[status]:'';
  $('googleReminder').textContent=status==='local'?'Salvar e abrir Google Agenda':'Salvar aqui e abrir Agenda';
  $('confirmGoogleReminder').hidden=!['pending','changed'].includes(status);
  $('confirmGoogleReminder').textContent=status==='changed'?'Já atualizei o Google e configurei a notificação':'Já salvei no Google e configurei a notificação';
  $('retryGoogleReminder').hidden=status!=='pending';
}
function saveReminderDraft(){
  if(!$('reminderForm').reportValidity())return null;
  const previous=currentReminder(),draft={id:previous?.id||uid(),title:$('reminderTitle').value.trim(),description:$('reminderDescription').value.trim(),date:$('reminderDate').value,time:$('reminderTime').value,timezone:R.TIMEZONE,done:previous?.done||false,googleStatus:previous?.googleStatus||'local'};
  try{
    R.validateReminder(draft,uid);
    const schedulingChanged=!previous||previous.date!==draft.date||previous.time!==draft.time;
    if(schedulingChanged&&R.toUTC(draft.date,draft.time).getTime()<=Date.now())throw new Error('Escolha uma data e um horário futuros para o aviso.');
    if(allReminders().some(({reminder:r})=>r.id!==draft.id&&r.date===draft.date&&r.time===draft.time&&P.normalize(r.title.trim())===P.normalize(draft.title)))throw new Error('Esse lembrete já existe com a mesma data e horário. Edite o item existente.');
    const changed=previous&&['title','description','date','time'].some(k=>previous[k]!==draft[k]);
    if(changed&&draft.googleStatus!=='local')draft.googleStatus='changed';
    const d=getDay(reminderDraft.origin);d.reminders||=[];const i=d.reminders.findIndex(r=>r.id===draft.id);if(i>=0)d.reminders[i]=draft;else d.reminders.push(draft);
    reminderDraft.id=draft.id;persist();renderReminders();updateReminderDialogStatus();
    if(storageError)throw new Error('O navegador não permitiu salvar. Exporte um backup antes de fechar a página.');
    $('reminderError').textContent='';return draft;
  }catch(err){$('reminderError').textContent=err.message;return null;}
}
function openCalendarForm(record){
  if(R.toUTC(record.date,record.time).getTime()<=Date.now()){$('reminderError').textContent='O horário já passou. Escolha uma data futura antes de abrir o formulário.';return;}
  // Opening a template is not proof of event creation. Never mark it confirmed here.
  window.open(R.googleCalendarURL(record),'_blank','noopener,noreferrer');record.googleStatus='pending';persist();renderReminders();updateReminderDialogStatus();
}
$('newReminder').addEventListener('click',()=>openReminder());
$('saveReminder').addEventListener('click',()=>{if(saveReminderDraft()){notify('Lembrete salvo aqui. Para avisar no celular, adicione-o à sua agenda.');$('reminderDialog').close();}});
$('reminderForm').addEventListener('submit',e=>{
  e.preventDefault();const record=saveReminderDraft();if(!record)return;
  if(record.googleStatus==='local')openCalendarForm(record);
  else window.open('https://calendar.google.com/calendar/r','_blank','noopener,noreferrer');
});
$('retryGoogleReminder').addEventListener('click',()=>{const record=saveReminderDraft();if(!record)return;if(confirm('Reabrir o formulário? Se você já salvou o evento no Google, salve apenas uma vez para evitar duplicação.'))openCalendarForm(record);});
$('confirmGoogleReminder').addEventListener('click',()=>{const record=saveReminderDraft();if(!record)return;record.googleStatus='confirmed';persist();renderReminders();updateReminderDialogStatus();notify('Confirmação anotada por você. Confira as notificações da Agenda no celular.');});
$('downloadReminder').addEventListener('click',()=>{const record=saveReminderDraft();if(!record)return;download('dia-lembrete-'+record.date+'.ics',R.calendarFile(record),'text/calendar;charset=utf-8');notify('Arquivo gerado. Importe na sua agenda e confira a notificação.');});
renderReminders();
