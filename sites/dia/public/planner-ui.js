'use strict';
const P=DiaPlan;
const weekdayNames=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
let availabilityDraft=[],suggestions=[],suggestStartDate=null,suggestFromWeek=false,weekRenderKey=null;
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const getDay=key=>state.days[key]||(state.days[key]=blankDay());
const getWeek=key=>state.weeks[key]||(state.weeks[key]={goals:'',notes:''});
function typeSelect(value,label){const select=el('select');select.setAttribute('aria-label',label);for(const [key,t]of Object.entries(P.TYPES)){const opt=el('option','',t.label);opt.value=key;select.append(opt);}select.value=value;return select;}
const originalRenderSettings=renderSettings;
renderSettings=function(){
  originalRenderSettings();const week=state.settings.mode==='week';$('workspace').hidden=week;$('weeklyWorkspace').hidden=!week;
  $('weekView').classList.toggle('active',week);$('weekView').setAttribute('aria-pressed',week);
  $('prevDay').setAttribute('aria-label',week?'Sema­na anterior'.replace('­',''):'Dia anterior');$('prevDay').title=week?'Semana anterior':'Dia anterior';
  $('nextDay').setAttribute('aria-label',week?'Próxima semana':'Próximo dia');$('nextDay').title=week?'Próxima semana':'Próximo dia';
};
const originalSetMode=setMode;
setMode=function(mode){originalSetMode(mode);renderDateHeading();if(mode==='week')renderWeek();};
const originalRenderDay=renderDay;
renderDay=function(){originalRenderDay();renderDateHeading();if(state.settings.mode==='week')renderWeek();};
const originalRenderEvents=renderEvents;
renderEvents=function(){originalRenderEvents();renderAvailabilityBackground();if(state.settings.mode==='week')renderWeek();};
function renderDateHeading(){
  if(state.settings.mode!=='week'){document.title=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dateObject(selectedDate))+' · Dia';return;}
  const start=P.weekStart(selectedDate),end=P.shiftDate(start,6);
  document.title='Semana · Dia';
  $('dateLabel').textContent=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dateObject(start))+' – '+new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short'}).format(dateObject(end));
}
function availabilityFor(key){return state.settings.availability.filter(w=>w.weekday===dateObject(key).getDay());}
function makeAvailability(w,scale){
  const band=el('div','availability-band '+w.type);band.style.top=w.start*scale+'px';band.style.height=(w.end-w.start)*scale+'px';
  band.title=P.TYPES[w.type].label+' disponível: '+time(w.start)+' – '+time(w.end);return band;
}
function renderAvailabilityBackground(){const bg=$('availabilityBackground');bg.replaceChildren();for(const w of availabilityFor(selectedDate))bg.append(makeAvailability(w,64/60));}
function renderWeek(){
  const start=P.weekStart(selectedDate),week=getWeek(start),board=$('weekBoard'),oldScroll=board.scrollTop,changed=weekRenderKey!==start;
  $('weekRange').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(dateObject(start))+' — '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(dateObject(P.shiftDate(start,6)));
  if(document.activeElement!==$('weekGoals'))$('weekGoals').value=week.goals;if(document.activeElement!==$('weekNotes'))$('weekNotes').value=week.notes;
  board.replaceChildren();
  for(let i=0;i<7;i++){
    const key=P.shiftDate(start,i),dt=dateObject(key),d=state.days[key]||blankDay(),column=el('section','week-column'+(key===today()?' is-today':''));column.setAttribute('aria-label',weekdayNames[dt.getDay()]+', '+key);
    const header=el('div','week-column-header'),open=el('button','week-open-day');
    open.append(el('span','',new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(dt)),el('strong','',dt.getDate()));
    open.setAttribute('aria-label','Abrir dia '+key);open.addEventListener('click',()=>{goDate(key);setMode('day');});
    const priority=el('textarea','week-day-priority');priority.rows=2;priority.maxLength=MAX_TEXT;priority.placeholder='Entrega do dia…';priority.value=d.mainPriority;priority.setAttribute('aria-label','Entrega principal em '+key);
    priority.addEventListener('input',()=>{getDay(key).mainPriority=priority.value;if(key===selectedDate)$('mainPriority').value=priority.value;markSaving();});
    const taskCount=el('button','week-task-count',d.tasks.length?`${d.tasks.filter(t=>t.done).length}/${d.tasks.length} ações`:'Abrir anotações');taskCount.addEventListener('click',()=>{goDate(key);setMode('day');});
    header.append(open,priority,taskCount);
    const track=el('div','week-track');
    const bg=el('div','week-availability');for(const w of availabilityFor(key))bg.append(makeAvailability(w,48/60));track.append(bg);
    for(let h=0;h<24;h++){
      const hour=el('button','week-hour',String(h).padStart(2,'0'));hour.style.top=h*48+'px';hour.setAttribute('aria-label','Agendar em '+key+' às '+time(h*60));hour.addEventListener('click',()=>openBlock(null,h*60,key));track.append(hour);
    }
    for(const e of d.events.slice().sort((a,b)=>a.start-b.start)){
      const type=P.eventType(e),card=el('button','week-event event-type-'+type);card.style.top=e.start*48/60+1+'px';card.style.height=(e.end-e.start)*48/60-2+'px';
      card.setAttribute('aria-label',e.title+' em '+key+', '+time(e.start)+' às '+time(e.end)+'. '+P.TYPES[type].label);card.title=P.TYPES[type].label+' · '+time(e.start)+'–'+time(e.end)+'\n'+e.title;
      card.append(el('span','',time(e.start)),el('strong','',e.title));if(e.end-e.start>=90)card.append(el('small','',P.TYPES[type].label));
      card.addEventListener('click',()=>openBlock(e,e.start,key));track.append(card);
    }
    column.append(header,track);board.append(column);
  }
  weekRenderKey=start;board.scrollTop=changed?7*48:oldScroll;
}
function openFocusSettings(){
  availabilityDraft=structuredClone(state.settings.availability);$('focusError').textContent='';
  $('focusHint').textContent=state.settings.focusConfigured?'As sugestões usam estes períodos e descontam os blocos já agendados. Dias sem períodos ficam indisponíveis.':'Ponto de partida sugerido: ajuste os horários ao seu dia real. Estes períodos indicam disponibilidade; não criam compromissos.';
  renderAvailabilityEditor();$('focusDialog').showModal();
}
function renderAvailabilityEditor(){
  const editor=$('availabilityEditor');editor.replaceChildren();
  for(const weekday of [1,2,3,4,5,6,0]){
    const section=el('section','availability-day'),head=el('div','availability-day-head');head.append(el('h3','',weekdayNames[weekday]));
    const add=el('button','small-add','+ período');add.type='button';add.setAttribute('aria-label','Adicionar período em '+weekdayNames[weekday]);
    add.addEventListener('click',()=>{const last=Math.max(540,...availabilityDraft.filter(w=>w.weekday===weekday).map(w=>w.end));availabilityDraft.push({weekday,type:'deep',start:Math.min(last,1320),end:Math.min(last+60,1380)});renderAvailabilityEditor();});head.append(add);section.append(head);
    const rows=availabilityDraft.filter(w=>w.weekday===weekday).sort((a,b)=>a.start-b.start);
    if(!rows.length)section.append(el('p','no-periods','Sem disponibilidade neste dia.'));
    for(const w of rows){
      const row=el('div','availability-row'),type=typeSelect(w.type,'Tipo do período em '+weekdayNames[weekday]);type.querySelector('option[value="other"]').remove();
      type.addEventListener('change',()=>{w.type=type.value;});
      const begin=el('input'),end=el('input');begin.type=end.type='time';begin.required=end.required=true;begin.value=time(w.start);end.value=time(w.end===1440?1439:w.end);
      begin.setAttribute('aria-label','Início do período em '+weekdayNames[weekday]);end.setAttribute('aria-label','Fim do período em '+weekdayNames[weekday]);
      begin.addEventListener('input',()=>{w.start=begin.value?minutes(begin.value):NaN;});end.addEventListener('input',()=>{w.end=end.value?minutes(end.value):NaN;});
      const remove=el('button','icon-button','×');remove.type='button';remove.setAttribute('aria-label','Remover período em '+weekdayNames[weekday]);remove.addEventListener('click',()=>{availabilityDraft.splice(availabilityDraft.indexOf(w),1);renderAvailabilityEditor();});
      row.append(type,begin,el('span','','até'),end,remove);section.append(row);
    }
    editor.append(section);
  }
}
function clockMinute(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Cuiaba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return Number(parts.find(v=>v.type==='hour').value)*60+Number(parts.find(v=>v.type==='minute').value);}
function openSuggestions(text,fromWeek=false){
  const parsed=P.parseNotes(text);if(!parsed.length){notify('Escreva uma ação por linha ou selecione um trecho das anotações.');return;}
  suggestFromWeek=fromWeek;suggestStartDate=fromWeek?P.weekStart(selectedDate):selectedDate;suggestions=parsed.map(item=>({...item,purpose:DiaPriority.classify(item.title).purpose,priority:2,dueDate:'',id:uid(),selected:true,destination:'block',slot:null,duplicate:false}));
  $('suggestScope').value='7';$('suggestScope').querySelector('option[value="7"]').textContent=fromWeek?'Semana exibida':'Próximos 7 dias';$('suggestError').textContent='';recalculateSuggestions();$('suggestDialog').showModal();
}
function recalculateSuggestions(){
  suggestStartDate=suggestFromWeek&&Number($('suggestScope').value)===7?P.weekStart(selectedDate):selectedDate;
  suggestions=P.planSuggestions(suggestions,{startDate:suggestStartDate,horizon:Number($('suggestScope').value),availability:state.settings.availability,days:state.days,today:today(),nowMinute:clockMinute()});
  $('suggestError').textContent='';
  renderSuggestions();
}
function renderSuggestions(){
  const list=$('suggestList');list.replaceChildren();
  $('suggestInfo').textContent=(state.settings.focusConfigured?'Usando seus períodos configurados.':'Usando períodos iniciais sugeridos. Ajuste-os em Configurações de foco para refletir sua disponibilidade real.')+' Se uma atividade não couber, você poderá mantê-la como tarefa.';
  for(const item of suggestions){
    const row=el('article','suggest-row'+(!item.selected?' is-unselected':''));
    const head=el('div','suggest-row-head'),check=el('input');check.type='checkbox';check.checked=item.selected;check.disabled=item.duplicate;check.setAttribute('aria-label','Selecionar '+item.title);check.addEventListener('change',()=>{item.selected=check.checked;recalculateSuggestions();});
    const title=el('input','suggest-title');title.value=item.title;title.maxLength=200;title.required=true;title.setAttribute('aria-label','Título da sugestão');title.addEventListener('input',()=>{item.title=title.value;});title.addEventListener('change',()=>{recalculateSuggestions();});head.append(check,title);
    const controls=el('div','suggest-row-controls'),type=typeSelect(item.type,'Tipo de '+item.title);type.querySelector('option[value="other"]').remove();type.addEventListener('change',()=>{item.type=type.value;item.manual=false;item.reason='Tipo ajustado por você. O horário foi recalculado.';recalculateSuggestions();});
    const duration=el('input');duration.type='number';duration.min=15;duration.max=480;duration.step=1;duration.value=item.duration;duration.setAttribute('aria-label','Duração em minutos de '+item.title);duration.addEventListener('change',()=>{item.duration=Math.min(480,Math.max(15,Number(duration.value)||30));item.manual=false;recalculateSuggestions();});
    const destination=el('select');destination.setAttribute('aria-label','Destino de '+item.title);for(const [v,t]of [['block','Agendamento'],['task','Tarefa']]){const o=el('option','',t);o.value=v;destination.append(o);}destination.value=item.destination;destination.addEventListener('change',()=>{item.destination=destination.value;item.manual=false;recalculateSuggestions();});
    type.disabled=duration.disabled=destination.disabled=item.duplicate;
    controls.append(type,duration,el('span','quiet','min'),destination);
    const purpose=purposeSelect(item.purpose,'Finalidade de '+item.title);purpose.disabled=item.duplicate;purpose.addEventListener('change',()=>{item.purpose=purpose.value;recalculateSuggestions();});controls.append(purpose);
    const reason=el('p','suggest-reason',item.reason),slot=el('div','suggest-slot '+item.type);
    if(item.duplicate){
      const existing=item.existing,label=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'numeric',month:'short'}).format(dateObject(existing.date));
      slot.textContent=existing.kind==='event'?'Já agendado: '+label+' · '+time(existing.start)+'–'+time(existing.end)+'. Nenhum novo bloco será criado.':'Tarefa já criada em '+label+', sem horário reservado. Nenhum novo item será criado.';
    }
    else if(!item.selected)slot.textContent='Selecione este item para sugerir um horário.';
    else if(item.conflict){slot.classList.add('no-slot');slot.textContent='Este horário coincide com outro bloco ou tem duração inválida. Ajuste o início ou recalcule os horários.';}
    else if(item.slot){const label=new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'numeric',month:'short'}).format(dateObject(item.slot.date));slot.textContent=(item.destination==='task'?'Horário recomendado: ':'Agendar: ')+label+' · '+time(item.slot.start)+'–'+time(item.slot.end);}
    else{slot.classList.add('no-slot');slot.textContent=item.destination==='task'?'Sem horário disponível: será criada como tarefa no dia selecionado.':'Sem espaço compatível. Escolha “Tarefa”, reduza a duração ou ajuste seus períodos.';}
    row.append(head,controls,reason,slot);
    if(item.selected&&!item.duplicate&&item.slot&&item.destination==='block'){
      const adjust=el('div','manual-slot'),date=el('input'),start=el('input');date.type='date';date.value=item.slot.date;date.min='1900-01-01';date.max='2100-12-31';start.type='time';start.value=time(item.slot.start);date.setAttribute('aria-label','Data sugerida de '+item.title);start.setAttribute('aria-label','Início sugerido de '+item.title);
      const update=()=>{if(!validDate(date.value)||!start.value)return;item.manual=true;item.slot={date:date.value,start:minutes(start.value),end:minutes(start.value)+item.duration};item.reason='Horário ajustado por você. A confirmação verifica conflitos.';recalculateSuggestions();};date.addEventListener('change',update);start.addEventListener('change',update);adjust.append(el('label','','Ajustar:'),date,start);row.append(adjust);
    }
    list.append(row);
  }
  const count=suggestions.filter(i=>i.selected).length;$('confirmSuggestions').disabled=count===0||suggestions.some(i=>i.selected&&i.conflict);$('confirmSuggestions').textContent=`Adicionar ${count} ${count===1?'item':'itens'}`;
}
function selectedNotes(id){const field=$(id),selection=field.value.slice(field.selectionStart,field.selectionEnd).trim();return selection||field.value;}
$('weekView').addEventListener('click',()=>setMode('week'));
$('weekGoals').addEventListener('input',()=>{getWeek(P.weekStart(selectedDate)).goals=$('weekGoals').value;markSaving();});
$('weekNotes').addEventListener('input',()=>{getWeek(P.weekStart(selectedDate)).notes=$('weekNotes').value;markSaving();});
$('weekAddBlock').addEventListener('click',()=>openBlock());
$('settingsButton').addEventListener('click',openFocusSettings);$('weekSettings').addEventListener('click',openFocusSettings);
$('copyMonday').addEventListener('click',()=>{
  try{P.validateAvailability(availabilityDraft);const monday=availabilityDraft.filter(w=>w.weekday===1);availabilityDraft=availabilityDraft.filter(w=>![2,3,4,5].includes(w.weekday));for(const weekday of [2,3,4,5])for(const w of monday)availabilityDraft.push({...w,weekday});renderAvailabilityEditor();$('focusError').textContent='';}catch(e){$('focusError').textContent=e.message;}
});
$('focusForm').addEventListener('submit',e=>{
  e.preventDefault();try{const windows=P.validateAvailability(availabilityDraft);state.settings.availability=windows;state.settings.focusConfigured=true;persist();renderAvailabilityBackground();if(state.settings.mode==='week')renderWeek();$('focusDialog').close();notify('Períodos salvos. As próximas sugestões usarão sua disponibilidade.');}catch(err){$('focusError').textContent=err.message;}
});
$('convertNotes').addEventListener('click',()=>openSuggestions(selectedNotes('notes')));
$('convertWeekNotes').addEventListener('click',()=>openSuggestions(selectedNotes('weekNotes'),true));
$('suggestScope').addEventListener('change',()=>{for(const item of suggestions)item.manual=false;recalculateSuggestions();});$('recalculateSuggestions').addEventListener('click',()=>{for(const item of suggestions)item.manual=false;recalculateSuggestions();});
$('suggestForm').addEventListener('submit',e=>{
  e.preventDefault();const selected=suggestions.filter(i=>i.selected);const titles=new Set();
  for(const item of selected){
    if(!item.title.trim()){$('suggestError').textContent='Preencha o título de cada item selecionado.';return;}
    const title=P.normalize(item.title.trim());
    if(titles.has(title)||P.findExisting({title:item.title,startDate:suggestStartDate,horizon:Number($('suggestScope').value),days:state.days})){$('suggestError').textContent='Um item selecionado já existe. Recalcule as sugestões para evitar duplicação.';return;}
    titles.add(title);
    if(item.destination==='block'){
      if(!item.slot){$('suggestError').textContent='Uma atividade selecionada não tem horário. Converta-a em tarefa ou ajuste a disponibilidade.';return;}
      const s=item.slot;
      if(!validDate(s.date)||s.start<0||s.end>1439){$('suggestError').textContent='O bloco precisa começar e terminar no mesmo dia, até 23:59.';return;}
    }
  }
  try{P.validateScheduledItems(selected,state.days);}catch(err){$('suggestError').textContent=err.message;return;}
  const added=[];
  for(const item of selected){
    const key=item.slot?.date||selectedDate,d=getDay(key),id=uid(),title=item.title.trim();
    if(item.destination==='task'){d.tasks.push({id,text:title,done:false,type:item.type,...DiaPriority.clean(item)});added.push({key,id,field:'tasks'});}
    else{d.events.push({id,title,start:item.slot.start,end:item.slot.end,type:item.type,color:P.TYPES[item.type].color,note:'Planejado a partir de uma anotação.',...DiaPriority.clean(item)});added.push({key,id,field:'events'});}
  }
  persist();renderDay();$('suggestDialog').close();notify(`${added.length} ${added.length===1?'item adicionado':'itens adicionados'}. Anotações preservadas.`,()=>{for(const a of added){const list=state.days[a.key]?.[a.field];if(list){const i=list.findIndex(v=>v.id===a.id);if(i>=0)list.splice(i,1);}}persist();renderDay();});
});
renderSettings();renderDay();
