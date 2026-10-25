(function(root){
 'use strict';
 const PURPOSES={gain:'Produção de ganho',loss:'Prevenção de perda',routine:'Rotina / pessoal',unclassified:'A classificar'};
 function clean(task){
  if(task.purpose!==undefined&&!Object.hasOwn(PURPOSES,task.purpose))throw new Error('Categoria de tarefa inválida.');
  if(task.priority!==undefined&&![1,2,3].includes(task.priority))throw new Error('Prioridade inválida.');
  if(task.dueDate!==undefined&&task.dueDate!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)||isNaN(Date.parse(task.dueDate+'T12:00:00Z'))||new Date(task.dueDate+'T12:00:00Z').toISOString().slice(0,10)!==task.dueDate))throw new Error('Prazo inválido.');
  return {purpose:task.purpose||'unclassified',priority:task.priority||2,dueDate:task.dueDate||''};
 }
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function classify(text){
  const s=norm(text);
  if(/\[perda\]|prevenir|evitar perda|corrigir|falha|backup|vencimento|renovar contrato|reclamacao|cobranca|prazo legal/.test(s))return {purpose:'loss',reason:'O texto indica proteção de uma entrega, prazo ou operação.'};
  if(/\[ganho\]|produ[cç]ao de ganho|vender|prospectar|prospeccao|campanha|criativo|oferta|receita|conversao|lancar|desenvolver|implementar|produto|proposta comercial/.test(s))return {purpose:'gain',reason:'O texto indica venda, criação ou melhoria com potencial de resultado.'};
  if(/descans|jogar|familia|lazer|pessoal|email|mensagen|organizar arquivo/.test(s))return {purpose:'routine',reason:'O texto parece descrever rotina ou atividade pessoal.'};
  return {purpose:'unclassified',reason:'Não há contexto suficiente. Escolha a categoria manualmente.'};
 }
 function compare(a,b,date){
  const urgent=t=>t.dueDate&&t.dueDate<=date?0:1;
  return urgent(a)-urgent(b)||(a.priority||2)-(b.priority||2)||({gain:0,loss:1,routine:2,unclassified:3}[a.purpose||'unclassified']-({gain:0,loss:1,routine:2,unclassified:3}[b.purpose||'unclassified']))||(a.dueDate||'9999').localeCompare(b.dueDate||'9999');
 }
 function pending(days,date){return Object.entries(days).flatMap(([origin,d])=>(d.tasks||[]).filter(t=>!t.done&&(origin<=date||(t.dueDate&&t.dueDate<=date))).map(task=>({origin,task}))).sort((a,b)=>compare(a.task,b.task,date)||a.origin.localeCompare(b.origin));}
 const api={PURPOSES,clean,classify,compare,pending};root.DiaPriority=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
