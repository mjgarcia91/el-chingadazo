// Shared by the browser and Worker. Honduras uses UTC-6 without daylight saving.
(() => {
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const minutes = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '') ? Number(time.slice(0,2))*60+Number(time.slice(3)) : null;
  function validate(week) {
    if (!week || typeof week !== 'object') return false;
    return days.every((_,i) => {
      const day = week[i];
      return day && typeof day.closed === 'boolean' && (day.closed || (minutes(day.open)!==null && minutes(day.close)!==null && day.open!==day.close));
    });
  }
  function intervals(week,date=new Date()) {
    if (!validate(week)) return [];
    const local = new Date(date.getTime()-6*3600000);
    const midnight = Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())+6*3600000;
    const result=[];
    for(let offset=-1;offset<=7;offset++) {
      const day=week[(local.getUTCDay()+offset+7)%7];
      if(day.closed) continue;
      const open=minutes(day.open),close=minutes(day.close);
      result.push({start:midnight+offset*86400000+open*60000,end:midnight+offset*86400000+(close+(close<open?1440:0))*60000});
    }
    return result;
  }
  function active(settings,date=new Date()) { return intervals(settings.weeklyHours,date).find(slot=>date.getTime()>=slot.start&&date.getTime()<slot.end)||null; }
  function next(settings,date=new Date()) { return intervals(settings.weeklyHours,date).find(slot=>slot.start>date.getTime())?.start||null; }
  const format = stamp => new Date(stamp).toLocaleTimeString('es-HN',{timeZone:'America/Tegucigalpa',hour:'numeric',minute:'2-digit',hour12:true});
  globalThis.ChingadazoHours = {days,validate,active,next,format};
})();
