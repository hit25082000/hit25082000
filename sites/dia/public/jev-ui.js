'use strict';
let jevConfigured=false,jevBusy=false,jevEntries=[],jevResults=[],jevRequest=null;
async function checkJev(){
 $('jevStatus').textContent='Verificando o backend…';$('runJev').disabled=true;
 try{const response=await fetch('/api/jev',{cache:'no-store',credentials:'same-origin'}),data=await response.json();
  if(!response.ok)throw new Error(data.message||'Não foi possível verificar o backend.');
  jevConfigured=data.configured===true;$('jevStatus').textContent=jevConfigured?'Segredo cadastrado no servidor. Uma análise confirmará o acesso à TypeSafe.':'Backend pronto; aguardando o segredo TYPESAFE_API_KEY no servidor.';
 }catch(err){jevConfigured=false;$('jevStatus').textContent=err.message;}
 $('runJev').disabled=!jevConfigured||jevBusy||!jevEntries.length;
}
function openJev(){
 jevEntries=Q.pending(state.days,selectedDate).map(({origin,task},i)=>({origin,id:task.id,text:task.text,dueDate:task.dueDate||'',purpose:task.purpose||'unclassified',priority:task.priority||2,selected:i<10}));
 jevResults=[];jevRequest=null;$('jevResults').replaceChildren();$('jevError').textContent='';
 const list=$('jevTaskSelection');list.replaceChildren();list.append(el('p','priority-explanation',jevEntries.length?jevEntries.length+' pendência(s). Selecione até 10 para esta análise.':'Adicione uma tarefa pendente para analisar.'));
 for(const entry of jevEntries){const label=el('label','jev-task-option'),check=el('input');check.type='checkbox';check.checked=entry.selected;check.setAttribute('aria-label','Enviar ao Jev: '+entry.text);check.addEventListener('change',()=>{if(check.checked&&jevEntries.filter(e=>e.selected).length>=10){check.checked=false;notify('Selecione até 10 tarefas por análise.');return;}entry.selected=check.checked;jevRequest=null;});label.append(check,el('span','',entry.text));list.append(label);}
 $('jevDialog').showModal();checkJev();
}
function showJevResults(){
 const target=$('jevResults');target.replaceChildren();target.append(el('p','priority-explanation','Sugestões do Jev recebidas. Você pode revisar cada categoria e prioridade; nada foi aplicado automaticamente.'));
 for(const result of jevResults){const row=el('article','purpose-suggestion'),check=el('input');check.type='checkbox';check.checked=result.apply;check.setAttribute('aria-label','Aplicar sugestão de '+result.entry.text);check.addEventListener('change',()=>{result.apply=check.checked;});
  const title=el('label','jev-result-title');title.append(check,el('strong','',result.entry.text));row.append(title);
  const purpose=purposeSelect(result.purpose,'Finalidade Jev: '+result.entry.text);purpose.addEventListener('change',()=>{result.purpose=purpose.value;});
  const priority=el('select');priority.setAttribute('aria-label','Prioridade Jev: '+result.entry.text);for(const [v,t]of [['','Manter prioridade atual'],['1','Alta'],['2','Média'],['3','Baixa']]){const o=el('option','',t);o.value=v;priority.append(o);}priority.value=result.priority===null?'':String(result.priority);priority.addEventListener('change',()=>{result.priority=priority.value?Number(priority.value):null;});
  row.append(purpose,priority,el('p','priority-explanation',`Confiança declarada pelo modelo: finalidade ${Math.round(result.purposeConfidence*100)}%; prioridade ${Math.round(result.priorityConfidence*100)}%.${result.needsReview?' Contexto incerto: revise antes de selecionar.':''}`));target.append(row);
 }
 const apply=el('button','primary-button','Aplicar sugestões selecionadas');apply.addEventListener('click',()=>{
  const changed=[],stale=[];
  for(const r of jevResults.filter(r=>r.apply)){const task=state.days[r.entry.origin]?.tasks.find(t=>t.id===r.entry.id);if(!task||task.done||task.text!==r.entry.text||(task.purpose||'unclassified')!==r.entry.purpose||(task.priority||2)!==r.entry.priority||(task.dueDate||'')!==r.entry.dueDate){stale.push(r);continue;}
   changed.push({task,purpose:task.purpose,priority:task.priority});task.purpose=r.purpose;if(r.priority!==null)task.priority=r.priority;
  }
  if(!changed.length){$('jevError').textContent=stale.length?'As tarefas mudaram desde a análise. Consulte novamente antes de aplicar.':'Selecione ao menos uma sugestão revisada.';return;}
  persist();renderDay();$('jevResults').replaceChildren();notify(`${changed.length} sugestão(ões) aplicada(s).${stale.length?' Itens alterados foram ignorados.':''}`,()=>{for(const r of changed){r.task.purpose=r.purpose;r.task.priority=r.priority;}persist();renderDay();});
 });target.append(apply);
}
async function runJev(){
 if(jevBusy)return;const entries=jevEntries.filter(e=>e.selected);if(!entries.length){$('jevError').textContent='Selecione uma tarefa.';return;}
 const payload={requestId:uid(),date:selectedDate,context:$('jevContext').value,tasks:entries.map(e=>({id:e.id,text:e.text,dueDate:e.dueDate}))};
 // No automatic retry: a failed call may already have consumed provider credits.
 jevRequest=payload;jevBusy=true;$('runJev').disabled=true;$('closeJev').disabled=true;$('jevError').textContent='';$('jevStatus').textContent='Consultando o Jev…';
 try{const response=await fetch('/api/jev',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)}),data=await response.json();
  if(!response.ok)throw new Error(data.message||'A análise não pôde ser concluída. Nenhuma tarefa foi alterada.');
  if(!Array.isArray(data.suggestions)||data.suggestions.length!==entries.length)throw new Error('Resposta incompleta. Nenhuma tarefa foi alterada.');
  jevResults=data.suggestions.map(r=>{const entry=entries.find(e=>e.id===r.id);if(!entry||!Object.hasOwn(Q.PURPOSES,r.purpose)||!(r.priority===null||[1,2,3].includes(r.priority))||!Number.isFinite(r.purposeConfidence)||!Number.isFinite(r.priorityConfidence))throw new Error('Resposta inválida. Nenhuma tarefa foi alterada.');return {...r,entry,apply:!r.needsReview};});
  $('jevStatus').textContent='Análise recebida do Jev. Revise as sugestões abaixo.';showJevResults();
 }catch(err){$('jevError').textContent=err.name==='TimeoutError'?'A consulta expirou. Aguarde e confira antes de tentar novamente.':err.message;$('jevStatus').textContent='Análise não concluída.';}
 finally{jevBusy=false;$('runJev').disabled=!jevConfigured;$('closeJev').disabled=false;}
}
$('jevSettingsButton').addEventListener('click',()=>{closeMenu();openJev();});$('analyzeWithJev').addEventListener('click',openJev);
$('closeJev').addEventListener('click',()=>{if(!jevBusy)$('jevDialog').close();});$('jevDialog').addEventListener('cancel',e=>{if(jevBusy)e.preventDefault();});
$('refreshJevStatus').addEventListener('click',checkJev);$('runJev').addEventListener('click',runJev);
