let enabled=false;
const key='cdd-statistics-v1';
export function analyticsChoice(): {accepted:boolean;at:string}|null {
  try {const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&typeof value.accepted==='boolean'&&Number.isFinite(Date.parse(value.at))&&Date.now()-Date.parse(value.at)<180*86400000)return value;
    localStorage.removeItem('cdd-visitor');sessionStorage.removeItem('cdd-session');return null;}catch{return null;}
}
export function setAnalyticsChoice(accepted:boolean){
  const choice={accepted,at:new Date().toISOString()};
  try{localStorage.setItem(key,JSON.stringify(choice));if(!accepted){localStorage.removeItem('cdd-visitor');sessionStorage.removeItem('cdd-session');}}catch{}
  window.dispatchEvent(new Event('analytics-choice'));
}
export function enableAnalytics(value:boolean){enabled=value;}
export function trackAnalytics(action:string,detail:Record<string,string|undefined>={}) {
  if(!enabled||navigator.doNotTrack==='1'||!analyticsChoice()?.accepted)return;
  try {
    let visitorId=localStorage.getItem('cdd-visitor');if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem('cdd-visitor',visitorId);}
    let session=JSON.parse(sessionStorage.getItem('cdd-session')||'null');
    const fresh=!session||Date.now()-session.last>30*60000;
    if(fresh)session={id:crypto.randomUUID(),last:Date.now()};
    session.last=Date.now();sessionStorage.setItem('cdd-session',JSON.stringify(session));
    const send=(kind:string,dimensions:Record<string,string|undefined>)=>void fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
      body:JSON.stringify({id:crypto.randomUUID(),visitorId,sessionId:session.id,consentAt:analyticsChoice()!.at,action:kind,...dimensions})}).catch(()=>{});
    if(fresh&&action!=='visit')send('visit',{});
    send(action,detail);
  }catch{/* Storage restrictions must never interrupt the website. */}
}
