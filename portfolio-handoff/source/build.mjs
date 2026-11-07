import * as A from './iso-kit.mjs';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const out = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../visuals/', import.meta.url));
mkdirSync(out, {recursive: true});
const W=820,H=435, base={x:0,y:0,w:288,d:118,r:8};
const camera=A.fitProjection([...A.boxCorners(base,-19,0),[116,43,79],[171,72,70]],W,H,{pad:35,azimuth:54,elevation:34});
const pt=p=>A.iso(p,camera);
const form=(x,y,w,d,r=2)=>({x,y,w,d,r});
const S=(x,y,w,d,z,h,tone='mid',r=2)=>A.solidSvg(A.slabOf(form(x,y,w,d,r),z,h,camera,5,Math.min(.9,h/4)),{tone,crease:'faint'});
const C=(x,y,r,z,h,tone='mid')=>A.solidSvg(A.cylinder(x,y,r,z,h,camera,24,Math.min(.6,h/4)),{tone,crease:'faint'});
const L=(p,q,tone='lo')=>A.lineSvg(A.segment(p,q,camera),{tone,free:true});
const D=(x,y,z,tone='hi',size=1.15)=>A.dotsSvg([pt([x,y,z])],{tone,size});
const outline=(x,y,w,d,z,tone='lo')=>A.lineSvg(A.planOutline(form(x,y,w,d),z,camera),{tone});
const screw=(x,y,z)=>C(x,y,1.6,z,.7,'lo')+L([x-1,y,z+.74],[x+1,y,z+.74],'hi');
const corners=(x,y,w,d,z)=>[[x+3,y+3],[x+w-3,y+3],[x+3,y+d-3],[x+w-3,y+d-3]].map(([u,v])=>screw(u,v,z)).join('');
const paper=(x,y,w=24,d=26,z=2,n=4)=>{
  let s='';
  for(let i=0;i<n;i++)s+=S(x,y,w,d,z+i*1.25,1.2,i===n-1?'hi':'mid',.75);
  const top=z+(n-1)*1.25+1.21;
  for(let i=0;i<5;i++)s+=L([x+4,y+5+i*3,top],[x+w-(i===4?9:4),y+5+i*3,top],i===0?'hi':'mid');
  return s;
};
const plate=()=>{
  let s='<path class="iso-halo" d="'+A.haloOf(base,-17,7,camera)+'"/>';
  for(const [x,y] of A.corners(base,14))s+=C(x,y,6,-17,7,'lo');
  s+=S(0,0,288,118,-10,10,'mid',8)+outline(5,5,278,108,0,'lo')+corners(0,0,288,118,0);
  s+=S(16,108,256,5,0,.65,'lo',1);
  const ticks=A.topTicks(19,269,5,5,109,.68,[1.7,3.5],camera);
  s+=A.lineSvg(ticks.minor,{tone:'lo'})+A.lineSvg(ticks.major,{tone:'mid'});
  return s;
};
const tray=(x,y,w,d,loaded=true)=>S(x,y,w,d,0,3,'mid')+S(x,y,2,d,3,5,'mid')+S(x,y,w,2,3,5,'mid')+S(x+w-2,y,2,d,3,5,'mid')+(loaded?paper(x+5,y+5,w-10,d-9,3,4):'');
const archive=(x,y,w=57,d=40)=>{
  let s=S(x-3,y-3,w+6,d+6,0,4,'mid')+S(x,y,w,d,4,3,'lo')+S(x,y,w,3,7,60,'mid');
  for(let h=9;h<59;h+=17){
    s+=S(x+2,y+4,w-4,d-7,h,2,'mid');
    for(let i=0;i<8;i++){
      const xx=x+6+i*(w-12)/8;
      s+=S(xx,y+6,(w-14)/8-1,d-15,h+2,10+(i*7%4),'mid',.45);
      s+=L([xx+.7,y+d-9,h+7],[xx+(w-14)/8-2,y+d-9,h+7],'hi');
    }
  }
  s+=S(x,y,3,d,7,60,'mid')+S(x+w-3,y,3,d,7,60,'mid')+S(x-1,y-1,w+2,d+2,67,3,'hi');
  s+=outline(x+3,y+3,w-6,d-6,70,'mid')+corners(x,y,w,d,70);
  return s;
};
const terminal=(x,y,w=40,d=28,approval=false)=>{
  let s='';
  for(const [u,v] of [[x+3,y+3],[x+w-6,y+3],[x+3,y+d-6],[x+w-6,y+d-6]])s+=S(u,v,3,3,0,17,'lo',.6);
  s+=S(x,y,w,d,17,4,'hi')+S(x+8,y+2,w-16,6,21,2,'mid');
  s+=S(x+w/2-3,y+5,6,3,23,12,'mid',1)+S(x+6,y+1,w-12,3,35,19,'hi',1.2);
  s+=S(x+8,y+4,w-16,1,37,14,'mid',.3);
  for(let i=0;i<4;i++)s+=L([x+11,y+5.02,39+i*2.5],[x+w-11-(i%2)*6,y+5.02,39+i*2.5],approval&&i===3?'lit':'hi');
  s+=S(x+5,y+15,w-13,8,21,1.5,'mid',1);
  for(let i=0;i<8;i++)for(let j=0;j<2;j++)s+=D(x+7+i*(w-17)/8,y+17+j*2.3,22.52,'mid',.65);
  return s;
};
const telephone=(x,y)=>{
  let s=S(x,y,48,34,0,5,'mid',4)+S(x+2,y+2,44,30,5,4,'hi',3);
  s+=S(x+6,y+4,36,8,9,2,'hi',3)+S(x+6,y+3,8,10,11,4,'mid',3)+S(x+34,y+3,8,10,11,4,'mid',3);
  s+=S(x+8,y+14,32,6,9,1,'mid');
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)s+=C(x+16+i*8,y+23+j*3.3,1.25,9,.65,'hi');
  return s;
};
const switchboard=(x,y)=>{
  let s=S(x,y,53,39,0,5,'lo')+S(x+1,y+1,51,37,5,13,'mid')+S(x,y,53,39,18,3,'hi');
  s+=outline(x+4,y+4,45,31,21,'mid')+corners(x,y,53,39,21);
  for(let i=0;i<6;i++)for(let j=0;j<3;j++)s+=C(x+8+i*7,y+9+j*8,1.7,21,1,i===3&&j===1?'hi':'mid')+D(x+8+i*7,y+9+j*8,22.1,i===3&&j===1?'lit':'lo',.85);
  for(let i=0;i<4;i++)s+=L([x+54,y+6+i*7,10],[x+54,y+9+i*7,10],'hi');
  return s;
};
const scanner=(x,y)=>{
  let s=tray(x,y,48,40,false)+paper(x+8,y+7,30,25,3,2);
  s+=S(x+7,y+2,5,5,3,29,'mid')+S(x+7,y+33,5,5,3,29,'mid');
  s+=S(x+7,y+1,25,38,32,6,'hi')+S(x+9,y+3,21,34,38,1.8,'mid');
  s+=corners(x+7,y+1,25,38,38)+L([x+30,y+6,32],[x+30,y+34,32],'lit');
  for(let i=0;i<5;i++)s+=L([x+12+i*3,y+8,39.9],[x+12+i*3,y+13,39.9],'mid');
  return s;
};
const envelope=(x,y)=>tray(x,y,42,34,false)+paper(x+6,y+6,29,22,3,3)
  +L([x+6,y+6,6.72],[x+20,y+18,6.72],'hi')+L([x+35,y+6,6.72],[x+20,y+18,6.72],'hi');
