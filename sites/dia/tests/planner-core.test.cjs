const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const P=require('./load-core.cjs')('../public/planner-core.js');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const availability=P.defaultAvailability();
const base={type:'deep',duration:60,startDate:'2026-10-26',horizon:7,availability,days:{},today:'2026-10-25',nowMinute:0};
test('Monday week boundaries, including Sunday and new year',()=>{assert.equal(P.weekStart('2026-10-25'),'2026-10-19');assert.equal(P.weekStart('2027-01-01'),'2026-12-28');});
test('Classify and preserve note text with explicit durations',()=>{const items=P.parseNotes('- Desenvolver Gaby 90min\nResponder e-mails 30min\nJogar 1h');assert.deepEqual(items.map(i=>[i.type,i.duration]),[['deep',90],['shallow',30],['enjoy',60]]);assert.equal(items[0].title,'Desenvolver Gaby 90min');});
test('A clock mention is not interpreted as a duration',()=>{assert.equal(P.parseNotes('Responder mensagens às 15h')[0].duration,30);});
test('Ignore headings and duplicate note lines',()=>{assert.equal(P.parseNotes('# Plano\nTarefas:\nCriar projeto\nCriar projeto').length,1);});
test('First compatible focus window',()=>{assert.deepEqual(P.suggestSlot(base),{date:'2026-10-26',start:540,end:600});});
test('Existing commitments are excluded regardless of category',()=>{assert.equal(P.suggestSlot({...base,days:{'2026-10-26':{events:[{start:540,end:600,type:'other'}]}}}).start,600);});
test('Conflicts and exact window ending',()=>{assert.equal(P.suggestSlot({...base,days:{'2026-10-26':{events:[{start:540,end:615}]}}}).date,'2026-10-27');});
test('Reservations prevent suggestions from overlapping one another',()=>{assert.equal(P.suggestSlot({...base,reserved:[{date:'2026-10-26',start:540,end:600}]}).start,600);});
test('Full day falls forward only within the search horizon',()=>{assert.equal(P.suggestSlot({...base,horizon:1,duration:180}),null);assert.equal(P.suggestSlot({...base,days:{'2026-10-26':{events:[{start:540,end:660}]}}}).date,'2026-10-27');});
test('Do not recommend elapsed times or dates',()=>{assert.equal(P.suggestSlot({...base,today:'2026-10-26',nowMinute:590}).start,600);assert.equal(P.suggestSlot({...base,today:'2026-11-15'}),null);});
test('No availability does not invent a slot',()=>{assert.equal(P.suggestSlot({...base,availability:[]}),null);assert.equal(P.suggestSlot({...base,startDate:'2026-10-25',horizon:1}),null);});
test('Enjoyment follows the last work period and work commitment',()=>{const slot=P.suggestSlot({...base,type:'enjoy',days:{'2026-10-26':{events:[{start:1080,end:1170,color:'blue'}]}}});assert.equal(slot.start,1170);});
test('Enjoyment before work ends is rejected',()=>{assert.equal(P.suggestSlot({...base,type:'enjoy',horizon:1,availability:[{weekday:1,start:540,end:600,type:'enjoy'},{weekday:1,start:600,end:900,type:'deep'}]}),null);});
test('Reject invalid or overlapping focus settings',()=>{assert.throws(()=>P.validateAvailability([{weekday:1,start:600,end:590,type:'deep'}]));assert.throws(()=>P.validateAvailability([{weekday:1,start:540,end:660,type:'deep'},{weekday:1,start:600,end:720,type:'shallow'}]));assert.throws(()=>P.validateAvailability([{weekday:1,start:NaN,end:660,type:'deep'}]));});
function migrate(input){const src=fs.readFileSync(__dirname+'/../public/app.js','utf8').split('let state=freshState()')[0];return vm.runInNewContext(src+'\nvalidateState(input)',{DiaPlan:P,DiaPriority:require('./load-core.cjs')('../public/priority-core.js'),DiaReminder:require('./load-core.cjs')('../public/reminder-core.js'),input,crypto:require('node:crypto').webcrypto});}
const old={version:1,days:{'2026-10-26':{notes:'Nota original',mainPriority:'Entrega',priorityDone:false,remember:'Lembrete',tasks:[{id:'t',text:'Tarefa original',done:true}],events:[{id:'e',title:'Antigo',start:540,end:600,note:'Detalhe original',color:'blue'}]}},settings:{mode:'day',theme:'dark',notesWidth:48,planWidth:25}};
test('Migrate original data without losing notes, tasks, colors or completion',()=>{const out=migrate(old);assert.equal(out.days['2026-10-26'].notes,'Nota original');assert.equal(out.days['2026-10-26'].tasks[0].done,true);assert.equal(out.days['2026-10-26'].events[0].note,'Detalhe original');assert.equal(out.days['2026-10-26'].events[0].color,'blue');assert.equal(out.days['2026-10-26'].events[0].type,'deep');assert.equal(out.settings.theme,'dark');assert.equal(out.settings.availability.length,15);});
test('Round-trip weekly notes and custom focus availability',()=>{const input=JSON.parse(JSON.stringify(old));input.weeks={'2026-10-26':{goals:'Resultado principal',notes:'Notas semanais'}};input.settings={...input.settings,mode:'week',availability:[{weekday:1,start:480,end:600,type:'deep'}],focusConfigured:true};input.days['2026-10-26'].tasks[0].type='shallow';const out=migrate(input);assert.equal(out.weeks['2026-10-26'].notes,'Notas semanais');assert.equal(out.settings.availability[0].start,480);assert.equal(out.settings.focusConfigured,true);assert.equal(out.settings.mode,'week');assert.equal(out.days['2026-10-26'].tasks[0].type,'shallow');});
test('Reject malformed weekly backup instead of dropping data',()=>{const input=JSON.parse(JSON.stringify(old));input.weeks={'2026-10-27':{goals:'Wrong anchor',notes:''}};assert.throws(()=>migrate(input));});
const suggestion=(id,title,extra={})=>({id,title,type:'deep',duration:60,selected:true,destination:'block',slot:null,...extra});
const reportDays={'2026-10-26':{tasks:[],events:[{id:'a',title:'Preparar campanhas',start:480,end:540,type:'deep'},{id:'b',title:'Aprimorar UX e minuta',start:540,end:600,type:'deep'}]}};
test('Regression: existing screenshot items show their actual times, not the same new suggestion',()=>{
 const out=P.planSuggestions([suggestion('1','Preparar campanhas'),suggestion('2','Aprimorar UX e minuta')],{...base,days:reportDays});
 assert.deepEqual(out.map(i=>[i.selected,i.slot,i.existing.start]),[[false,null,480],[false,null,540]]);
});
test('Existing task has no invented appointment time',()=>{
 const out=P.planSuggestions([suggestion('1','Já foi criada')],{...base,days:{'2026-10-26':{tasks:[{text:'Já foi criada'}]}}});
 assert.equal(out[0].existing.kind,'task');assert.equal(out[0].existing.start,undefined);assert.equal(out[0].slot,null);
});
test('Two newly selected blocks receive different consecutive slots',()=>{
 const out=P.planSuggestions([suggestion('1','Preparar campanhas'),suggestion('2','Aprimorar UX')],base);
 assert.deepEqual(out.map(i=>i.slot.start),[540,600]);P.validateScheduledItems(out,{});
});
test('Two task recommendations also receive different times',()=>{
 const out=P.planSuggestions([suggestion('1','Primeira',{destination:'task'}),suggestion('2','Segunda',{destination:'task'})],base);
 assert.deepEqual(out.map(i=>i.slot.start),[540,600]);
});
test('Manual choice later in the list is reserved before earlier automatic rows',()=>{
 const manual={date:'2026-10-26',start:540,end:600};
 const out=P.planSuggestions([suggestion('1','Automática'),suggestion('2','Manual',{manual:true,slot:manual})],base);
 assert.equal(out[0].slot.start,600);assert.equal(out[1].conflict,false);
});
test('Colliding manual choices are marked and cannot pass confirmation',()=>{
 const slot={date:'2026-10-26',start:540,end:600};const out=P.planSuggestions([suggestion('1','A',{manual:true,slot}),suggestion('2','B',{manual:true,slot})],base);
 assert.ok(out.every(i=>i.conflict));assert.throws(()=>P.validateScheduledItems(out,{}));
});
test('Final confirmation independently rejects overlapping auto suggestions',()=>{
 const slot={date:'2026-10-26',start:540,end:600};assert.throws(()=>P.validateScheduledItems([suggestion('1','A',{slot}),suggestion('2','B',{slot})],{}));
});
test('Final confirmation checks an existing event that moved into the slot',()=>{
 const item=suggestion('1','Nova',{slot:{date:'2026-10-26',start:540,end:600}});assert.throws(()=>P.validateScheduledItems([item],reportDays));
});
test('Unselected preview does not compete with selected items',()=>{
 const out=P.planSuggestions([suggestion('1','A',{selected:false}),suggestion('2','B')],base);assert.equal(out[0].slot,null);assert.equal(out[1].slot.start,540);
});
test('Reopening notes never resets existing appointments to a suggested shared time',()=>{
 const items=[suggestion('1','Preparar campanhas',{manual:true,slot:{date:'2026-10-26',start:600,end:660}}),suggestion('2','Aprimorar UX e minuta',{manual:true,slot:{date:'2026-10-26',start:600,end:660}})];
 const once=P.planSuggestions(items,{...base,days:reportDays});const twice=P.planSuggestions(once,{...base,days:reportDays});assert.ok(twice.every(i=>i.slot===null&&!i.selected));assert.deepEqual(twice.map(i=>i.existing.start),[480,540]);
});
console.log(count+' tests passed');
