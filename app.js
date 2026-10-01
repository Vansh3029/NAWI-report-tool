'use strict';
/* ===================== storage & helpers ===================== */
const mem={};
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):(k in mem?mem[k]:d)}catch(e){return k in mem?mem[k]:d}},set(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rd=x=>Math.round(x*1e6)/1e6;
const nn=v=>(v===''||v==null||isNaN(+v))?null:+v;
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setp=(o,p,v)=>{const ks=p.split('.');const l=ks.pop();ks.reduce((a,k)=>a[k],o)[l]=v};
const decs=x=>{const s=String(+x);if(s.indexOf('e-')>0)return +s.split('e-')[1];const i=s.indexOf('.');return i<0?0:s.length-i-1};
const fx=(x,p)=>(x==null||!isFinite(x))?'—':(+x).toFixed(p);
const fs=(x,p)=>{if(x==null||!isFinite(x))return '—';const s=(+x).toFixed(p);return (x>1e-9?'+':'')+s};
const clone=o=>JSON.parse(JSON.stringify(o));

/* ===================== rule set (editable, versioned) ===================== */
const DEFAULT_RULES={
 edition:"OIML R 76-1:2006 (E)",
 note:"Verify every value against the current OIML R 76 edition.",
 classes:{
  I:{name:"Special",bands:[[50000,0.5],[200000,1],[null,1.5]],minMult:100,tempC:1,n:[{eMinG:0.001,eMaxG:null,min:50000,max:null}]},
  II:{name:"High",bands:[[5000,0.5],[20000,1],[null,1.5]],minMult:20,minMultIfELt1g:50,tempC:2,n:[{eMinG:0.001,eMaxG:0.05,min:100,max:100000},{eMinG:0.1,eMaxG:null,min:5000,max:100000}]},
  III:{name:"Medium",bands:[[500,0.5],[2000,1],[null,1.5]],minMult:20,tempC:5,n:[{eMinG:0.1,eMaxG:2,min:100,max:10000},{eMinG:5,eMaxG:null,min:500,max:10000}]},
  IIII:{name:"Ordinary",bands:[[50,0.5],[200,1],[null,1.5]],minMult:10,tempC:5,n:[{eMinG:5,eMaxG:null,min:100,max:1000}]}
 }
};
let RULES=store.get('nawi.rules.v1',null)||clone(DEFAULT_RULES);
const mpe=(cls,L,e)=>{const c=RULES.classes[cls];const m=L/e+1e-9;for(const b of c.bands){if(b[0]==null||m<=b[0])return b[1]*e}return c.bands[c.bands.length-1][1]*e};
const eGrams=i=>+i.e*(i.unit==='kg'?1000:1);
const nLimit=(i)=>{const c=RULES.classes[i.cls];const g=eGrams(i);return c.n.find(x=>g>=x.eMinG-1e-12&&(x.eMaxG==null||g<=x.eMaxG+1e-12))};
const minReq=i=>{const c=RULES.classes[i.cls];return (c.minMultIfELt1g&&eGrams(i)<1?c.minMultIfELt1g:c.minMult)*(+i.e)};

/* ===================== data model ===================== */
const mkPts=n=>Array.from({length:n},()=>({I:'',dL:''}));
const today=()=>new Date().toISOString().slice(0,10);
function blank(){return{id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),no:'',status:'Draft',created:new Date().toISOString(),updated:new Date().toISOString(),owner:'',rules:RULES.edition,
 inst:{mfr:'',addr:'',model:'',serial:'',type:'Electronic platform scale',cls:'III',unit:'kg',max:'',min:'',e:'',d:'',tareMax:'',appNo:'',fw:'',volt:'230 V, 50 Hz',tmin:'-10',tmax:'40',sensor:''},
 lab:{name:'Designated Laboratory (Legal Metrology)',lid:'',tester:'',date:today(),room:'',t0:'',t1:'',rh:'',p:'',wcls:'F2',wcert:'',wvalid:'',thermo:''},
 app:{weigh:1,ecc:1,rep:1,tare:1,temp:1},
 tests:{zero:{I:'',dL:''},weigh:[],ecc:{L:'',pos:mkPts(5)},rep:[{L:'',runs:mkPts(3)},{L:'',runs:mkPts(3)}],tare:{tare:'',z:{I:'',dL:''},rows:[]},temp:{L:'',rows:[]}},
 photos:[],docs:[],remarks:'',sig:{tester:null,reviewer:null},hash:''}}

function suggest(i){const e=+i.e,mx=+i.max,c=RULES.classes[i.cls];const mn=+i.min||e*c.minMult;const s=new Set([mn]);c.bands.forEach(b=>{if(b[0]!=null&&b[0]*e<mx)s.add(b[0]*e)});s.add(mx/2);s.add(mx);return [...s].map(x=>rd(Math.round(x/e)*e)).filter((x,k,a)=>x>0&&x<=mx&&a.indexOf(x)===k).sort((a,b)=>a-b)}
function instReady(i){return +i.e>0&&+i.max>0&&RULES.classes[i.cls]}
function ensureLoads(r,force){const i=r.inst;if(!instReady(i))return false;const e=+i.e,mx=+i.max,t=r.tests,sn=x=>String(rd(Math.round(x/e)*e));
 if(force||!t.weigh.length){const old=t.weigh;t.weigh=suggest(i).map((L,k)=>({L:String(L),iu:'',du:'',id:'',dd:'',...(!force&&old[k]?{}:{})}))}
 if(force||t.ecc.L==='')t.ecc.L=sn(mx/3);
 if(force||t.rep[0].L==='')t.rep[0].L=sn(mx/2);
 if(force||t.rep[1].L==='')t.rep[1].L=String(mx);
 if(force||t.tare.tare==='')t.tare.tare=sn(mx*0.3);
 if(force||!t.tare.rows.length){const net=mx-(+t.tare.tare);t.tare.rows=[0.25,0.6,1].map(f=>({L:sn(net*f),I:'',dL:''}))}
 if(force||t.temp.L==='')t.temp.L=sn(mx/2);
 if(force||!t.temp.rows.length)t.temp.rows=['20','40','-10'].map(T=>({T,zI:'',zd:'',I:'',dL:''}));
 return true}

/* ===================== calculation engine ===================== */
function C(r){
 const i=r.inst,t=r.tests,O={},V={},ENV=[];
 if(!instReady(i))return{O,V,ENV,overall:'pending',ready:false};
 const e=+i.e,d=(+i.d>0?+i.d:e),cls=i.cls,pp=Math.min(6,decs(d)+1);
 const pt=(L,I,dL,E0)=>{L=nn(L);I=nn(I);dL=nn(dL);if(L==null||I==null||dL==null)return null;const P=I+0.5*d-dL;const E=rd(P-L);const Ec=rd(E-(E0||0));const m=rd(mpe(cls,L,e));return{P:rd(P),E,Ec,m,pass:Math.abs(Ec)<=m+1e-9}};
 const comb=a=>{const g=a.filter(Boolean);if(!g.length)return'pending';if(g.some(x=>!x.pass))return'fail';if(g.length<a.length)return'incomplete';return'pass'};
 const put=(k,p)=>{O[k+'.Ec']={t:fs(p.Ec,pp),c:p.pass?'':'neg'};O[k+'.r']={t:p.pass?'Pass':'Fail',c:p.pass?'pass':'fail'}};
 const z0=z=>{const I=nn(z.I),dL=nn(z.dL);return(I==null||dL==null)?null:rd(I+0.5*d-dL)};
 const E0=z0(t.zero);O['z.E0']={t:E0==null?'—':fs(E0,pp),c:''};
 /* weighing */
 const wp=[];
 t.weigh.forEach((w,k)=>{const L=nn(w.L);if(L!=null)O['w.'+k+'.m']={t:'±'+fx(mpe(cls,L,e),pp),c:''};
  [['u','iu','du'],['d','id','dd']].forEach(([s,a,b])=>{const p=pt(w.L,w[a],w[b],E0);wp.push(p);if(p){put('w.'+k+'.'+s,p);ENV.push({x:L/e,y:p.Ec/e,pass:p.pass,dn:s==='d'})}})});
 V.weigh=comb(wp);
 /* eccentricity */
 const ep=[];const eL=nn(t.ecc.L);if(eL!=null)O['e.m']={t:'±'+fx(mpe(cls,eL,e),pp),c:''};
 t.ecc.pos.forEach((q,k)=>{const p=pt(t.ecc.L,q.I,q.dL,E0);ep.push(p);if(p)put('e.'+k,p)});
 V.ecc=comb(ep);
 /* repeatability */
 const rp=[];
 t.rep.forEach((s,k)=>{const L=nn(s.L);const m=L!=null?rd(mpe(cls,L,e)):null;if(m!=null)O['p.'+k+'.m']={t:'±'+fx(m,pp),c:''};
  const ps=s.runs.map((q,j)=>{const p=pt(s.L,q.I,q.dL,0);if(p)O['p.'+k+'.'+j+'.E']={t:fs(p.E,pp),c:''};return p});
  if(ps.every(Boolean)){const Es=ps.map(p=>p.E);const sp=rd(Math.max(...Es)-Math.min(...Es));const ok=sp<=m+1e-9;O['p.'+k+'.sp']={t:fx(sp,pp),c:ok?'':'neg'};O['p.'+k+'.r']={t:ok?'Pass':'Fail',c:ok?'pass':'fail'};rp.push({pass:ok})}else rp.push(null)});
 V.rep=comb(rp);
 /* tare */
 const E0t=z0(t.tare.z);O['t.E0']={t:E0t==null?'—':fs(E0t,pp),c:''};
 const tp=[];t.tare.rows.forEach((w,k)=>{const L=nn(w.L);if(L!=null)O['t.'+k+'.m']={t:'±'+fx(mpe(cls,L,e),pp),c:''};const p=pt(w.L,w.I,w.dL,E0t);tp.push(p);if(p)put('t.'+k,p)});
 V.tare=comb(tp);
 /* temperature */
 const cT=RULES.classes[cls].tempC;const xp=[];let ref=null,Tref=null;const Lq=nn(t.temp.L);if(Lq!=null)O['x.m']={t:'±'+fx(mpe(cls,Lq,e),pp),c:''};
 t.temp.rows.forEach((w,k)=>{const T=nn(w.T);const z=z0({I:w.zI,dL:w.zd});const p=pt(t.temp.L,w.I,w.dL,z==null?0:z);
  if(z!=null)O['x.'+k+'.z']={t:fs(z,pp),c:''};
  if(k===0){ref=z;Tref=T}
  let zok=null;if(k>0&&z!=null&&ref!=null&&T!=null&&Tref!=null){const dT=Math.abs(T-Tref);const lim=rd(e*dT/cT);const dr=rd(Math.abs(z-ref));zok=dr<=lim+1e-9;O['x.'+k+'.dr']={t:fx(dr,pp)+' / '+fx(lim,pp),c:zok?'':'neg'}}
  else if(k===0&&z!=null)O['x.0.dr']={t:'reference',c:''};
  if(p&&(k===0||zok!==null||z!=null)){const ok=p.pass&&zok!==false;O['x.'+k+'.Ec']={t:fs(p.Ec,pp),c:p.pass?'':'neg'};O['x.'+k+'.r']={t:ok?'Pass':'Fail',c:ok?'pass':'fail'};xp.push({pass:ok})}else xp.push(null)});
 V.temp=comb(xp);
 const act=Object.keys(V).filter(k=>r.app[k]);
 let overall='pending';
 if(act.length){const vs=act.map(k=>V[k]);overall=vs.includes('fail')?'fail':vs.every(v=>v==='pass')?'pass':vs.every(v=>v==='pending')?'pending':'incomplete'}
 return{O,V,ENV,overall,ready:true,E0,pp}}