const route=(id,p,primary)=> {
  const q=p.map(([x,y])=>pt([x,y,.9]));
  const d=A.pathOf(q);
  const studs=q.map(([x,y])=>'<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2"/>').join('');
  const dust=[];
  for(let i=1;i<q.length;i++){
    const [x,y]=q[i-1],[u,v]=q[i];
    for(let t=.16;t<.96;t+=.15)dust.push('<circle cx="'+(x+(u-x)*t).toFixed(1)+'" cy="'+(y+(v-y)*t).toFixed(1)+'" r="1.2"/>');
  }
  return '<g class="route'+(primary?' active':'')+'" data-route="'+id+'"><path class="rail" d="'+d+'"/><path class="signal" d="'+d+'"/><g class="signal-dots">'+studs+dust.join('')+'</g><circle class="packet" r="3.4"><animateMotion dur="3s" repeatCount="indefinite" path="'+d+'"/></circle></g>';
};
const cases=[
 {key:'document-assistant',title:'AI document assistant',subtitle:'A shared record for the work',alt:'Notes, research, and reports enter a shared filing cabinet. The cabinet makes earlier work available to consultants.', result:'Research from a decade earlier helped a consultant win a contract.',
 routes:[
  ['Collect records',[[55,27],[81,27],[81,61],[113,61]],'Consultants and analysts add their notes, research, and reports to the client record.'],
  ['Find earlier work',[[172,61],[199,61],[199,73],[224,73]],'The team can find earlier reports and research when it needs them.'],
  ['Research input',[[55,63],[81,63],[81,61],[113,61]],'Material from the same client stays together.'],
  ['Reports input',[[55,95],[81,95],[81,61],[113,61]],'Earlier reports are available alongside newer work.']],
 art:()=>tray(19,12,36,29)+tray(19,49,36,29)+tray(19,82,36,27)+archive(113,37,59,48)+tray(224,56,42,34),
 terms:['Team inputs','Shared client record','Earlier work'], links:'Notes, research and reports → shared client record → retrieval of earlier work'},
 {key:'voice-receptionist',title:'AI voice receptionist',subtitle:'One call, two destinations',alt:'An incoming call enters a telephone switchboard and branches to the location’s front desk or to the catering owner.',result:'The owner reported more catering bookings after callers could get answers and book in one call.',
 routes:[
  ['Incoming call',[[66,60],[98,60],[98,58],[114,58]],'Callers can get answers and check availability across locations.'],
  ['Table booking',[[167,56],[193,56],[193,28],[222,28]],'A confirmed table booking goes to the front desk at the right location.'],
  ['Catering booking',[[167,66],[198,66],[198,90],[222,90]],'A confirmed catering request goes to the owner with the requirements captured.']],
 art:()=>telephone(18,43)+switchboard(114,41)+terminal(222,14,41,29)+terminal(222,75,41,29),
 terms:['Incoming call','Shared switchboard','Front desk / catering owner'],links:'Call → answer and confirm → location front desk or catering owner'},
 {key:'invoice-processing',title:'AI invoice processing',subtitle:'A deliberate point for review',alt:'Invoice documents pass through a scanner to an admin review desk. The email remains a draft until the admin approves it.',result:'The procurement team spent less of its day reading and filing invoices by hand.',
 routes:[
  ['Read and organise',[[53,63],[77,63],[77,57],[84,57]],'The assistant reads PDFs and photos and files the invoices where they belong.'],
  ['Review the draft',[[132,57],[153,57],[153,68],[159,68]],'The assistant flags items that need review and prepares a draft email.'],
  ['Approve and send',[[200,68],[218,68],[218,77],[230,77]],'The email stays in drafts until an admin approves it.']],
 art:()=>tray(17,47,36,33)+scanner(84,38)+terminal(159,52,41,33,true)+envelope(230,61),
 terms:['Invoice intake','Read and organise','Admin approval','Approved email'],links:'Invoice intake → read and organise → admin reviews draft → send after approval'},
 {key:'research-assistant',title:'AI research assistant',subtitle:'An answer needs evidence',alt:'Source documents enter an evidence cabinet. A research desk answers with citations when the collected material supports the answer or reports missing evidence.',result:'When tested with a made-up claim, the assistant reported that it could not find support in the collected material.',
 routes:[
  ['Collect sources',[[51,50],[67,50],[67,57],[80,57]],'Search on request and save material alongside its source details.'],
  ['Check the collection',[[129,57],[145,57],[145,66],[156,66]],'When answering, the assistant checks the material already collected.'],
  ['Cite the evidence',[[196,62],[216,62],[216,29],[230,29]],'The assistant connects a supported answer to its source.'],
  ['Show the gap',[[196,72],[217,72],[217,89],[230,89]],'When support is missing, the assistant says so.']],
 art:()=>tray(17,34,34,30)+archive(80,37,49,42)+terminal(156,49,40,33)+tray(230,15,34,29)+tray(230,76,34,29,false),
 terms:['Source discovery','Collected material','Evidence check','Citation / evidence gap'],links:'Search on request → collected sources → check question → cite evidence or report a gap'}
];
const skin=`
.iso-svg{--anatomy-paper:#3c3b39;--anatomy-face:#44413d;--anatomy-top:#62615e;--anatomy-shade-0:#272725;--anatomy-shade-1:#383735;--anatomy-shade-2:#484744;--anatomy-shade-3:#54534f;--anatomy-hi:#ddd9ce;--anatomy-mid:#aaa499;--anatomy-lo:#77736b;--anatomy-faint:#706c64;--anatomy-dot:#eee8da;--anatomy-lit:#ffddb6;--anatomy-weight:1px}
.rail{fill:none;stroke:#4f3a2a;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.signal{fill:none;stroke:#7d563c;stroke-width:1;stroke-linecap:round}
.signal-dots{fill:#ac784e}
.active .signal{stroke:#ff9b58;stroke-width:1.65}
.active .signal-dots{fill:#ffd3a6}
.packet{fill:#fff3de;visibility:hidden;filter:drop-shadow(0 0 5px #ff8a2a)}
.active .packet{visibility:visible}
@media(prefers-reduced-motion:reduce){.packet{visibility:hidden!important}}
`;
function applyStudyPalette(markup) {
  const tokens = new Map([...skin.matchAll(/(--anatomy-[\w-]+):([^;}]+)/g)].map(([, name, value]) => [name, value]));
  return markup.replace(/(--anatomy-[\w-]+):([^;}]+)(?=[;}])/g, (entry, name) => tokens.has(name) ? name + ':' + tokens.get(name) : entry);
}
function svg(item,still=false){
 const parts=item.routes.map(([,p],i)=>route(i,p,i===0)).join('');
 return A.figureSvg({width:W,height:H,label:item.alt,standalone:'dark',body:'<style>'+skin+(still?'.packet{display:none!important}.signal{stroke:#a56d44}.signal-dots{fill:#eab180}':'')+'</style>'+plate()+parts+item.art()});
}
for(const item of cases)writeFileSync(out+'/'+item.key+'.svg',applyStudyPalette(svg(item,true)));
const font=readFileSync(new URL('./SpaceGrotesk.ttf', import.meta.url)).toString('base64');
const esc=s=>s.replace(/[&<>"]/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[v]));
const html=cases.map((item,i)=>{
 const controls=item.routes.map(([name,,caption],j)=>`<button type="button" aria-pressed="${j===0}" data-index="${j}" data-caption="${esc(caption)}">${esc(name)}</button>`).join('');
 const architecture=item.terms.map((t,j)=>`<li><span>${String(j+1).padStart(2,'0')}</span>${esc(t)}</li>`).join('');
 return `<article id="${item.key}"><div class="eyebrow">Case ${String(i+1).padStart(2,'0')}</div><h2>${item.title}</h2><p class="result">${item.result}</p>${A.plateHtml({fig:'FIG '+String(i+1).padStart(2,'0'),title:item.subtitle,hint:'Choose a step below',body:svg(item)})}<div class="steps" aria-label="Explore the workflow">${controls}</div><p class="live" aria-live="polite">${item.routes[0][2]}</p><details><summary>Architecture at a glance</summary><ol class="architecture">${architecture}</ol><p>${item.links}</p></details></article>`;
}).join('');
const styles=`
@font-face{font-family:Space Grotesk;src:url(data:font/ttf;base64,${font}) format("truetype");font-weight:300 700;font-display:swap}
body{background:#0d0c0b;color:#f3eee4;font-family:Space Grotesk,system-ui,sans-serif}
.iso-page{margin:40px auto 90px}header{margin-bottom:36px}h1{font-size:clamp(42px,7vw,92px);line-height:.96;letter-spacing:-.065em;margin:12px 0 18px}header p{font-size:18px;color:#c6baaa;max-width:54ch}nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}a,button,summary{color:inherit}nav a,button{font:500 13px Space Grotesk,system-ui;text-decoration:none;border:1px solid #55463a;background:#1c1713;border-radius:4px;padding:9px 12px;cursor:pointer}nav a:hover,button:hover{border-color:#ff9b58}button[aria-pressed=true]{color:#ffb27e;border-color:#ff9b58;background:#2c1e16}a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #ff9b58;outline-offset:4px}
.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px 24px}article{border-top:1px solid #5c4b3d;padding:20px 0 0;scroll-margin-top:20px}h2{font-size:clamp(24px,3.1vw,42px);line-height:1.06;letter-spacing:-.045em;margin:6px 0 12px}.eyebrow{font-size:12px;color:#ffad76;text-transform:uppercase;letter-spacing:.12em}.result{min-height:3em;color:#d4c7b7;margin:0 0 16px}.iso-plate{--anatomy-card:#171716;--anatomy-muted:#bba38f;--anatomy-mono:Space Grotesk,system-ui;--anatomy-lift:none;border:1px solid #493b31;border-radius:5px}.steps{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.live{color:#e1d3c2;min-height:3em;margin:8px 0 16px}details{border-top:1px solid #493b31;padding:10px 0;color:#c6baaa}summary{cursor:pointer;font-weight:500}.architecture{padding:0;list-style:none;display:flex;gap:6px;flex-wrap:wrap}.architecture li{display:flex;gap:7px;align-items:center;border:1px solid #493b31;padding:5px 9px;font-size:12px}.architecture span{color:#ffad76;font-variant-numeric:tabular-nums}
@media(max-width:760px){.gallery{grid-template-columns:1fr}.result,.live{min-height:0}.iso-plate-corner[data-corner=hint]{display:none}}
`;
const script=`
const calm=matchMedia('(prefers-reduced-motion: reduce)');
const observe=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{const svg=target.querySelector('svg.iso-svg'); if(isIntersecting&&!calm.matches)svg?.unpauseAnimations();else svg?.pauseAnimations();}));
for(const article of document.querySelectorAll('article')){
 const svg=article.querySelector('svg.iso-svg');
 svg.pauseAnimations();observe.observe(article);
 for(const button of article.querySelectorAll('button'))button.addEventListener('click',()=>{
  for(const other of article.querySelectorAll('button'))other.setAttribute('aria-pressed',String(other===button));
  for(const route of article.querySelectorAll('[data-route]'))route.classList.toggle('active',route.dataset.route===button.dataset.index);
  article.querySelector('.live').textContent=button.dataset.caption;
  svg.setCurrentTime(0);
 });
}
calm.addEventListener('change',()=>{for(const svg of document.querySelectorAll('svg.iso-svg')){if(calm.matches)svg.pauseAnimations();else if(svg.getBoundingClientRect().bottom>0&&svg.getBoundingClientRect().top<innerHeight)svg.unpauseAnimations();}});
`;
const nav=cases.map((c,i)=>`<a href="#${c.key}">${String(i+1).padStart(2,'0')} · ${c.title.replace('AI ','')}</a>`).join('');
const body=`<style>${styles}</style><header><div class="eyebrow">One Question Later / Selected Work</div><h1>Four systems<br>at work.</h1><p>Choose a case, then follow a point of light through the workflow.</p><nav aria-label="Case studies">${nav}</nav></header><div class="gallery">${html}</div>`;
writeFileSync(out+'/isometric-case-studies.html',applyStudyPalette(A.pageHtml({title:'One Question Later — Four systems at work',body,script,width:1220})));
console.log('Built four Anatomy figures and one interactive preview.');
