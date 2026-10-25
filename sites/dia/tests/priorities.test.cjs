const assert=require('node:assert/strict'),Q=require('./load-core.cjs')('../public/priority-core.js');
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('Old tasks remain unclassified until reviewed',()=>assert.deepEqual(Q.clean({}),{purpose:'unclassified',priority:2,dueDate:''}));
test('Gain and loss are distinct from deep and shallow work',()=>{assert.equal(Q.clean({purpose:'gain',type:'shallow'}).purpose,'gain');assert.equal(Q.clean({purpose:'loss',type:'deep'}).purpose,'loss');});
test('A real deadline takes precedence over an undated high-priority gain',()=>{assert.ok(Q.compare({purpose:'loss',priority:2,dueDate:'2026-10-25'},{purpose:'gain',priority:1,dueDate:''},'2026-10-25')<0);});
test('Gain wins when priority and deadline urgency are equal',()=>{assert.ok(Q.compare({purpose:'gain',priority:2},{purpose:'loss',priority:2},'2026-10-25')<0);});
test('Explicit high priority wins before gain tie-break',()=>{assert.ok(Q.compare({purpose:'loss',priority:1},{purpose:'gain',priority:2},'2026-10-25')<0);});
test('Pending list includes previous days, excludes completed and future non-due tasks',()=>{const old={id:'old',text:'Old',done:false,purpose:'gain'},done={text:'Done',done:true},future={text:'Future',done:false},due={text:'Due',done:false,dueDate:'2026-10-25'};const out=Q.pending({'2026-10-24':{tasks:[old,done]},'2026-10-27':{tasks:[future,due]}},'2026-10-25');assert.equal(out.length,2);assert.equal(out[0].task,due);assert.equal(out[1].task,old);});
test('Rules suggest categories without inventing priority or deadlines',()=>{assert.equal(Q.classify('Criar campanha de vendas').purpose,'gain');assert.equal(Q.classify('Corrigir falha no pagamento').purpose,'loss');assert.equal(Q.classify('Algo sem contexto').purpose,'unclassified');assert.equal(Q.classify('Enviar campanha').priority,undefined);});
test('Invalid metadata cannot silently overwrite classifications',()=>{assert.throws(()=>Q.clean({purpose:'fake'}));assert.throws(()=>Q.clean({priority:9}));assert.throws(()=>Q.clean({dueDate:'2026-02-30'}));});
console.log(n+' priority tests passed');