/* ===================== validation ===================== */
function validate(r){
 const I=[],add=(lvl,step,msg,p)=>I.push({lvl,step,msg,p});const i=r.inst,l=r.lab,t=r.tests;
 [['mfr','Manufacturer'],['model','Model designation'],['serial','Serial number']].forEach(([k,n])=>{if(!String(i[k]).trim())add('err',0,n+' is required.','inst.'+k)});
 const e=+i.e,mx=+i.max,mn=+i.min,d=+i.d;
 if(!(mx>0))add('err',0,'Enter Max capacity greater than zero.','inst.max');
 if(!(e>0))add('err',0,'Enter the verification scale interval e.','inst.e');
 else{const ex=Math.floor(Math.log10(e)+1e-12),m=e/Math.pow(10,ex);if(![1,2,5].some(v=>Math.abs(m-v)<1e-9))add('err',0,'e must be 1, 2 or 5 × 10ᵏ (R 76 preferred series). Entered: '+i.e+'.','inst.e')}
 if(e>0&&!(d>0))add('err',0,'Enter the actual scale interval d.','inst.d');
 else if(e>0&&d>0){if(d>e+1e-12)add('err',0,'d must not be larger than e.','inst.d');else{const q=e/d,lg=Math.log10(q);if(Math.abs(lg-Math.round(lg))>1e-9)add('err',0,'e must equal d × 10ᵏ (k = 0, 1, 2 …). Now e/d = '+rd(q)+'.','inst.d')}}
 if(instReady(i)){const n=mx/e,lim=nLimit(i);
  if(!lim)add('err',0,'For class '+i.cls+', e = '+i.e+' '+i.unit+' is outside the range permitted by the rule set.','inst.e');
  else{if(n<lim.min-1e-9)add('err',0,'n = Max/e = '+rd(n)+' is below the minimum '+lim.min+' for class '+i.cls+' at this e.','inst.max');
   if(lim.max!=null&&n>lim.max+1e-9)add('err',0,'n = Max/e = '+rd(n)+' exceeds the maximum '+lim.max+' for class '+i.cls+' at this e.','inst.max')}
  if(!(mn>0))add('err',0,'Enter the minimum capacity Min.','inst.min');
  else if(mn<minReq(i)-1e-9)add('err',0,'Min must be at least '+rd(minReq(i))+' '+i.unit+' for class '+i.cls+'.','inst.min');
  else if(mn>=mx)add('err',0,'Min must be smaller than Max.','inst.min')}
 if(!String(l.tester).trim())add('err',1,'Enter the name of the testing officer.','lab.tester');
 if(!l.date)add('err',1,'Enter the test date.','lab.date');
 if(l.t0!==''&&l.t1!==''&&Math.abs(+l.t1-+l.t0)>5)add('warn',1,'Temperature moved by more than 5 °C during the test – conditions may not be stable.','lab.t1');
 if(l.rh!==''&&(+l.rh<0||+l.rh>100))add('err',1,'Relative humidity must be between 0 and 100 %.','lab.rh');
 if(l.wvalid&&l.date&&l.wvalid<l.date)add('err',1,'Standard-weight certificate expired before the test date.','lab.wvalid');
 if(!String(l.wcert).trim())add('warn',1,'Standard-weight certificate number is missing.','lab.wcert');
 if(instReady(i)){const dd=d>0?d:e;
  const chk=(p,L,Iv,dL,lab)=>{const Ln=nn(L),In=nn(Iv),dn=nn(dL);
   if(Ln!=null&&Ln>mx+1e-9)add('err',2,lab+': load exceeds Max ('+i.max+' '+i.unit+').',p+'.L');
   if(In!=null){if(In<0)add('err',2,lab+': indication cannot be negative.',p);else if(Math.abs(In/dd-Math.round(In/dd))>1e-6)add('err',2,lab+': indication '+Iv+' is not a multiple of d ('+dd+').',p)}
   if(dn!=null&&(dn<-1e-9||dn>dd*1.0001))add('warn',2,lab+': added load ΔL should lie between 0 and d ('+dd+').',p)};
  const dup=new Set();
  t.weigh.forEach((w,k)=>{const L=nn(w.L);if(L!=null){if(dup.has(L))add('warn',2,'Weighing test: load '+w.L+' is listed twice.','tests.weigh.'+k+'.L');dup.add(L)}
   chk('tests.weigh.'+k+'.iu',w.L,w.iu,w.du,'Weighing ↑ '+w.L);chk('tests.weigh.'+k+'.id',w.L,w.id,w.dd,'Weighing ↓ '+w.L);
   if(nn(w.iu)!=null&&nn(w.du)==null)add('warn',2,'Weighing ↑ '+w.L+': enter ΔL to complete this point.','tests.weigh.'+k+'.du');
   if(nn(w.id)!=null&&nn(w.dd)==null)add('warn',2,'Weighing ↓ '+w.L+': enter ΔL to complete this point.','tests.weigh.'+k+'.dd')});
  if(nn(t.zero.I)==null||nn(t.zero.dL)==null)add('warn',2,'Zero-error reading (E₀) not recorded – errors are shown uncorrected.','tests.zero.I');
  t.ecc.pos.forEach((q,k)=>chk('tests.ecc.pos.'+k+'.I',t.ecc.L,q.I,q.dL,'Eccentricity position '+(k+1)));
  t.rep.forEach((s,k)=>s.runs.forEach((q,j)=>chk('tests.rep.'+k+'.runs.'+j+'.I',s.L,q.I,q.dL,'Repeatability '+s.L+' run '+(j+1))));
  const tare=nn(t.tare.tare);if(tare!=null){t.tare.rows.forEach((w,k)=>{const L=nn(w.L);if(L!=null&&tare+L>mx+1e-9)add('err',2,'Tare weighing: tare + net load exceeds Max.','tests.tare.rows.'+k+'.L');chk('tests.tare.rows.'+k+'.I',w.L,w.I,w.dL,'Tare weighing net '+w.L)})}
  t.temp.rows.forEach((w,k)=>{chk('tests.temp.rows.'+k+'.I',t.temp.L,w.I,w.dL,'Temperature '+w.T+' °C');
   const T=nn(w.T);if(T!=null&&nn(i.tmin)!=null&&nn(i.tmax)!=null&&(T<+i.tmin-1e-9||T>+i.tmax+1e-9))add('warn',2,'Test temperature '+w.T+' °C is outside the declared range '+i.tmin+' to '+i.tmax+' °C.','tests.temp.rows.'+k+'.T')})}
 return I}

