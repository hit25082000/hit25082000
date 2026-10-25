(function(root){
  'use strict';
  const TYPES={deep:{label:'Deep work',color:'blue',duration:60},shallow:{label:'Shallow work',color:'olive',duration:30},enjoy:{label:'Desfrute',color:'amber',duration:60},other:{label:'Outro',color:'rose',duration:30}};
  const dateKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const shiftDate=(key,n)=>{const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+n);return dateKey(d);};
  const weekStart=key=>{const d=new Date(key+'T12:00:00');return shiftDate(key,-((d.getDay()+6)%7));};
  const defaultAvailability=()=>Array.from({length:5},(_,i)=>[
    {weekday:i+1,start:540,end:660,type:'deep'},
    {weekday:i+1,start:840,end:1020,type:'shallow'},
    {weekday:i+1,start:1140,end:1260,type:'enjoy'}
  ]).flat();
  const eventType=e=>Object.hasOwn(TYPES,e.type)?e.type:({blue:'deep',olive:'shallow',amber:'enjoy',rose:'other'}[e.color]||'other');
  function validateAvailability(rows){
    if(!Array.isArray(rows)||rows.length>140)throw new Error('Use até 140 períodos na semana.');
    const out=rows.map(r=>{if(!r||!Number.isInteger(r.weekday)||r.weekday<0||r.weekday>6||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end>1440||r.end-r.start<15||!Object.hasOwn(TYPES,r.type)||r.type==='other')throw new Error('Cada período precisa ter pelo menos 15 minutos, no mesmo dia.');return {weekday:r.weekday,start:r.start,end:r.end,type:r.type};});
    for(let i=0;i<7;i++){const day=out.filter(r=>r.weekday===i).sort((a,b)=>a.start-b.start);if(day.some((r,j)=>j&&r.start<day[j-1].end))throw new Error('Os períodos de disponibilidade não podem se sobrepor no mesmo dia.');}
    return out.sort((a,b)=>a.weekday-b.weekday||a.start-b.start);
  }
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function parseNotes(text){
    const seen=new Set();
    return text.split(/\n+/).map(l=>l.trim().replace(/^\s*(?:[-*•]\s*(?:\[[ xX]\]\s*)?|\d+[.)]\s*)/,'')).filter(l=>l&&!/^#{1,6}\s/.test(l)&&!(l.endsWith(':')&&l.length<65)).filter(l=>{const key=normalize(l);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,40).map(title=>{
      const n=normalize(title);
      let type='deep',reason='Concentração e execução; revise o tipo se necessário.';
      if(/\b(descans|desfrut|jogar|jogo|filme|serie|netflix|passear|lazer|familia|caminhar|relax|jantar)/.test(n)){type='enjoy';reason='Lazer ou descanso, sugerido após os períodos de trabalho.';}
      else if(/\b(responder|email|e-mail|whatsapp|mensage|reuniao|ligar|pagar|agendar|organizar|nota fiscal|revisar inbox|atendimento|administrativ|orcamento)/.test(n)){type='shallow';reason='Atividade operacional ou de comunicação.';}
      else if(/\b(desenvolver|programar|implementar|criar|estudar|escrever|arquitet|planejar|analisar|resolver)/.test(n))reason='Criação, análise ou estudo: pede um bloco de concentração.';
      let duration=TYPES[type].duration;
      for(const match of title.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(horas?|h|minutos?|min)\b/gi)){
        if(/(?:as|às|das|de)\s*$/i.test(title.slice(Math.max(0,match.index-5),match.index)))continue;
        duration=Math.round(Number(match[1].replace(',','.'))*(match[2].toLowerCase().startsWith('h')?60:1));break;
      }
      duration=Math.min(480,Math.max(15,duration));
      return {title:title.slice(0,200),type,duration,reason};
    });
  }
  function suggestSlot({type,duration,startDate,horizon=7,availability,days,today,nowMinute=0,reserved=[]}){
    if(!Object.hasOwn(TYPES,type)||!Number.isInteger(duration)||duration<15||duration>480)return null;
    for(let offset=0;offset<horizon;offset++){
      const date=shiftDate(startDate,offset);if(date<today)continue;
      const weekday=new Date(date+'T12:00:00').getDay();
      const windows=availability.filter(w=>w.weekday===weekday&&w.type===type).sort((a,b)=>a.start-b.start);
      const workEnd=Math.max(0,...availability.filter(w=>w.weekday===weekday&&(w.type==='deep'||w.type==='shallow')).map(w=>w.end),...(days[date]?.events||[]).filter(e=>['deep','shallow'].includes(eventType(e))).map(e=>e.end));
      const busy=[...(days[date]?.events||[]),...reserved.filter(r=>r.date===date)].sort((a,b)=>a.start-b.start);
      for(const window of windows){
        let start=Math.ceil(Math.max(window.start,date===today?nowMinute:0,type==='enjoy'?workEnd:0)/15)*15;
        for(const b of busy){if(start+duration<=b.start)break;if(start<b.end&&start+duration>b.start)start=Math.ceil(b.end/15)*15;}
        if(start+duration<=window.end)return {date,start,end:start+duration};
      }
    }
    return null;
  }
  function findExisting({title,startDate,horizon=7,days}){
    const needle=normalize(title.trim());
    if(!needle)return null;
    const dates=Array.from({length:horizon},(_,i)=>shiftDate(startDate,i));
    for(const date of dates){const event=(days[date]?.events||[]).find(e=>normalize(e.title.trim())===needle);if(event)return {kind:'event',date,id:event.id,start:event.start,end:event.end};}
    for(const date of dates){const task=(days[date]?.tasks||[]).find(t=>normalize(t.text.trim())===needle);if(task)return {kind:'task',date,id:task.id};}
    return null;
  }
  const overlaps=(a,b)=>a.start<b.end&&a.end>b.start;
  function planSuggestions(items,options){
    const result=items.map(item=>{
      const existing=findExisting({...options,title:item.title});
      return {...item,existing,duplicate:!!existing,selected:existing?false:item.selected,slot:existing?null:item.slot,conflict:false};
    });
    // Reserve every selected manual choice first, including choices later in the list.
    // Automatic recommendations can then move around them without depending on row order.
    const manual=result.filter(i=>i.selected&&i.manual&&i.slot).map(i=>({...i.slot,itemId:i.id}));
    const reserved=[...manual];
    for(const item of result){
      if(item.duplicate||!item.selected)continue;
      if(item.manual&&item.slot){
        const s=item.slot;
        item.conflict=s.start<0||s.end>1439||s.end-s.start!==item.duration||[...(options.days[s.date]?.events||[]),...manual.filter(r=>r.itemId!==item.id&&r.date===s.date)].some(b=>overlaps(s,b));
      }else{
        item.slot=suggestSlot({...options,type:item.type,duration:item.duration,reserved});
        // A visible recommendation gets its own place, even for a task that has
        // not yet been confirmed as a calendar block.
        if(item.slot)reserved.push({...item.slot,itemId:item.id});
      }
    }
    return result;
  }
  function validateScheduledItems(items,days){
    const reserved=[];
    for(const item of items.filter(i=>i.selected&&i.destination==='block')){
      const s=item.slot;
      if(!s)throw new Error('Uma atividade selecionada não tem horário. Converta-a em tarefa ou ajuste a disponibilidade.');
      if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>1439||s.end-s.start!==item.duration)throw new Error('Confira o início, o fim e a duração dos blocos selecionados.');
      if([...(days[s.date]?.events||[]),...reserved.filter(r=>r.date===s.date)].some(b=>overlaps(s,b)))throw new Error('Dois blocos ocupam o mesmo horário. Ajuste o início ou recalcule antes de confirmar.');
      reserved.push(s);
    }
  }
  const api={TYPES,dateKey,shiftDate,weekStart,defaultAvailability,eventType,validateAvailability,parseNotes,suggestSlot,normalize,findExisting,planSuggestions,validateScheduledItems};
  root.DiaPlan=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
