'use strict';
const Q=DiaPriority;
let editingPriority=null,reviewSuggestions=[];
const PURPOSE_SHORT={gain:'Ganho',loss:'Prevenção',routine:'Rotina',unclassified:'Classificar'};
const PRIORITY_LABEL={1:'Alta',2:'Média',3:'Baixa'};
function purposeSelect(value,label){const s=el('select');s.setAttribute('aria-label',label);for(const [v,t]of Object.entries(Q.PURPOSES)){const o=el('option','',t);o.value=v;s.append(o);}s.value=value||'unclassified';return s;}
const renderTasksBeforePriority=renderTasks;
renderTasks=function(){
 renderTasksBeforePriority();
 for(const [i,task]of day().tasks.entries()){
  const row=$('taskList').children[i];if(!row)continue;
  const meta=el('button','task-purpose-badge purpose-'+(task.purpose||'unclassified'),PURPOSE_SHORT[task.purpose||'unclassified']+' · '+PRIORITY_LABEL[task.priority||2]);
  meta.type='button';meta.setAttribute('aria-label','Classificar e priorizar: '+task.text);meta.title=(task.dueDate?'Prazo: '+task.dueDate+' · ':'')+'Editar finalidade e prioridade';meta.addEventListener('click',()=>openPriority(selectedDate,task));row.append(meta);
 }
 renderPriorityOverview();
};
const updateProgressBeforePriority=updateProgress;
updateProgress=function(){updateProgressBeforePriority();renderPriorityOverview();};
const renderEventsBeforePriority=renderEvents;
renderEvents=function(){renderEventsBeforePriority();renderPriorityOverview();};
function renderPriorityOverview(){
 const d=day(),gain=d.tasks.filter(t=>t.purpose==='gain'),gainBlocks=d.events.filter(e=>e.purpose==='gain'),box=$('gainRequirement');box.replaceChildren();
 if(gain.some(t=>t.done)){box.className='gain-requirement fulfilled';box.append(el('strong','','Produção de ganho realizada'),el('span','',gain.filter(t=>t.done).length+' tarefa(s) concluída(s).'));}
 else if(gain.length||gainBlocks.length){box.className='gain-requirement planned';box.append(el('strong','','Produção de ganho presente'),el('span','',(gain.length?gain.length+' tarefa(s) pendente(s)':'')+(gain.length&&gainBlocks.length?' · ':'')+(gainBlocks.length?gainBlocks.length+' bloco(s) reservado(s)':'')));}
 else{box.className='gain-requirement missing';box.append(el('strong','','Falta uma produção de ganho neste dia'),el('span','','Escolha ao menos uma ação que crie resultado futuro.'));const add=el('button','','+ Adicionar ganho');add.addEventListener('click',()=>{$('newTaskPurpose').value='gain';$('taskInput').focus();});box.append(add);}
 const preview=$('pendingPreview');preview.replaceChildren();const pending=Q.pending(state.days,selectedDate),gains=pending.filter(p=>p.task.purpose==='gain');
 if(gains.length){const best=el('div','best-gain');best.append(el('span','','Ganho prioritário pendente'),el('strong','',gains[0].task.text));const inspect=el('button','','Revisar');inspect.addEventListener('click',()=>openPriority(gains[0].origin,gains[0].task));best.append(inspect);preview.append(best);}
 if(!pending.length)preview.append(el('p','priority-explanation','Nenhuma tarefa pendente até este dia.'));
 for(const entry of pending.slice(0,3))preview.append(pendingCard(entry,true));
 if(pending.length>3){const more=el('button','priority-link','Ver '+pending.length+' pendências');more.addEventListener('click',openPending);preview.append(more);}
 if($('pendingDialog').open)renderPending();
}
function pendingCard({origin,task},compact=false){
 const row=el('article','pending-card'+(compact?' compact':''));
 row.append(el('div','pending-purpose purpose-'+(task.purpose||'unclassified'),Q.PURPOSES[task.purpose||'unclassified']+' · '+PRIORITY_LABEL[task.priority||2]),el('strong','',task.text));
 const when=task.dueDate?'Prazo '+task.dueDate+(task.dueDate<selectedDate?' · atrasado':task.dueDate===selectedDate?' · hoje':''):'Sem prazo definido';row.append(el('p','',when+' · anotada em '+origin));
 const actions=el('div','pending-actions'),edit=el('button','','Editar');edit.setAttribute('aria-label','Editar pendência: '+task.text);edit.addEventListener('click',()=>openPriority(origin,task));actions.append(edit);
 if(origin!==selectedDate){const move=el('button','','Trazer para este dia');move.setAttribute('aria-label','Trazer para este dia: '+task.text);move.addEventListener('click',()=>{
  const from=state.days[origin].tasks,index=from.findIndex(t=>t.id===task.id);if(index<0)return;
  if(getDay(selectedDate).tasks.some(t=>t.id===task.id)){notify('Esta tarefa já está no dia.');return;}
  from.splice(index,1);getDay(selectedDate).tasks.push(task);const target=selectedDate;persist();renderDay();notify('Tarefa movida para o dia selecionado, sem duplicar.',()=>{const items=state.days[target].tasks,ix=items.findIndex(t=>t.id===task.id);if(ix>=0){items.splice(ix,1);state.days[origin].tasks.splice(index,0,task);}persist();renderDay();});
 });actions.append(move);}
 if(!compact){const finish=el('button','','Concluir');finish.setAttribute('aria-label','Concluir pendência: '+task.text);finish.addEventListener('click',()=>{task.done=true;persist();renderDay();});actions.append(finish);}
 row.append(actions);return row;
}
function openPriority(origin,task){
 editingPriority={origin,id:task.id};$('priorityTaskText').value=task.text;$('taskPurpose').value=task.purpose||'unclassified';$('taskPriority').value=task.priority||2;$('taskDueDate').value=task.dueDate||'';$('taskPriorityDialog').showModal();
}
function openPending(){reviewSuggestions=[];$('purposeSuggestions').replaceChildren();renderPending();$('pendingDialog').showModal();}
function renderPending(){const list=$('pendingAll');list.replaceChildren();const pending=Q.pending(state.days,selectedDate);if(!pending.length)list.append(el('p','priority-explanation','Sem pendências até o dia selecionado.'));for(const entry of pending)list.append(pendingCard(entry));}
$('reviewPending').addEventListener('click',openPending);
$('taskPriorityForm').addEventListener('submit',e=>{e.preventDefault();const task=state.days[editingPriority.origin]?.tasks.find(t=>t.id===editingPriority.id);if(!task){$('taskPriorityDialog').close();return;}const deadline=$('taskDueDate').value;if(deadline&&!validDate(deadline))return;task.text=$('priorityTaskText').value.trim();if(!task.text)return;Object.assign(task,{purpose:$('taskPurpose').value,priority:Number($('taskPriority').value),dueDate:deadline});persist();$('taskPriorityDialog').close();renderDay();});
$('suggestPurposes').addEventListener('click',()=>{
 reviewSuggestions=Q.pending(state.days,selectedDate).filter(p=>!p.task.purpose||p.task.purpose==='unclassified').map(p=>({...p,...Q.classify(p.task.text)}));const target=$('purposeSuggestions');target.replaceChildren();
 target.append(el('p','priority-explanation','Sugestões locais por palavras-chave. Revise antes de aplicar; tarefas já classificadas não serão alteradas.'));
 if(!reviewSuggestions.length){target.append(el('p','priority-explanation','Todas as pendências já têm categoria.'));return;}
 for(const item of reviewSuggestions){const card=el('div','purpose-suggestion');card.append(el('strong','',item.task.text));const select=purposeSelect(item.purpose,'Categoria sugerida: '+item.task.text);select.addEventListener('change',()=>{item.purpose=select.value;});card.append(select,el('p','priority-explanation',item.reason));target.append(card);}
 const apply=el('button','primary-button','Aplicar categorias revisadas');apply.addEventListener('click',()=>{const changes=[];for(const item of reviewSuggestions){const task=state.days[item.origin]?.tasks.find(t=>t.id===item.task.id);if(task&&(!task.purpose||task.purpose==='unclassified')){changes.push({task,before:task.purpose});task.purpose=item.purpose;}}persist();target.replaceChildren();renderDay();notify('Categorias aplicadas. Prioridades e prazos preservados.',()=>{for(const change of changes)change.task.purpose=change.before;persist();renderDay();});});target.append(apply);
});
renderTasks();renderPriorityOverview();