/* ===================== demo data ===================== */
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
const PRESETS=[
 {mfr:'Northeast Scales & Instruments Pvt. Ltd.',addr:'Industrial Area, Sector 4',model:'PS-300',serial:'PS300-26-0187',type:'Electronic platform scale',cls:'III',unit:'kg',max:'300',min:'2',e:'0.1',d:'0.1',tareMax:'100',fw:'v2.4.1',sensor:'Strain-gauge load cell, 4 × 100 kg',appNo:'APP/NAWI/2026/041'},
 {mfr:'Brahmaputra Weighing Systems',addr:'NH-37 Bypass, Industrial Zone',model:'WB-60T',serial:'WB60-26-0032',type:'Weighbridge',cls:'III',unit:'kg',max:'60000',min:'400',e:'20',d:'20',tareMax:'',fw:'v1.9.0',sensor:'Digital load cells, 6 × 20 t',appNo:'APP/NAWI/2026/047'},
 {mfr:'Kaziranga Precision Instruments',addr:'Electronics Park, Block C',model:'CS-15',serial:'CS15-26-1104',type:'Counter scale',cls:'III',unit:'kg',max:'15',min:'0.1',e:'0.005',d:'0.005',tareMax:'5',fw:'v3.0.2',sensor:'Single-point load cell 20 kg',appNo:'APP/NAWI/2026/052'},
 {mfr:'Sonaru Labware Pvt. Ltd.',addr:'Science City Road',model:'PB-200',serial:'PB200-26-0440',type:'Precision balance',cls:'II',unit:'g',max:'200',min:'0.5',e:'0.01',d:'0.01',tareMax:'200',fw:'v1.2.5',sensor:'Electromagnetic force restoration',appNo:'APP/NAWI/2026/058'},
 {mfr:'Dihing Industrial Weighing',addr:'Cargo Road, Godown Area',model:'HS-500',serial:'HS500-26-0091',type:'Hanging scale',cls:'IIII',unit:'kg',max:'500',min:'10',e:'1',d:'1',tareMax:'',fw:'v1.0.8',sensor:'S-type load cell 500 kg',appNo:'APP/NAWI/2026/061'},
 {mfr:'Tezpur Scale Works',addr:'Market Complex Road',model:'BS-30',serial:'BS30-26-0716',type:'Electronic bench scale',cls:'III',unit:'kg',max:'30',min:'0.2',e:'0.01',d:'0.01',tareMax:'10',fw:'v2.1.0',sensor:'Single-point load cell 50 kg',appNo:'APP/NAWI/2026/066'}
];
function fillLab(r,seed){const R=rng(seed+11);Object.assign(r.lab,{lid:'LM-LAB-'+(100+seed),tester:'Rahul Deka',room:'Mass laboratory, Room 2',t0:(21+R()).toFixed(1),t1:(21.6+R()).toFixed(1),rh:String(50+Math.round(R()*8)),p:String(1006+Math.round(R()*4)),wcls:r.inst.cls==='II'?'F1':'F2',wcert:'CAL/MASS/2026/'+(300+seed),wvalid:'2027-03-31',thermo:'THM-0'+(2+seed%3)})}
function nameplate(i){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="360"><rect width="560" height="360" fill="#DDE3EC"/><rect x="40" y="40" width="480" height="280" rx="10" fill="#F7F8FA" stroke="#5A6577" stroke-width="3"/><g font-family="Arial" fill="#141A26"><text x="64" y="86" font-size="22" font-weight="bold">${esc(i.mfr)}</text><text x="64" y="128" font-size="18">Model ${esc(i.model)}   S/N ${esc(i.serial)}</text><text x="64" y="166" font-size="18">Class ${esc(i.cls)}   Max ${esc(i.max)} ${esc(i.unit)}   Min ${esc(i.min)} ${esc(i.unit)}</text><text x="64" y="204" font-size="18">e = d = ${esc(i.e)} ${esc(i.unit)}   T ${esc(i.tmin)}…${esc(i.tmax)} °C</text><text x="64" y="260" font-size="14" fill="#5A6577">Instrument nameplate</text></g></svg>`;return 'data:image/svg+xml;utf8,'+encodeURIComponent(s)}
function fillDemo(r,o){o=o||{};if(!instReady(r.inst))Object.assign(r.inst,PRESETS[0]);if(!r.lab.tester)fillLab(r,o.seed||1);
 ensureLoads(r,true);const R=rng((o.seed||7)*97),i=r.inst,e=+i.e,d=+i.d||e,t=r.tests;const u=a=>(R()*2-1)*a,s=x=>String(rd(x));
 const gen=(L,En)=>{const I=Math.round((L+En)/d)*d;const dL=Math.max(0,I+0.5*d-L-En);return{I:s(I),dL:s(dL)}};
 const E0=0.1*d;t.zero={I:'0',dL:s(0.5*d-E0)};
 t.weigh.forEach(w=>{const L=+w.L;const a=gen(L,E0+u(0.4*e)),b=gen(L,E0+u(0.4*e)+0.1*e);w.iu=a.I;w.du=a.dL;w.id=b.I;w.dd=b.dL});
 t.ecc.pos.forEach(p=>Object.assign(p,gen(+t.ecc.L,E0+u(0.4*e))));
 t.rep.forEach(x=>{const b=u(0.25*e);x.runs.forEach(p=>Object.assign(p,gen(+x.L,b+u(0.15*e))))});
 t.tare.z={I:'0',dL:s(0.5*d-E0)};t.tare.rows.forEach(w=>Object.assign(w,gen(+w.L,E0+u(0.4*e))));
 const zt=[0.1,0.4,0.3];t.temp.rows.forEach((w,k)=>{const z=zt[k]*d;w.zI='0';w.zd=s(0.5*d-z);Object.assign(w,gen(+t.temp.L,z+u(0.4*e)))});
 if(o.fail){const w=t.weigh[t.weigh.length-1];const a=gen(+w.L,E0+1.8*e);w.iu=a.I;w.du=a.dL}
 if(!r.photos.length)r.photos=[{cap:'Instrument nameplate (sample image)',src:nameplate(i)}];
 return r}
function seed(){
 const spec=[[0,'Approved',0,'2026-04-14',1],[1,'Approved',0,'2026-05-22',2],[2,'Under review',0,'2026-07-09',3],[3,'Draft',0,'2026-08-18',4],[4,'Returned',1,'2026-09-05',5],[5,'Approved',0,'2026-09-24',6]];
 return spec.map(([p,st,fail,dt,sd],k)=>{const r=blank();Object.assign(r.inst,PRESETS[p]);fillLab(r,sd);r.lab.date=dt;r.no='NAWI/TR/2026/'+String(k+1).padStart(4,'0');r.created=dt+'T09:30:00.000Z';r.updated=dt+'T15:00:00.000Z';r.status=st;r.owner='Rahul Deka';
  fillDemo(r,{seed:sd,fail});
  if(st==='Draft'){r.tests.rep.forEach(x=>x.runs.forEach(q=>{q.I='';q.dL=''}));r.tests.temp.rows.forEach(w=>{w.zI='';w.zd='';w.I='';w.dL=''});r.tests.tare.rows.forEach(w=>{w.I='';w.dL=''});r.tests.tare.z={I:'',dL:''}}
  if(st==='Returned')r.remarks='Error at Max exceeds the MPE (upward). Re-check span adjustment and repeat the weighing test.';
  if(st==='Approved'){r.sig.reviewer={img:'',name:'Sunita Bora',at:dt+'T17:00:00.000Z'};r.hash='seed'}
  return r})}
/*#UI*/
/* ===================== state ===================== */
const USERS=[
 {role:'Admin',name:'Dr. Anita Kalita',title:'Laboratory Director',blurb:'Full access: rules, users, every report'},
 {role:'Tester',name:'Rahul Deka',title:'Lab Engineer',blurb:'Enters observations and submits reports for review'},
 {role:'Reviewer',name:'Sunita Bora',title:'Approving Officer',blurb:'Reviews, signs and approves or returns reports'},
 {role:'Viewer',name:'DoCA Auditor',title:'Read-only access',blurb:'Searches and downloads reports, cannot change them'}];
const PERM={create:['Admin','Tester'],edit:['Admin','Tester'],review:['Admin','Reviewer'],rules:['Admin'],users:['Admin'],del:['Admin']};
const S={user:null,view:'dash',cur:null,step:0,tab:'weigh',q:'',fs:'',fv:'',fc:'',mode:'all'};
let AUDIT=store.get('nawi.audit.v1',null)||[
 {t:'2026-09-24T17:02:00Z',who:'Sunita Bora',role:'Reviewer',act:'Approved and signed',ref:'NAWI/TR/2026/0006'},
 {t:'2026-09-05T16:10:00Z',who:'Sunita Bora',role:'Reviewer',act:'Returned with remarks',ref:'NAWI/TR/2026/0005'},
 {t:'2026-07-09T14:20:00Z',who:'Rahul Deka',role:'Tester',act:'Submitted for review',ref:'NAWI/TR/2026/0003'}];
S.reports=store.get('nawi.reports.v1',null)||seed();
const can=a=>S.user&&PERM[a].includes(S.user.role);
const save=()=>store.set('nawi.reports.v1',S.reports);
const log=(act,ref)=>{AUDIT.push({t:new Date().toISOString(),who:S.user.name,role:S.user.role,act,ref:ref||''});store.set('nawi.audit.v1',AUDIT)};
const editable=r=>can('edit')&&(r.status==='Draft'||r.status==='Returned');
const VL={pass:'Compliant',fail:'Non-compliant',incomplete:'Incomplete',pending:'No data'};
const stLabel=s=>s==='Under review'?'Review':s;
const fdate=s=>s?new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
const nextNo=()=>{const y=new Date().getFullYear();const n=S.reports.filter(r=>r.no.includes('/'+y+'/')).length+1;return 'NAWI/TR/'+y+'/'+String(n).padStart(4,'0')};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200)};
const $=(s,e)=>(e||document).querySelector(s),$$=(s,e)=>[...(e||document).querySelectorAll(s)];
const ic=n=>({dash:'<path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z"/>',add:'<path d="M12 5v14M5 12h14"/>',repo:'<path d="M4 4h12l4 4v12H4zM8 12h8M8 16h8"/>',std:'<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',usr:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'}[n]);
const svgi=n=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic(n)}</svg>`;
const logo=`<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 5v22M9 27h16M6 11h22"/><path d="M6 11l-4 8a4 4 0 008 0zM28 11l-4 8a4 4 0 008 0z"/><circle cx="17" cy="5" r="1.6" fill="#D9731A" stroke="none"/></svg>`;

/* ===================== shell & routing ===================== */
function render(){
 const root=$('#root');
 if(!S.user){root.innerHTML=vLogin();return}
 const nav=[['dash','Dashboard','dash'],['repo','Report repository','repo'],['std','Standards & rules','std']];
 if(can('create'))nav.splice(1,0,['new','New test report','add']);
 if(can('users'))nav.push(['usr','Users & audit trail','usr']);
 root.innerHTML=`<div class="app"><aside class="side noprint"><div class="brand">${logo}<div><b>NAWI Report Studio</b><small>OIML R 76 · type evaluation</small></div></div>
 ${nav.map(n=>`<button class="nav ${S.view===n[0]||(S.view==='wiz'&&n[0]==='new')||(S.view==='rep'&&n[0]==='repo')?'on':''}" data-act="nav" data-v="${n[0]}">${svgi(n[2])}${n[1]}</button>`).join('')}
 <div class="me"><b>${esc(S.user.name)}</b><span>${esc(S.user.title)} · ${S.user.role}</span><br><button data-act="logout">Switch role</button></div></aside><main id="main"></main></div>`;
 const m=$('#main');
 ({dash:vDash,repo:vRepo,std:vStd,usr:vUsers,wiz:vWiz,rep:vRep}[S.view]||vDash)(m);
 if(S.view==='wiz')paint();
 window.scrollTo(0,0)}
function go(v,extra){Object.assign(S,extra||{});S.view=v;render()}

function vLogin(){return `<div class="login"><section class="l-brand"><div>${logo}</div><div><h1>Test reports for weighing instruments, checked as you type.</h1><p>Type-evaluation reports for non-automatic weighing instruments under OIML R 76, prepared from recorded test observations.</p></div><ul><li>Permissible errors and pass/fail computed from the rule set</li><li>Validation of every entry before a report can be submitted</li><li>Standard report as PDF or Word, with a searchable repository</li></ul></section>
 <section class="l-form"><h2>Sign in</h2><p style="color:var(--mute);margin:0 0 8px">Choose your role. Access depends on the role.</p>
 ${USERS.map(u=>`<button class="role" data-act="login" data-role="${u.role}"><b>${u.name} · ${u.role}</b><span>${u.title}</span><em>${u.blurb}</em></button>`).join('')}</section></div>`}

/* ===================== dashboard ===================== */
function overallOf(r){return C(r).overall}
function vDash(m){
 const R=S.reports,cnt=s=>R.filter(r=>r.status===s).length;
 const done=cnt('Approved'),proc=cnt('Draft')+cnt('Returned'),rev=cnt('Under review');
 const dec=R.map(overallOf).filter(v=>v==='pass'||v==='fail');const rate=dec.length?Math.round(100*dec.filter(v=>v==='pass').length/dec.length):0;
 const now=new Date(),months=[];for(let k=5;k>=0;k--){const d=new Date(now.getFullYear(),now.getMonth()-k,1);months.push({y:d.getFullYear(),m:d.getMonth(),l:d.toLocaleDateString('en-IN',{month:'short'}),a:0,v:0,p:0})}
 R.forEach(r=>{const d=new Date(r.created);const b=months.find(x=>x.y===d.getFullYear()&&x.m===d.getMonth());if(b){if(r.status==='Approved')b.a++;else if(r.status==='Under review')b.v++;else b.p++}});
 const mx=Math.max(3,...months.map(x=>x.a+x.v+x.p));const W=440,H=190,bw=42,gap=(W-40-months.length*bw)/(months.length-1);
 let bars='';months.forEach((x,k)=>{let y=H-26;const X=30+k*(bw+gap);[['a','#1E7B4F'],['v','#D9A21E'],['p','#9AA6BC']].forEach(([key,col])=>{const h=(H-50)*x[key]/mx;if(h>0){y-=h;bars+=`<rect x="${X}" y="${y}" width="${bw}" height="${h}" fill="${col}"/>`}});bars+=`<text x="${X+bw/2}" y="${H-8}" text-anchor="middle" font-size="12" fill="#5A6577">${x.l}</text>`});
 const mine=S.user.role==='Reviewer'?R.filter(r=>r.status==='Under review'):(S.user.role==='Viewer'?R.filter(r=>r.status==='Approved').slice(-4):R.filter(r=>r.status==='Draft'||r.status==='Returned'));
 const label=S.user.role==='Reviewer'?'Waiting for your review':S.user.role==='Viewer'?'Latest approved reports':'Your reports in process';
 m.innerHTML=`<div class="ph"><div><h1>Good day, ${esc(S.user.name.split(' ')[0]==='Dr.'?S.user.name.split(' ')[1]:S.user.name.split(' ')[0])}</h1><p>Testing activity of the laboratory at a glance.</p></div>
 <div style="display:flex;gap:8px">${can('create')?`<button class="btn ghost" data-act="guided">Start with sample readings</button><button class="btn" data-act="nav" data-v="new">Start a new report</button>`:''}</div></div>
 <div class="kpis"><div class="kpi"><b>${R.length}</b><span>Reports in repository</span></div><div class="kpi"><b>${done}</b><span>Completed and approved</span></div><div class="kpi"><b>${proc}</b><span>In process</span></div><div class="kpi"><b>${rev}</b><span>Under review</span></div><div class="kpi"><b>${rate}%</b><span>Compliant among finished tests</span></div></div>
 <div class="cols"><div><div class="sec"><h3>${label}</h3>${mine.length?`<ul class="list">${mine.map(r=>`<li><div><a href="#" data-act="open" data-id="${r.id}"><b>${esc(r.no)}</b></a> · ${esc(r.inst.model)}<br><small>${esc(r.inst.mfr)}</small></div><span class="chip ${r.status==='Under review'?'Review':r.status}">${r.status}</span></li>`).join('')}</ul>`:'<div class="empty">Nothing waiting. New work will appear here.</div>'}</div>
 <div class="sec"><h3>Recent activity</h3><ul class="list">${AUDIT.slice(-6).reverse().map(a=>`<li><div>${esc(a.act)} <b>${esc(a.ref)}</b><br><small>${esc(a.who)} · ${fdate(a.t)}</small></div></li>`).join('')}</ul></div></div>
 <div class="sec"><h3>Reports started per month</h3><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Reports per month by status"><line x1="24" x2="${W-4}" y1="${H-26}" y2="${H-26}" stroke="#D3D9E2"/>${bars}</svg>
 <p style="font-size:12.5px;color:var(--mute);display:flex;gap:14px;flex-wrap:wrap"><span><b style="color:#1E7B4F">■</b> Approved</span><span><b style="color:#D9A21E">■</b> Under review</span><span><b style="color:#9AA6BC">■</b> Draft or returned</span></p></div></div>`}

/* ===================== repository ===================== */
function filtered(){const q=S.q.toLowerCase();return S.reports.filter(r=>{const hay=[r.no,r.inst.mfr,r.inst.model,r.inst.serial,r.inst.type,r.lab.tester,r.lab.date].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!S.fs||r.status===S.fs)&&(!S.fv||overallOf(r)===S.fv)&&(!S.fc||r.inst.cls===S.fc)}).sort((a,b)=>b.lab.date.localeCompare(a.lab.date))}
function repoBody(){const L=filtered();if(!L.length)return '<div class="empty">No report matches these filters. Clear the search or choose another status.</div>';
 if(S.mode==='inst'){const g={};L.forEach(r=>{const k=[r.inst.mfr,r.inst.model,r.inst.serial].join('|');(g[k]=g[k]||[]).push(r)});
  return Object.values(g).map(a=>{const i=a[0].inst;return `<div class="grp"><h4>${esc(i.model)} · S/N ${esc(i.serial)}</h4><small style="color:var(--mute)">${esc(i.mfr)} · Class ${i.cls} · Max ${i.max} ${i.unit} · e ${i.e} ${i.unit}</small><div class="tl" style="margin-top:8px">${a.map(r=>`<div><a href="#" data-act="open" data-id="${r.id}"><b>${esc(r.no)}</b></a><br>${fdate(r.lab.date)}<br><span class="chip ${overallOf(r)}">${VL[overallOf(r)]}</span> <span class="chip ${stLabel(r.status)}">${r.status}</span></div>`).join('')}</div></div>`}).join('')}
 return `<div class="scroll"><table class="tbl"><thead><tr><th>Report no.</th><th>Instrument</th><th>Serial</th><th>Class</th><th>Max / e</th><th>Test date</th><th>Result</th><th>Status</th></tr></thead><tbody>${L.map(r=>`<tr class="click" data-act="open" data-id="${r.id}"><td><b>${esc(r.no)}</b></td><td>${esc(r.inst.model)}<br><small style="color:var(--mute)">${esc(r.inst.mfr)}</small></td><td>${esc(r.inst.serial)}</td><td>${r.inst.cls}</td><td>${esc(r.inst.max)} / ${esc(r.inst.e)} ${r.inst.unit}</td><td>${fdate(r.lab.date)}</td><td><span class="chip ${overallOf(r)}">${VL[overallOf(r)]}</span></td><td><span class="chip ${stLabel(r.status)}">${r.status}</span></td></tr>`).join('')}</tbody></table></div>`}
