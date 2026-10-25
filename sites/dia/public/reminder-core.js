(function(root){
  'use strict';
  const TIMEZONE='America/Cuiaba';
  function validDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>='1900-01-01'&&date<='2100-12-31'&&!isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
  function validTime(time){return typeof time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);}
  function validateReminder(raw,newId){
    if(!raw||typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200||typeof raw.description!=='string'||raw.description.length>3000||!validDate(raw.date)||!validTime(raw.time)||raw.timezone!==TIMEZONE||typeof raw.done!=='boolean'||!['local','pending','confirmed','changed'].includes(raw.googleStatus))throw new Error('Lembrete inválido no backup.');
    const id=typeof raw.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(raw.id)?raw.id:newId();
    return {id,title:raw.title,description:raw.description,date:raw.date,time:raw.time,timezone:TIMEZONE,done:raw.done,googleStatus:raw.googleStatus};
  }
  function toUTC(date,time,timezone=TIMEZONE){
    if(!validDate(date)||!validTime(time))throw new Error('Confira a data e o horário do lembrete.');
    const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),target=Date.UTC(y,m-1,d,h,min);
    const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    let instant=target;
    for(let i=0;i<5;i++){
      const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
      const delta=target-Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute);
      if(!delta)return new Date(instant);instant+=delta;
    }
    throw new Error('Esse horário não existe no fuso selecionado.');
  }
  const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  function googleCalendarURL(reminder){
    const start=toUTC(reminder.date,reminder.time,reminder.timezone),end=new Date(start.getTime()+15*60000);
    const params=new URLSearchParams({action:'TEMPLATE',text:reminder.title,dates:stamp(start)+'/'+stamp(end),stz:reminder.timezone,etz:reminder.timezone,ctz:reminder.timezone,details:(reminder.description?reminder.description+'\n\n':'')+'Lembrete do Dia. Para receber no horário escolhido, configure uma notificação na hora do evento antes de salvar.'});
    return 'https://calendar.google.com/calendar/r/eventedit?'+params.toString();
  }
  const escapeICS=text=>text.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  function foldLine(text){
    const encoder=new TextEncoder(),lines=[];let line='',bytes=0;
    for(const char of text){const length=encoder.encode(char).length;if(bytes+length>75){lines.push(line);line=' ';bytes=1;}line+=char;bytes+=length;}
    lines.push(line);return lines.join('\r\n');
  }
  function calendarFile(reminder,now=new Date()){
    const start=toUTC(reminder.date,reminder.time,reminder.timezone),end=new Date(start.getTime()+15*60000);
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dia Planner//Lembretes//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+reminder.id+'@dia-planner','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(start),'DTEND:'+stamp(end),'SUMMARY:'+escapeICS(reminder.title),'DESCRIPTION:'+escapeICS(reminder.description),'TRANSP:TRANSPARENT','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M','DESCRIPTION:'+escapeICS(reminder.title),'END:VALARM','END:VEVENT','END:VCALENDAR'].map(foldLine).join('\r\n')+'\r\n';
  }
  const api={TIMEZONE,validDate,validTime,validateReminder,toUTC,googleCalendarURL,calendarFile};root.DiaReminder=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
