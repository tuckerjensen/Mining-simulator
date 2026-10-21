// v2 event engine: explicit empty routes, schedules, inventory, mass accounting.
function simulate(c,seed){
 const rand=random(seed), H=c.hours*60, shifts=c.shiftHours||12;
 const S=Object.fromEntries(c.sources.map(x=>[x.id,{...x,free:0,busy:0,wait:0,tons:0,loads:0,reserved:0}]));
 const D=Object.fromEntries(c.destinations.map(x=>[x.id,{...x,slots:Array(x.positions).fill(0),rateFree:0,busy:0,wait:0,tons:0,loads:0}]));
 const T=Object.fromEntries(c.trucks.map(x=>[x.id,{...x,loads:0,tons:0,loadWait:0,dumpWait:0,travel:0,service:0,delay:0}]));
 const F={}, pending={}, shiftsOut=Array(Math.ceil(c.hours/shifts)).fill(0);
 let events=[],seq=0,tons=0,loads=0,loadedTons=0,unfinished=0,dead=0;
 function add(time,kind,t,m={}){if(Number.isFinite(time)&&time<=H+10000)events.push({time,kind,t,m,seq:seq++})}
 function windows(kind,id,time){let out=time;for(let i=0;i<10;i++){let w=(c.windows||[]).find(w=>((w.kind===kind&&w.id===id)||(kind==='truck'&&w.kind==='ALL_TRUCKS'))&&w.start<=out&&w.end>out);if(!w)break;out=w.end}return out}
 function route(s,d){return c.routes.find(r=>r.source===s&&r.destination===d)}
 function empty(loc,s){if(!loc)return 0;let r=(c.emptyRoutes||[]).find(x=>x.destination===loc&&x.source===s);return r?r.minutes:Infinity}
 function rule(s,d){return(c.materialRules||[]).find(x=>x.source===s&&x.destination===d)||{targetShare:0,minTPH:0,maxTons:Infinity}}
 function feasible(t,s,d){let r=route(s,d);if(!r||!D[d].materials.includes(S[s].material)||!Number.isFinite(empty(t.loc,s)))return false;if(c.dispatch==='fixed'&&(t.fixedSource!==s||t.fixedDestination!==d))return false;let k=s+'|'+d,rr=rule(s,d);return S[s].reserved+t.payload<=(S[s].inventory??1e12)+1e-8&&(F[k]?.tons||0)+(pending[k]||0)+t.payload<=(rr.maxTons??Infinity)+1e-8}
 function choice(t,now){let best=null,bestScore=Infinity;for(let s of c.sources)for(let d of c.destinations){if(!feasible(t,s.id,d.id))continue;let r=route(s.id,d.id),back=empty(t.loc,s.id)/t.speedFactor,rr=rule(s.id,d.id),k=s.id+'|'+d.id,got=(F[k]?.tons||0)+(pending[k]||0);let total=Object.values(F).filter(f=>f.source===s.id).reduce((a,f)=>a+f.tons,0);let deficit=Math.max(0,(rr.minTPH||0)*now/60-got);let share=Math.max(0,(rr.targetShare||0)*(total+t.payload)-got);let score=back+Math.max(0,S[s.id].free-now)+s.loadMean+r.loaded/t.speedFactor+Math.max(0,Math.min(...D[d.id].slots)-now)+d.dumpMean-Math.min(18,deficit/Math.max(1,t.payload)*4)-Math.min(8,share/Math.max(1,t.payload)*2);if(score<bestScore){bestScore=score;best={s:s.id,d:d.id,back}}}return best}
 for(let type of c.trucks)for(let i=0;i<type.count;i++)add(0,'ready',{...type,loc:type.initialDestination||null});
 let iter=0;while(events.length){events.sort((a,b)=>a.time-b.time||a.seq-b.seq);let e=events.shift(),now=e.time,t=e.t;if(now>H)break;if(++iter>500000)throw Error('Simulation event limit exceeded');let st=T[t.id];
 if(e.kind==='ready'){
  let at=windows('truck',t.id,now);if(at>now){add(at,'ready',t);continue}let ch=choice(t,now);if(!ch){dead++;continue}S[ch.s].reserved+=t.payload;pending[ch.s+'|'+ch.d]=(pending[ch.s+'|'+ch.d]||0)+t.payload;
  let delay=rand()>(t.availability??1)?sample(25,.5,rand):0;if(t.mtbf>0&&t.mttr>0&&rand()<1-Math.exp(-Math.max(1,ch.back)/t.mtbf))delay+=sample(t.mttr,.5,rand);st.delay+=delay;st.travel+=ch.back;add(now+ch.back+delay,'atSource',t,ch)
 }else if(e.kind==='atSource'){
  let s=S[e.m.s],start=windows('source',s.id,Math.max(now,s.free)),service=sample(s.loadMean,s.loadCV,rand)/(s.availability||1);if(s.mtbf>0&&s.mttr>0&&rand()<1-Math.exp(-service/s.mtbf))service+=sample(s.mttr,.5,rand);s.free=start+service;s.wait+=start-now;st.loadWait+=start-now;st.service+=service;s.busy+=Math.max(0,Math.min(H,start+service)-start);add(start+service,'loaded',t,e.m)
 }else if(e.kind==='loaded'){
  loadedTons+=t.payload;S[e.m.s].reserved=Math.max(0,S[e.m.s].reserved-t.payload);S[e.m.s].inventory=(S[e.m.s].inventory??1e12)-t.payload;let r=route(e.m.s,e.m.d);st.travel+=r.loaded/t.speedFactor;add(now+r.loaded/t.speedFactor,'atDump',t,e.m)
 }else if(e.kind==='atDump'){
  let d=D[e.m.d],ix=d.slots.indexOf(Math.min(...d.slots)),start=windows('destination',d.id,Math.max(now,d.slots[ix],d.rateFree));let service=sample(d.dumpMean,d.dumpCV,rand);if(d.mtbf>0&&d.mttr>0&&rand()<1-Math.exp(-service/d.mtbf))service+=sample(d.mttr,.5,rand);let end=start+service;d.slots[ix]=end;d.rateFree=Math.max(d.rateFree,start)+t.payload*60/d.capTPH;d.wait+=start-now;st.dumpWait+=start-now;st.service+=service;d.busy+=Math.max(0,Math.min(H,end)-start);add(end,'done',t,e.m)
 }else if(e.kind==='done'){
  tons+=t.payload;loads++;let s=S[e.m.s],d=D[e.m.d],k=s.id+'|'+d.id,f=F[k]||(F[k]={source:s.id,destination:d.id,material:s.material,tons:0,loads:0});f.tons+=t.payload;f.loads++;s.tons+=t.payload;s.loads++;d.tons+=t.payload;d.loads++;st.tons+=t.payload;st.loads++;pending[k]-=t.payload;let ix=Math.min(shiftsOut.length-1,Math.floor(now/(shifts*60)));shiftsOut[ix]+=t.payload;t.loc=d.id;add(now,'ready',t)
 }}
 let cost=c.trucks.reduce((a,t)=>a+t.count*t.costPerHour*c.hours,0);let constraints=(c.materialRules||[]).map(r=>{let actual=F[r.source+'|'+r.destination]?.tons||0,minimum=(r.minTPH||0)*c.hours;return{...r,actual,minimum,shortfall:Math.max(0,minimum-actual),excess:Math.max(0,actual-(r.maxTons??Infinity))}});
 return{tons,loads,tph:tons/c.hours,cost,cpt:tons?cost/tons:0,sources:Object.values(S),destinations:Object.values(D),trucks:Object.values(T),flows:Object.values(F),count:c.trucks.reduce((a,x)=>a+x.count,0),hours:c.hours,shiftsOut,constraints,loadedTons,inTransit:loadedTons-tons,reservedTons:Object.values(S).reduce((a,s)=>a+s.reserved,0),dead};
}