function vRepo(m){m.innerHTML=`<div class="ph"><div><h1>Report repository</h1><p>Every report ever generated, searchable by instrument, manufacturer, serial number or date.</p></div><button class="btn ghost" data-act="csv">Export register (CSV)</button></div>
 <div class="toolbar"><input type="search" id="q" placeholder="Search report no., model, manufacturer, serial…" value="${esc(S.q)}" aria-label="Search reports">
 <select id="fs" aria-label="Status"><option value="">All statuses</option>${['Draft','Returned','Under review','Approved'].map(s=>`<option ${S.fs===s?'selected':''}>${s}</option>`).join('')}</select>
 <select id="fv" aria-label="Result"><option value="">All results</option>${Object.keys(VL).map(k=>`<option value="${k}" ${S.fv===k?'selected':''}>${VL[k]}</option>`).join('')}</select>
 <select id="fc" aria-label="Class"><option value="">All classes</option>${['I','II','III','IIII'].map(c=>`<option ${S.fc===c?'selected':''}>${c}</option>`).join('')}</select>
 <span class="seg"><button data-act="mode" data-m="all" class="${S.mode==='all'?'on':''}">All reports</button><button data-act="mode" data-m="inst" class="${S.mode==='inst'?'on':''}">Instrument history</button></span></div><div id="repobody">${repoBody()}</div>`}

/* ===================== standards & users ===================== */
function vStd(m){const ed=can('rules');
 m.innerHTML=`<div class="ph"><div><h1>Standards and rules</h1><p>Active rule set: <b>${esc(RULES.edition)}</b>. Every calculation reads from this table, so a revised recommendation is a data change, not a code change.</p></div></div>
 <div class="cols"><div>${['I','II','III','IIII'].map(k=>{const c=RULES.classes[k];return `<div class="sec"><h3>Class ${k} – ${c.name}</h3><table class="tbl"><thead><tr><th>Load m (in multiples of e)</th><th>MPE, initial verification</th></tr></thead><tbody>${c.bands.map((b,j)=>{const lo=j?c.bands[j-1][0]:0;return `<tr><td>${j?lo+' < m':'0 ≤ m'}${b[0]!=null?' ≤ '+b[0]:''}</td><td>± ${b[1]} e</td></tr>`}).join('')}</tbody></table><small style="color:var(--mute)">Min ≥ ${c.minMult}e${c.minMultIfELt1g?' (≥ '+c.minMultIfELt1g+'e when e < 1 g)':''} · zero drift ≤ 1e per ${c.tempC} °C</small></div>`}).join('')}</div>
 <div class="sec"><h3>Rule set (JSON)</h3><p class="hint">${ed?'Edit the values, then apply. The dashboard, forms and reports recalculate immediately.':'Only an administrator can change the rule set.'}</p><textarea class="rules" id="rulesTx" ${ed?'':'readonly'}>${esc(JSON.stringify(RULES,null,1))}</textarea>
 ${ed?`<div style="display:flex;gap:8px;margin-top:10px"><button class="btn" data-act="applyrules">Apply rule set</button><button class="btn ghost" data-act="resetrules">Restore defaults</button></div>`:''}
 <p class="hint" style="margin-top:12px">Approved reports keep the edition they were approved under. Check every value in the rule set against the current OIML R 76 publication before issuing reports.</p></div></div>`}
function vUsers(m){m.innerHTML=`<div class="ph"><div><h1>Users and audit trail</h1><p>Role-based access and a record of every state change.</p></div></div><div class="cols"><div class="sec"><h3>Roles</h3><table class="tbl"><thead><tr><th>Role</th><th>Person</th><th>Can do</th></tr></thead><tbody>${USERS.map(u=>`<tr><td><b>${u.role}</b></td><td>${u.name}<br><small style="color:var(--mute)">${u.title}</small></td><td>${u.blurb}</td></tr>`).join('')}</tbody></table></div>
 <div class="sec"><h3>Audit trail</h3><ul class="list">${AUDIT.slice().reverse().slice(0,14).map(a=>`<li><div>${esc(a.act)} <b>${esc(a.ref)}</b><br><small>${esc(a.who)} (${a.role}) · ${new Date(a.t).toLocaleString('en-IN')}</small></div></li>`).join('')}</ul></div></div>`}

