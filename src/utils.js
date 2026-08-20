// Shared utility/helper functions

export function emptyRow(){ return { key: 'row_'+Date.now()+'_'+Math.random(), item:'', qty:'', price:'' }; }

export function startOfWeek(dateStr){
  const d = new Date(dateStr+'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = (day===0 ? -6 : 1-day); // week starts Monday
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
export function addDays(dateStr,n){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}


export function monthKey(dateStr){ return dateStr.slice(0,7); } // "2026-01-15" -> "2026-01"

export function fmtMoney(n){ return (n<0?'\u2212':'') + Math.abs(n).toFixed(2); }

export function openReceivablesTotal(state, asOfMonth){
  return (state.ledger||[])
    .filter(l=> l.type==='receivable' && l.status==='open' && (!asOfMonth || monthKey(l.date)<=asOfMonth))
    .reduce((a,l)=>a+l.amount,0);
}
export function openPayablesTotal(state, asOfMonth){
  return (state.ledger||[])
    .filter(l=> l.type==='payable' && l.status==='open' && (!asOfMonth || monthKey(l.date)<=asOfMonth))
    .reduce((a,l)=>a+l.amount,0);
}

export function daysBetween(d1,d2){
  const a = new Date(d1+'T00:00:00'), b = new Date(d2+'T00:00:00');
  return Math.round((b-a)/(1000*60*60*24));
}

export function nextDueInfo(state, staffMember, today){
  const payments = state.payroll.filter(p=>p.staffId===staffMember.id).sort((a,b)=>b.date.localeCompare(a.date));
  const lastPaid = payments.length>0 ? payments[0].date : null;
  if(staffMember.frequency==='variable' || !lastPaid){
    return { label: lastPaid ? `Last paid ${lastPaid}` : 'Never paid yet', overdue:false, dueSoon:false };
  }
  const intervalDays = { daily:1, weekly:7, monthly:30 }[staffMember.frequency] || 30;
  const daysSince = daysBetween(lastPaid, today);
  const daysUntilDue = intervalDays - daysSince;
  if(daysUntilDue === 0){
    return { label: 'Due today', overdue:true, dueSoon:false };
  }
  if(daysUntilDue < 0){
    return { label: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue)===1?'':'s'}`, overdue:true, dueSoon:false };
  }
  if(daysUntilDue <= 2){
    return { label: `Due in ${daysUntilDue} day${daysUntilDue===1?'':'s'}`, overdue:false, dueSoon:true };
  }
  return { label: `Last paid ${lastPaid}`, overdue:false, dueSoon:false };
}

export function downloadJSON(data, filename){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function validateBackup(data){
  if(!data || typeof data !== 'object') return 'File doesn\u2019t look like a valid backup.';
  const requiredArrays = ['items','batches','sales','agents','expenses','ledger','staff','payroll'];
  for(const key of requiredArrays){
    if(!Array.isArray(data[key])) return `Missing or invalid "${key}" \u2014 this doesn\u2019t look like a Tanbuild backup file.`;
  }
  return null; // valid
}