/* ===================== wizard ===================== */
const STEPS=['Instrument','Laboratory','Test observations','Attachments','Review and generate'];
const TESTS=[['weigh','Weighing test'],['ecc','Eccentricity'],['rep','Repeatability'],['tare','Tare weighing'],['temp','Temperature effect']];
let LAST=null,ISS=[];
function newReport(){const r=blank();r.no=nextNo();r.owner=S.user.name;if(S.user.role==='Tester')r.lab.tester=S.user.name;S.reports.push(r);save();log('Created report',r.no);return r}
function vWiz(m){const r=S.cur,ed=editable(r);
 m.innerHTML=`<div class="ph noprint"><div><h1>${esc(r.no)}</h1><p>${esc(r.inst.model||'New instrument')} · ${r.status}${ed?'':' · read-only'}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${ed?`<button class="btn ghost" data-act="demo">Fill sample readings</button><button class="btn ghost" data-act="fault">Simulate an out-of-tolerance reading</button>`:''}<button class="btn ghost" data-act="preview">Preview report</button></div></div>
 <div class="strip" id="strip"></div>
 <div class="steps" role="tablist">${STEPS.map((s,k)=>`<button class="stp ${S.step===k?'on':''}" data-act="step" data-n="${k}" role="tab">${s}<i data-sb="${k}" hidden></i></button>`).join('')}</div>
 <fieldset id="stage" ${ed?'':'disabled'}></fieldset>
 <div class="nav-row noprint"><button class="btn ghost" data-act="step" data-n="${Math.max(0,S.step-1)}" ${S.step===0?'disabled':''}>Back</button><span style="display:flex;gap:8px"><button class="btn ghost" data-act="saved">Save draft</button>${S.step<4?`<button class="btn" data-act="step" data-n="${S.step+1}">Next: ${STEPS[S.step+1]}</button>`:''}</span></div>`;
 stage()}
function fld(label,path,o){o=o||{};const v=get(S.cur,path);
 if(o.opts)return `<label class="fld ${o.w||''}"><span>${label}</span><select data-p="${path}">${o.opts.map(x=>{const a=Array.isArray(x)?x:[x,x];return `<option value="${esc(a[0])}" ${String(a[0])===String(v)?'selected':''}>${esc(a[1])}</option>`}).join('')}</select></label>`;
 return `<label class="fld ${o.w||''}"><span>${label}${o.req?' *':''}</span><input data-p="${path}" type="${o.type||'text'}" value="${esc(v)}" placeholder="${esc(o.ph||'')}" ${o.num?'inputmode="decimal"':''} autocomplete="off"></label>`}
const inp=p=>`<input class="c" data-p="${p}" value="${esc(get(S.cur,p))}" inputmode="decimal" autocomplete="off">`;
const out=k=>`<span class="out" data-o="${k}">—</span>`;
function stage(){const r=S.cur,st=$('#stage');st.innerHTML=[s0,s1,s2,s3,s4][S.step](r);$$('.stp').forEach((b,k)=>b.classList.toggle('on',k===S.step));paint()}
function s0(r){return `<div class="blk"><h3>Manufacturer and model</h3><div class="grid">${fld('Manufacturer / applicant','inst.mfr',{req:1,w:'w2'})}${fld('Address','inst.addr',{w:'w2'})}${fld('Model designation','inst.model',{req:1})}${fld('Serial number','inst.serial',{req:1})}${fld('Instrument type','inst.type',{opts:['Electronic platform scale','Electronic bench scale','Counter scale','Weighbridge','Hanging scale','Precision balance','Other']})}${fld('Type-approval application no.','inst.appNo')}${fld('Software / firmware version','inst.fw')}${fld('Load cell / sensor','inst.sensor')}</div></div>
 <div class="blk"><h3>Metrological characteristics</h3><div class="grid">${fld('Accuracy class','inst.cls',{opts:[['I','I – Special'],['II','II – High'],['III','III – Medium'],['IIII','IIII – Ordinary']]})}${fld('Unit','inst.unit',{opts:['kg','g']})}${fld('Maximum capacity (Max)','inst.max',{req:1,num:1,ph:'e.g. 300'})}${fld('Minimum capacity (Min)','inst.min',{req:1,num:1})}${fld('Verification scale interval (e)','inst.e',{req:1,num:1})}${fld('Actual scale interval (d)','inst.d',{req:1,num:1})}${fld('Maximum tare','inst.tareMax',{num:1})}${fld('Power supply','inst.volt')}${fld('Declared temperature, low (°C)','inst.tmin',{num:1})}${fld('Declared temperature, high (°C)','inst.tmax',{num:1})}</div><div class="derived" id="derived"></div></div><div id="vlist"></div>`}
function derived(r){const i=r.inst;if(!instReady(i))return '<span class="wide">Enter Max and e to see the number of scale intervals, limits for the class and the permissible errors.</span>';
 const e=+i.e,n=+i.max/e,c=RULES.classes[i.cls],lim=nLimit(i);
 return `<div><b>${rd(n)}</b><span>Scale intervals n = Max / e</span></div><div><b>${lim?lim.min+' – '+(lim.max==null?'no limit':lim.max):'not allowed'}</b><span>Permitted n for class ${i.cls} at this e</span></div><div><b>${rd(minReq(i))} ${i.unit}</b><span>Smallest Min allowed (${c.minMult}e${c.minMultIfELt1g&&eGrams(i)<1?'→'+c.minMultIfELt1g+'e':''})</span></div>
 <div class="wide">Maximum permissible error at initial verification: ${c.bands.map((b,j)=>{const lo=j?c.bands[j-1][0]:0;return '±'+b[1]+'e for '+(b[0]!=null?(j?lo+' < m ≤ '+b[0]:'m ≤ '+b[0]):'m > '+lo)+'e  ('+rd(b[1]*e)+' '+i.unit+')'}).join(' · ')}</div>`}
function s1(r){return `<div class="blk"><h3>Laboratory and testing officer</h3><div class="grid">${fld('Laboratory','lab.name',{w:'w2'})}${fld('Laboratory ID','lab.lid')}${fld('Testing officer','lab.tester',{req:1})}${fld('Test date','lab.date',{type:'date',req:1})}${fld('Test room','lab.room',{w:'w2'})}${fld('Thermometer / hygrometer ID','lab.thermo')}</div></div>
 <div class="blk"><h3>Environmental conditions</h3><div class="grid">${fld('Temperature at start (°C)','lab.t0',{num:1})}${fld('Temperature at end (°C)','lab.t1',{num:1})}${fld('Relative humidity (%)','lab.rh',{num:1})}${fld('Air pressure (hPa)','lab.p',{num:1})}</div></div>
 <div class="blk"><h3>Reference standard weights</h3><div class="grid">${fld('Weight class','lab.wcls',{opts:['E2','F1','F2','M1']})}${fld('Calibration certificate no.','lab.wcert',{w:'w2'})}${fld('Certificate valid until','lab.wvalid',{type:'date'})}</div></div><div id="vlist"></div>`}
function na(k,r){return `<label class="na"><input type="checkbox" data-p="app.${k}" ${r.app[k]?'checked':''}> This test applies to the instrument</label>`}
function s2(r){if(!instReady(r.inst))return '<div class="empty">Complete the instrument details first (class, Max and e). The test forms build themselves from those values.</div>';
 ensureLoads(r);const k=S.tab;
 return `<div class="tabs" role="tablist">${TESTS.map(t=>`<button class="tab ${k===t[0]?'on':''}" data-act="tab" data-t="${t[0]}" role="tab">${t[1]}<span class="chip pending" data-tabv="${t[0]}">–</span></button>`).join('')}</div>
 ${na(k,r)}${r.app[k]?({weigh:tWeigh,ecc:tEcc,rep:tRep,tare:tTare,temp:tTemp}[k])(r):'<div class="empty">Marked as not applicable. It will be left out of the report and the verdict.</div>'}<div id="vlist" style="margin-top:14px"></div>`}
const RES=(o)=>`<span class="out" data-o="${o}">—</span>`;
function tWeigh(r){return `<p class="hint">For each load L, record the indication I and the extra load ΔL (<span data-unit></span>) that makes the indication step up by one d. The engine applies P = I + ½d − ΔL, error E = P − L, then subtracts the zero error E₀ and compares the result with the permissible error for that load.</p>
 <div class="zero"><b>Zero error</b> indication I ${inp('tests.zero.I')} extra load ΔL ${inp('tests.zero.dL')} <span>E₀ = ${out('z.E0')}</span></div>
 <div class="scroll"><table class="tbl"><thead><tr><th rowspan="2">Load L</th><th rowspan="2" class="num">MPE</th><th class="grp" colspan="4">Increasing load</th><th class="grp" colspan="4">Decreasing load</th><th rowspan="2"></th></tr><tr><th>I</th><th>ΔL</th><th class="num">Error</th><th>Result</th><th>I</th><th>ΔL</th><th class="num">Error</th><th>Result</th></tr></thead><tbody>
 ${r.tests.weigh.map((w,k)=>`<tr><td>${inp('tests.weigh.'+k+'.L')}</td><td class="num">${out('w.'+k+'.m')}</td><td>${inp('tests.weigh.'+k+'.iu')}</td><td>${inp('tests.weigh.'+k+'.du')}</td><td class="num">${out('w.'+k+'.u.Ec')}</td><td>${out('w.'+k+'.u.r')}</td><td>${inp('tests.weigh.'+k+'.id')}</td><td>${inp('tests.weigh.'+k+'.dd')}</td><td class="num">${out('w.'+k+'.d.Ec')}</td><td>${out('w.'+k+'.d.r')}</td><td><button class="btn ghost sm" data-act="rmrow" data-k="weigh" data-i="${k}" aria-label="Remove row">✕</button></td></tr>`).join('')}</tbody></table></div>
 <div style="display:flex;gap:8px;margin-top:10px"><button class="btn ghost sm" data-act="addrow" data-k="weigh">Add a load</button><button class="btn ghost sm" data-act="suggest">Suggest test loads for this class</button></div>
 <div class="envwrap"><b style="font-family:'Newsreader',serif;font-size:16px">Errors against the permissible envelope</b><div id="env"></div></div>`}
function tEcc(r){const nm=['Centre','Front left','Front right','Rear right','Rear left'];return `<p class="hint">Place the test load in turn at the centre and at each quadrant. Errors are corrected for zero and compared with the permissible error for the applied load.</p>
 <div class="zero"><b>Test load</b> ${inp('tests.ecc.L')} <span data-unit></span> <span>MPE ${out('e.m')}</span></div>
 <div class="scroll"><table class="tbl"><thead><tr><th>Position</th><th>I</th><th>ΔL</th><th class="num">Error</th><th>Result</th></tr></thead><tbody>${r.tests.ecc.pos.map((p,k)=>`<tr><td>${k+1}. ${nm[k]}</td><td>${inp('tests.ecc.pos.'+k+'.I')}</td><td>${inp('tests.ecc.pos.'+k+'.dL')}</td><td class="num">${out('e.'+k+'.Ec')}</td><td>${out('e.'+k+'.r')}</td></tr>`).join('')}</tbody></table></div>`}
function tRep(r){return `<p class="hint">Apply each load three times. The spread between the largest and smallest error must not exceed the permissible error for that load.</p>`+r.tests.rep.map((s,k)=>`<div class="zero"><b>Load ${k+1}</b> ${inp('tests.rep.'+k+'.L')} <span data-unit></span> <span>MPE ${out('p.'+k+'.m')}</span></div><div class="scroll" style="margin-bottom:14px"><table class="tbl"><thead><tr><th>Run</th><th>I</th><th>ΔL</th><th class="num">Error</th></tr></thead><tbody>${s.runs.map((q,j)=>`<tr><td>${j+1}</td><td>${inp('tests.rep.'+k+'.runs.'+j+'.I')}</td><td>${inp('tests.rep.'+k+'.runs.'+j+'.dL')}</td><td class="num">${out('p.'+k+'.'+j+'.E')}</td></tr>`).join('')}<tr><td colspan="3"><b>Spread (max − min)</b></td><td class="num">${out('p.'+k+'.sp')} ${out('p.'+k+'.r')}</td></tr></tbody></table></div>`).join('')}
function tTare(r){return `<p class="hint">Load the tare, zero the display, then repeat the weighing at net loads. Net load plus tare must not exceed Max.</p>
 <div class="zero"><b>Tare load</b> ${inp('tests.tare.tare')} <span data-unit></span> · zero after tare: I ${inp('tests.tare.z.I')} ΔL ${inp('tests.tare.z.dL')} <span>E₀ = ${out('t.E0')}</span></div>
 <div class="scroll"><table class="tbl"><thead><tr><th>Net load</th><th class="num">MPE</th><th>I</th><th>ΔL</th><th class="num">Error</th><th>Result</th><th></th></tr></thead><tbody>${r.tests.tare.rows.map((w,k)=>`<tr><td>${inp('tests.tare.rows.'+k+'.L')}</td><td class="num">${out('t.'+k+'.m')}</td><td>${inp('tests.tare.rows.'+k+'.I')}</td><td>${inp('tests.tare.rows.'+k+'.dL')}</td><td class="num">${out('t.'+k+'.Ec')}</td><td>${out('t.'+k+'.r')}</td><td><button class="btn ghost sm" data-act="rmrow" data-k="tare" data-i="${k}" aria-label="Remove row">✕</button></td></tr>`).join('')}</tbody></table></div><div style="margin-top:10px"><button class="btn ghost sm" data-act="addrow" data-k="tare">Add a load</button></div>`}
function tTemp(r){const c=RULES.classes[r.inst.cls];return `<p class="hint">Record the no-load reading and the error at one test load for each temperature; the first row is the reference. The no-load indication may drift by no more than 1e per ${c.tempC} °C of temperature change, and the error at load must stay within the permissible error.</p>
 <div class="zero"><b>Test load</b> ${inp('tests.temp.L')} <span data-unit></span> <span>MPE ${out('x.m')}</span></div>
 <div class="scroll"><table class="tbl"><thead><tr><th>Temp °C</th><th>No-load I</th><th>ΔL</th><th class="num">E₀</th><th class="num">Drift / limit</th><th>I at load</th><th>ΔL</th><th class="num">Error</th><th>Result</th><th></th></tr></thead><tbody>${r.tests.temp.rows.map((w,k)=>`<tr><td>${inp('tests.temp.rows.'+k+'.T')}</td><td>${inp('tests.temp.rows.'+k+'.zI')}</td><td>${inp('tests.temp.rows.'+k+'.zd')}</td><td class="num">${out('x.'+k+'.z')}</td><td class="num">${out('x.'+k+'.dr')}</td><td>${inp('tests.temp.rows.'+k+'.I')}</td><td>${inp('tests.temp.rows.'+k+'.dL')}</td><td class="num">${out('x.'+k+'.Ec')}</td><td>${out('x.'+k+'.r')}</td><td><button class="btn ghost sm" data-act="rmrow" data-k="temp" data-i="${k}" aria-label="Remove row">✕</button></td></tr>`).join('')}</tbody></table></div><div style="margin-top:10px"><button class="btn ghost sm" data-act="addrow" data-k="temp">Add a temperature</button></div>`}
function s3(r){return `<div class="blk"><h3>Photographs</h3><p class="hint">Nameplate, seals, indicator and load receptor. Images are reduced to a small size and stored with the report.</p><div class="photos">${r.photos.map((p,k)=>`<div class="ph1"><img src="${esc(p.src)}" alt="${esc(p.cap)}"><input data-p="photos.${k}.cap" value="${esc(p.cap)}" aria-label="Caption"><button class="btn ghost sm" style="margin-top:6px" data-act="rmphoto" data-i="${k}">Remove</button></div>`).join('')}<label class="drop"><input type="file" id="fphoto" accept="image/*" multiple hidden>Add photographs<br><small>Choose one or more image files</small></label></div></div>
 <div class="blk"><h3>Supporting documents</h3><p class="hint">Weight calibration certificates, manufacturer manuals, approval application. Names are listed in the report.</p><ul class="list">${r.docs.map((d,k)=>`<li><span>${esc(d.name)} <small>(${Math.round(d.size/1024)} KB)</small></span><button class="btn ghost sm" data-act="rmdoc" data-i="${k}">Remove</button></li>`).join('')||'<li><small>No documents attached.</small></li>'}</ul><label class="btn ghost sm" style="display:inline-block;margin-top:8px"><input type="file" id="fdoc" multiple hidden>Attach documents</label></div>`}
function s4(r){const ed=editable(r);return `<div class="blk"><h3>Result by test</h3><table class="tbl"><tbody>${TESTS.map(t=>`<tr><td>${t[1]}</td><td>${r.app[t[0]]?`<span class="chip pending" data-tabv="${t[0]}">–</span>`:'<small style="color:var(--mute)">Not applicable</small>'}</td></tr>`).join('')}</tbody></table></div>
 <div class="blk"><h3>Checks before submission</h3><div id="vlist"></div></div>
 <div class="blk"><h3>Remarks</h3><textarea class="tx" data-p="remarks" rows="3" style="width:100%">${esc(r.remarks)}</textarea></div>
 <div class="blk" style="display:flex;gap:8px;flex-wrap:wrap" class="noprint"><button class="btn ghost" data-act="preview">Preview standard report</button>${ed?`<button class="btn saf" id="submitBtn" data-act="submit">Sign and submit for review</button>`:''}</div>`}
function issuesHTML(a){if(!a.length)return '<ul class="iss"><li class="okk">No problems found in this section.</li></ul>';return `<ul class="iss">${a.map(x=>`<li class="${x.lvl}">${x.lvl==='err'?'Fix: ':'Check: '}${esc(x.msg)}</li>`).join('')}</ul>`}
function envSVG(r,c){const e=+r.inst.e,n=+r.inst.max/e,cl=RULES.classes[r.inst.cls];const W=680,H=250,Lm=46,Rm=14,Tm=12,Bm=38;const x=v=>Lm+(W-Lm-Rm)*v/n,y=v=>Tm+(H-Tm-Bm)*(1-(v+2)/4);
 let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Measured errors against the permissible error envelope">`;
 [-1.5,-1,-.5,0,.5,1,1.5].forEach(v=>{s+=`<line x1="${Lm}" x2="${W-Rm}" y1="${y(v)}" y2="${y(v)}" stroke="${v===0?'#8996AE':'#E7EBF1'}"/><text x="${Lm-6}" y="${y(v)+4}" text-anchor="end">${v>0?'+':''}${v}e</text>`});
 let lo=0;const marks=[0];cl.bands.forEach(b=>{const hi=b[0]==null?n:Math.min(b[0],n);if(lo<n){s+=`<rect class="env" x="${x(lo)}" y="${y(b[1])}" width="${x(hi)-x(lo)}" height="${y(-b[1])-y(b[1])}"/>`;marks.push(hi)}lo=hi});
 [...new Set(marks)].forEach(v=>{s+=`<line x1="${x(v)}" x2="${x(v)}" y1="${Tm}" y2="${H-Bm}" stroke="#E7EBF1" stroke-dasharray="3 3"/><text x="${x(v)}" y="${H-Bm+16}" text-anchor="middle">${rd(v)}e</text>`});
 s+=`<text x="${(Lm+W-Rm)/2}" y="${H-6}" text-anchor="middle">Load, in scale intervals (e)   ·   shaded band = ± permissible error   ·   filled dot = increasing load, ring = decreasing</text>`;
 c.ENV.forEach(p=>{const yy=Math.max(-1.9,Math.min(1.9,p.y));s+=`<circle class="pt ${p.pass?'pass':'fail'} ${p.dn?'dn':''}" cx="${x(Math.min(p.x,n))}" cy="${y(yy)}" r="5"><title>Error ${rd(p.y)} e at ${rd(p.x)} e</title></circle>`});
 return s+'</svg>'}
function paint(){const r=S.cur;if(!r)return;const c=C(r);LAST=c;ISS=validate(r);
 $$('[data-o]').forEach(el=>{const o=c.O[el.dataset.o];el.textContent=o?o.t:'—';el.className='out'+(o&&o.c?' '+o.c:'')});
 const bad=new Set(ISS.filter(x=>x.p).map(x=>x.p));$$('[data-p]').forEach(el=>{if(el.type!=='checkbox')el.classList.toggle('bad',bad.has(el.dataset.p))});
 $$('[data-unit]').forEach(el=>el.textContent=r.inst.unit);
 const env=$('#env');if(env&&c.ready)env.innerHTML=envSVG(r,c);
 const dv=$('#derived');if(dv)dv.innerHTML=derived(r);
 const vl=$('#vlist');if(vl)vl.innerHTML=issuesHTML(S.step===4?ISS:ISS.filter(x=>x.step===S.step));
 $$('[data-tabv]').forEach(el=>{const v=c.V[el.dataset.tabv]||'pending';el.className='chip '+v;el.textContent=VL[v]});
 for(let k=0;k<3;k++){const n=ISS.filter(x=>x.lvl==='err'&&x.step===k).length;const b=$('[data-sb="'+k+'"]');if(b){b.hidden=!n;b.textContent=n}}
 const st=$('#strip');if(st)st.innerHTML=`<div><small>Live compliance verdict against ${esc(RULES.edition)}</small><span class="vd ${c.overall}">${VL[c.overall]}</span></div><div style="text-align:right"><small>${esc(r.inst.mfr||'Manufacturer')} · ${esc(r.inst.model||'model')}</small><small>Class ${r.inst.cls} · ${r.inst.max||'?'} ${r.inst.unit} · e ${r.inst.e||'?'}</small></div>`;
 const sb=$('#submitBtn');if(sb){const errs=ISS.filter(x=>x.lvl==='err').length;const ok=errs===0&&(c.overall==='pass'||c.overall==='fail');sb.disabled=!ok;sb.title=ok?'':errs?'Fix the listed problems first':'Complete all applicable tests first'}}

/* ===================== report view ===================== */
function vRep(m){const r=S.cur;const ed=editable(r),rv=can('review')&&r.status==='Under review';
 m.innerHTML=`<div class="ph noprint"><div><h1>${esc(r.no)}</h1><p>${esc(r.inst.model)} · <span class="chip ${stLabel(r.status)}">${r.status}</span> <span class="chip ${overallOf(r)}">${VL[overallOf(r)]}</span></p></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap">${ed?`<button class="btn ghost" data-act="edit" data-id="${r.id}">Edit observations</button>`:''}${rv?`<button class="btn saf" data-act="approve">Approve and sign</button><button class="btn danger" data-act="return">Return with remarks</button>`:''}<button class="btn ghost" data-act="print">Print or save as PDF</button><button class="btn ghost" data-act="word">Export to Word</button>${can('del')?`<button class="btn danger" data-act="del">Delete</button>`:''}</div></div>
 ${r.remarks&&r.status==='Returned'?`<div class="iss noprint"><li class="warn" style="list-style:none">Reviewer remarks: ${esc(r.remarks)}</li></div>`:''}
 <div class="sheet rep">${reportInner(r)}</div>`}
const REP_LINKS=null;
function reportInner(r){const c=C(r),i=r.inst,l=r.lab,u=i.unit,pp=c.pp||2;const o=k=>c.O[k]?c.O[k].t:'—';const rv=k=>{const x=c.O[k];return x?`<span class="rv ${x.c}">${x.t}</span>`:'—'};
 const kv=a=>`<table class="kv">${a.map(x=>`<tr><td>${x[0]}</td><td>${esc(x[1]===''?'—':x[1])}</td></tr>`).join('')}</table>`;
 const vt=c.overall;const cn={pass:`The instrument model <b>${esc(i.model)}</b> (S/N ${esc(i.serial)}) <b>complies</b> with the tested requirements of ${esc(r.rules||RULES.edition)}. Every applicable test is within the permissible error.`,fail:`The instrument model <b>${esc(i.model)}</b> (S/N ${esc(i.serial)}) <b>does not comply</b> with the tested requirements of ${esc(r.rules||RULES.edition)}. One or more results exceed the permissible error.`,incomplete:'Evaluation is <b>incomplete</b>: some observations have not been recorded.',pending:'No observations have been recorded yet.'}[vt];
 const T=i.type;let h=`<div class="kick">Government of India · Ministry of Consumer Affairs, Food &amp; Public Distribution · Department of Consumer Affairs (Legal Metrology)</div><h1>Test Report</h1><div class="kick">Type evaluation of a non-automatic weighing instrument per ${esc(r.rules||RULES.edition)}</div>
 ${kv([['Report number',r.no],['Status',r.status],['Laboratory',l.name+(l.lid?' ('+l.lid+')':'')],['Date of test',fdate(l.date)],['Testing officer',l.tester]])}
 <h2>1. Applicant and instrument</h2>${kv([['Manufacturer / applicant',i.mfr],['Address',i.addr],['Model / type',i.model],['Serial number',i.serial],['Instrument type',T],['Application no.',i.appNo],['Software version',i.fw],['Load cell / sensor',i.sensor],['Accuracy class',i.cls+' – '+(RULES.classes[i.cls]?RULES.classes[i.cls].name:'')],['Max / Min',i.max+' / '+i.min+' '+u],['e / d',i.e+' / '+i.d+' '+u],['Number of intervals n',instReady(i)?rd(+i.max/+i.e):'—'],['Maximum tare',i.tareMax?i.tareMax+' '+u:'—'],['Declared temperature range',i.tmin+' to '+i.tmax+' °C'],['Power supply',i.volt]])}
 <h2>2. Test conditions and reference equipment</h2>${kv([['Test room',l.room],['Temperature (start / end)',l.t0+' / '+l.t1+' °C'],['Relative humidity',l.rh+' %'],['Air pressure',l.p+' hPa'],['Standard weights',l.wcls+', certificate '+l.wcert+', valid until '+fdate(l.wvalid)],['Thermometer / hygrometer',l.thermo]])}
 <h2>3. Test results</h2>`;
 if(r.app.weigh){h+=`<h3>3.1 Weighing test (zero error E₀ = ${o('z.E0')} ${u})</h3><table><tr><th rowspan="2">Load L (${u})</th><th rowspan="2" class="n">MPE</th><th colspan="4">Increasing</th><th colspan="4">Decreasing</th></tr><tr><th class="n">I</th><th class="n">ΔL</th><th class="n">Error</th><th>Result</th><th class="n">I</th><th class="n">ΔL</th><th class="n">Error</th><th>Result</th></tr>${r.tests.weigh.map((w,k)=>`<tr><td class="n">${esc(w.L)}</td><td class="n">${o('w.'+k+'.m')}</td><td class="n">${esc(w.iu)}</td><td class="n">${esc(w.du)}</td><td class="n">${o('w.'+k+'.u.Ec')}</td><td>${rv('w.'+k+'.u.r')}</td><td class="n">${esc(w.id)}</td><td class="n">${esc(w.dd)}</td><td class="n">${o('w.'+k+'.d.Ec')}</td><td>${rv('w.'+k+'.d.r')}</td></tr>`).join('')}</table>`}
 if(r.app.ecc){h+=`<h3>3.2 Eccentricity test (load ${esc(r.tests.ecc.L)} ${u}, MPE ${o('e.m')})</h3><table><tr><th>Position</th><th class="n">I</th><th class="n">ΔL</th><th class="n">Error</th><th>Result</th></tr>${r.tests.ecc.pos.map((p,k)=>`<tr><td>${k+1}</td><td class="n">${esc(p.I)}</td><td class="n">${esc(p.dL)}</td><td class="n">${o('e.'+k+'.Ec')}</td><td>${rv('e.'+k+'.r')}</td></tr>`).join('')}</table>`}
 if(r.app.rep){h+=`<h3>3.3 Repeatability test</h3><table><tr><th>Load (${u})</th><th class="n">Error run 1</th><th class="n">Run 2</th><th class="n">Run 3</th><th class="n">Spread</th><th class="n">MPE</th><th>Result</th></tr>${r.tests.rep.map((s,k)=>`<tr><td>${esc(s.L)}</td><td class="n">${o('p.'+k+'.0.E')}</td><td class="n">${o('p.'+k+'.1.E')}</td><td class="n">${o('p.'+k+'.2.E')}</td><td class="n">${o('p.'+k+'.sp')}</td><td class="n">${o('p.'+k+'.m')}</td><td>${rv('p.'+k+'.r')}</td></tr>`).join('')}</table>`}
 if(r.app.tare){h+=`<h3>3.4 Tare weighing (tare ${esc(r.tests.tare.tare)} ${u}, E₀ = ${o('t.E0')})</h3><table><tr><th>Net load (${u})</th><th class="n">I</th><th class="n">ΔL</th><th class="n">Error</th><th class="n">MPE</th><th>Result</th></tr>${r.tests.tare.rows.map((w,k)=>`<tr><td>${esc(w.L)}</td><td class="n">${esc(w.I)}</td><td class="n">${esc(w.dL)}</td><td class="n">${o('t.'+k+'.Ec')}</td><td class="n">${o('t.'+k+'.m')}</td><td>${rv('t.'+k+'.r')}</td></tr>`).join('')}</table>`}
 if(r.app.temp){h+=`<h3>3.5 Effect of temperature (load ${esc(r.tests.temp.L)} ${u}, MPE ${o('x.m')})</h3><table><tr><th class="n">Temp °C</th><th class="n">E₀</th><th class="n">Zero drift / limit</th><th class="n">Error at load</th><th>Result</th></tr>${r.tests.temp.rows.map((w,k)=>`<tr><td class="n">${esc(w.T)}</td><td class="n">${o('x.'+k+'.z')}</td><td class="n">${o('x.'+k+'.dr')}</td><td class="n">${o('x.'+k+'.Ec')}</td><td>${rv('x.'+k+'.r')}</td></tr>`).join('')}</table>`}
 h+=`<h2>4. Summary and conclusion</h2><table><tr><th>Test</th><th>Result</th></tr>${TESTS.map(t=>`<tr><td>${t[1]}</td><td>${r.app[t[0]]?'<span class="rv '+(c.V[t[0]]==='pass'?'pass':c.V[t[0]]==='fail'?'fail':'')+'">'+VL[c.V[t[0]]||'pending']+'</span>':'Not applicable'}</td></tr>`).join('')}</table><div class="concl ${vt}">${cn}</div>${r.remarks?`<p><b>Remarks:</b> ${esc(r.remarks)}</p>`:''}`;
 if(r.photos.length)h+=`<h2>5. Photographs</h2><div class="ph">${r.photos.map(p=>`<figure><img src="${esc(p.src)}" alt=""><figcaption>${esc(p.cap)}</figcaption></figure>`).join('')}</div>`;
 if(r.docs.length)h+=`<p><b>Supporting documents:</b> ${r.docs.map(d=>esc(d.name)).join('; ')}</p>`;
 const sg=(s,role,nm)=>`<div>${s&&s.img?`<img src="${s.img}" alt="signature">`:''}${esc(s?s.name:nm)}<br>${role}${s?'<br>'+fdate(s.at):''}</div>`;
 h+=`<h2>${r.photos.length?'6':'5'}. Signatures</h2><div class="sigs">${sg(r.sig.tester,'Testing officer',l.tester)}${sg(r.sig.reviewer,'Approving officer','')}</div>`;
 h+=`<p class="small">Document integrity (SHA-256 of the recorded data): ${esc(r.hash&&r.hash!=='seed'?r.hash:'issued on approval')}<br>Rule set: ${esc(r.rules||RULES.edition)} · Generated by NAWI Report Studio, ${fdate(new Date().toISOString())}</p>`;
 return h}

/* ===================== actions ===================== */
async function digest(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h1=0xdeadbeef,h2=0x41c6ce57;for(let k=0;k<s.length;k++){const ch=s.charCodeAt(k);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(16).padStart(16,'0')+' (fallback hash)'}}
function dl(name,mime,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},600)}
function modal(html){$('#modal').innerHTML=`<div class="ov"><div class="box" role="dialog" aria-modal="true">${html}</div></div>`}
const closeModal=()=>{$('#modal').innerHTML=''};
function signPad(title,optional,cb){modal(`<h3>${title}</h3><p class="hint">Draw your signature below. It is embedded in the report and covered by the integrity hash.</p><canvas id="pad" width="420" height="160"></canvas><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" id="pClr">Clear</button>${optional?'<button class="btn ghost" id="pSkip">Skip</button>':''}<button class="btn" id="pOk">Apply signature</button></div>`);
 const cv=$('#pad'),x=cv.getContext('2d');x.lineWidth=2.2;x.lineCap='round';x.strokeStyle='#16285E';let dr=false,dirty=false;
 const pos=e=>{const b=cv.getBoundingClientRect();return[(e.clientX-b.left)*cv.width/b.width,(e.clientY-b.top)*cv.height/b.height]};
 cv.onpointerdown=e=>{dr=true;dirty=true;const[a,b]=pos(e);x.beginPath();x.moveTo(a,b);cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!dr)return;const[a,b]=pos(e);x.lineTo(a,b);x.stroke()};cv.onpointerup=()=>{dr=false};
 $('#pClr').onclick=()=>{x.clearRect(0,0,cv.width,cv.height);dirty=false};
 if(optional)$('#pSkip').onclick=()=>{closeModal();cb('')};
 $('#pOk').onclick=()=>{if(!dirty){toast('Draw a signature first');return}const d=cv.toDataURL('image/png');closeModal();cb(d)}}
function shrink(file){return new Promise(res=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,560/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};im.onerror=()=>res('');im.src=fr.result};fr.readAsDataURL(file)})}
function openReport(id,edit){const r=S.reports.find(x=>x.id===id);S.cur=r;S.step=0;S.tab='weigh';if(edit&&editable(r))go('wiz');else go('rep')}
const ACT={
 login(a){S.user=USERS.find(u=>u.role===a.dataset.role);S.view='dash';log('Signed in','');render()},
 logout(){S.user=null;S.cur=null;render()},
 nav(a){const v=a.dataset.v;if(v==='new'){S.cur=newReport();S.step=0;S.tab='weigh';go('wiz')}else go(v)},
 guided(){const r=newReport();fillDemo(r,{seed:S.reports.length+2});S.cur=r;S.step=2;S.tab='weigh';save();go('wiz');toast('Report created with sample readings – edit any reading and the verdict updates')},
 open(a,e){e.preventDefault();openReport(a.dataset.id,false)},
 edit(a){openReport(a.dataset.id,true)},
 step(a){S.step=+a.dataset.n;const st=$('#stage');if(st){stage();$$('.nav-row').forEach(n=>n.remove());const m=$('#main'),r=S.cur,ed=editable(r);m.insertAdjacentHTML('beforeend',`<div class="nav-row noprint"><button class="btn ghost" data-act="step" data-n="${Math.max(0,S.step-1)}" ${S.step===0?'disabled':''}>Back</button><span style="display:flex;gap:8px"><button class="btn ghost" data-act="saved">Save draft</button>${S.step<4?`<button class="btn" data-act="step" data-n="${S.step+1}">Next: ${STEPS[S.step+1]}</button>`:''}</span></div>`);window.scrollTo(0,0)}},
 tab(a){S.tab=a.dataset.t;stage()},
 saved(){S.cur.updated=new Date().toISOString();save();toast('Draft saved')},
 preview(){go('rep')},
 demo(){const r=S.cur;fillDemo(r,{seed:S.reports.length+3});save();stage();toast('Sample readings filled – all tests are within tolerance')},
 fault(){const r=S.cur;if(!instReady(r.inst)){toast('Enter the instrument details first');return}ensureLoads(r);const e=+r.inst.e,d=+r.inst.d||e,w=r.tests.weigh[r.tests.weigh.length-1];if(nn(w.iu)==null)fillDemo(r,{seed:9});const L=+w.L,En=1.8*e,I=Math.round((L+En)/d)*d;w.iu=String(rd(I));w.du=String(rd(Math.max(0,I+0.5*d-L-En)));S.tab='weigh';S.step=2;save();stage();toast('Reading at Max now exceeds the permissible error')},
 suggest(){const r=S.cur;if(!confirm('Replace the load points with those suggested for this class? Entered readings in the weighing table will be cleared.'))return;ensureLoads(r,true);S.cur.tests.weigh.forEach(w=>{w.iu=w.du=w.id=w.dd=''});stage()},
 addrow(a){const r=S.cur,k=a.dataset.k;if(k==='weigh')r.tests.weigh.push({L:'',iu:'',du:'',id:'',dd:''});if(k==='tare')r.tests.tare.rows.push({L:'',I:'',dL:''});if(k==='temp')r.tests.temp.rows.push({T:'',zI:'',zd:'',I:'',dL:''});save();stage()},
 rmrow(a){const r=S.cur,k=a.dataset.k,i=+a.dataset.i;if(k==='weigh')r.tests.weigh.splice(i,1);if(k==='tare')r.tests.tare.rows.splice(i,1);if(k==='temp')r.tests.temp.rows.splice(i,1);save();stage()},
 rmphoto(a){S.cur.photos.splice(+a.dataset.i,1);save();stage()},
 rmdoc(a){S.cur.docs.splice(+a.dataset.i,1);save();stage()},
 mode(a){S.mode=a.dataset.m;go('repo')},
 csv(){const rows=[['Report no','Manufacturer','Model','Serial','Class','Max','e','Unit','Test date','Result','Status']].concat(filtered().map(r=>[r.no,r.inst.mfr,r.inst.model,r.inst.serial,r.inst.cls,r.inst.max,r.inst.e,r.inst.unit,r.lab.date,VL[overallOf(r)],r.status]));dl('nawi-report-register.csv','text/csv',rows.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'))},
 print(){window.print()},
 word(){const r=S.cur;const css=REP_CSS_WORD;dl(r.no.replace(/\//g,'-')+'.doc','application/msword',`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(r.no)}</title><style>${css}</style></head><body><div class="rep">${reportInner(r)}</div></body></html>`);log('Exported to Word',r.no)},
 del(){const r=S.cur;if(!confirm('Delete report '+r.no+'? This cannot be undone.'))return;S.reports=S.reports.filter(x=>x.id!==r.id);save();log('Deleted report',r.no);S.cur=null;go('repo')},
 submit(){const r=S.cur;signPad('Sign as testing officer',true,async img=>{r.sig.tester={img,name:S.user.name,at:new Date().toISOString()};r.status='Under review';r.updated=new Date().toISOString();r.rules=RULES.edition;save();log('Submitted for review',r.no);toast('Submitted to the approving officer');go('rep')})},
 approve(){const r=S.cur;signPad('Approve and sign as approving officer',false,async img=>{r.sig.reviewer={img,name:S.user.name,at:new Date().toISOString()};r.status='Approved';r.rules=RULES.edition;r.hash='';r.hash=await digest(JSON.stringify({no:r.no,inst:r.inst,lab:r.lab,tests:r.tests,app:r.app,rules:r.rules}));r.updated=new Date().toISOString();save();log('Approved and signed',r.no);toast('Report approved and sealed with a SHA-256 hash');go('rep')})},
 return(){const r=S.cur;modal(`<h3>Return with remarks</h3><p class="hint">Tell the testing officer what to correct.</p><textarea class="tx" id="rmk" rows="4" style="width:100%"></textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" id="rCancel">Cancel</button><button class="btn danger" id="rOk">Return report</button></div>`);$('#rCancel').onclick=closeModal;$('#rOk').onclick=()=>{const v=$('#rmk').value.trim();if(!v){toast('Add a remark first');return}r.remarks=v;r.status='Returned';r.updated=new Date().toISOString();save();log('Returned with remarks',r.no);closeModal();go('rep')}},
 applyrules(){try{const j=JSON.parse($('#rulesTx').value);if(!j.edition||!j.classes)throw new Error('Missing "edition" or "classes"');['I','II','III','IIII'].forEach(k=>{const c=j.classes[k];if(!c||!Array.isArray(c.bands)||!Array.isArray(c.n)||!(c.minMult>0)||!(c.tempC>0))throw new Error('Class '+k+' is incomplete')});RULES=j;store.set('nawi.rules.v1',RULES);log('Rule set updated to '+RULES.edition,'');toast('Rule set applied: '+RULES.edition);go('std')}catch(err){toast('Rule set rejected: '+err.message)}},
 resetrules(){RULES=clone(DEFAULT_RULES);store.set('nawi.rules.v1',RULES);log('Rule set restored to defaults','');go('std')}
};
const REP_CSS_WORD='.rep{font-family:Georgia,serif;font-size:10.5pt;color:#111}.rep h1{font-size:19pt;margin:0}.rep h2{font-size:12.5pt;color:#16285E;border-bottom:1.5pt solid #16285E;margin-top:14pt}.rep h3{font-size:11pt}.rep table{border-collapse:collapse;width:100%}.rep th,.rep td{border:.75pt solid #9AA3B2;padding:2pt 5pt;font-size:9.5pt;text-align:left}.rep th{background:#E9EDF5}.rep .n{text-align:right}.rep .kv td:first-child{background:#F4F6FA;font-weight:bold;width:28%}.rep .rv{font-weight:bold}.rep .rv.pass{color:#1E7B4F}.rep .rv.fail{color:#B42318}.rep .concl{border:1.5pt solid #16285E;padding:8pt}.rep .sigs{display:flex}.rep .small{font-size:8.5pt;color:#555}.rep img{max-width:170pt}.kick{font-size:9pt;color:#555}';
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&ACT[a.dataset.act]){ACT[a.dataset.act](a,e)}else if(e.target.closest('.drop')){}});
document.addEventListener('input',e=>{const el=e.target;if(el.id==='q'){S.q=el.value;$('#repobody').innerHTML=repoBody();return}
 if(!el.dataset||!el.dataset.p||el.type==='checkbox')return;const r=S.cur;if(!r||!editable(r))return;setp(r,el.dataset.p,el.value);r.updated=new Date().toISOString();clearTimeout(input.h);input.h=setTimeout(save,400);paint()});
function input(){}
document.addEventListener('change',async e=>{const el=e.target;
 if(el.id==='fs'||el.id==='fv'||el.id==='fc'){S[el.id]=el.value;$('#repobody').innerHTML=repoBody();return}
 if(el.id==='fphoto'){const r=S.cur;for(const f of el.files){const src=await shrink(f);if(src)r.photos.push({cap:f.name.replace(/\.[^.]+$/,''),src})}save();stage();return}
 if(el.id==='fdoc'){const r=S.cur;for(const f of el.files)r.docs.push({name:f.name,size:f.size});save();stage();return}
 if(el.dataset&&el.dataset.p){const r=S.cur;if(!r||!editable(r))return;if(el.type==='checkbox'){setp(r,el.dataset.p,el.checked?1:0);save();stage();return}
  setp(r,el.dataset.p,el.value);save();if(el.dataset.p==='inst.cls'||el.dataset.p==='inst.unit')paint()}});
render();
