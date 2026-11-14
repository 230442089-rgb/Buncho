// ---- エンジン（1）状態・地図生成・共通処理 ----
const W=21,H=21,VIEW=11;
const FLOOR_NAMES=['地下5階','地下4階','地下3階','地下2階','地下1階'];
const POOL=[['hug','pat','honey','feather'],
 ['hug','pat','honey','feather','whisper','massage','mimic'],
 ['hug','pat','honey','feather','whisper','massage','mimic','blind','aroma'],
 ['hug','pat','honey','feather','whisper','massage','mimic','blind','aroma','brush'],
 ['hug','pat','honey','feather','whisper','massage','mimic','blind','aroma','brush']];
const NENT=[5,6,7,8,9], NTRAP=[7,9,11,12,14], NITEM=[5,5,4,4,4], PRE=[0,0.1,0.2,0.3,0.45];
let G=null;
const R=()=>Math.random(), ri=(a,b)=>a+Math.floor(R()*(b-a+1)), pick=a=>a[Math.floor(R()*a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const K=(x,y)=>x+','+y;
const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)), man=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const walk=(x,y)=>inb(x,y)&&G.map[y][x]===0;
const entAt=(x,y)=>G.ents.find(e=>e.x===x&&e.y===y);
const freeCell=(x,y)=>walk(x,y)&&!entAt(x,y)&&!(G.p.x===x&&G.p.y===y)&&!(G.vol.on&&G.vol.x===x&&G.vol.y===y);
const tname=e=>'《'+(e.evo?TYPES[e.k].en:TYPES[e.k].n)+'》';
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

function log(t,c){ G.log.push({t,c:c||''}); if(G.log.length>80)G.log.shift(); }

function newGame(){
 G={fi:0,turn:0,ft:0,mode:'play',log:[],learn:{},evolved:{},bound:null,last:null,nid:1,over:null,
  p:{x:0,y:0,st:100,me:0,wave:2,mark:0,stat:{},weak:{},inv:['energy','mint'],stun:0,dash:false,dashed:false,decoy:true},
  vol:{g:0,on:false,x:0,y:0,rest:0,decoy:null,step:0,t50:false,t75:false},
  stats:{caught:0,freed:0,waves:0,evo:0}};
 genFloor();
 log('知らないソファの上で目が覚めた。上へ続く階段（▲）を探そう。','sys');
}

function bfs(sx,sy){
 const d=[];for(let y=0;y<H;y++)d.push(new Array(W).fill(-1));
 d[sy][sx]=0; const q=[[sx,sy]];
 for(let i=0;i<q.length;i++){const [x,y]=q[i];
  for(const [dx,dy] of DIRS){const nx=x+dx,ny=y+dy; if(walk(nx,ny)&&d[ny][nx]<0){d[ny][nx]=d[y][x]+1;q.push([nx,ny])}}}
 return d;
}

function genFloor(){
 const fi=G.fi;
 for(let attempt=0;attempt<20;attempt++){
  const m=[];for(let y=0;y<H;y++)m.push(new Array(W).fill(1));
  const rooms=[];
  for(let t=0;t<300&&rooms.length<9;t++){
   const w=ri(3,6),h=ri(3,5),x=ri(1,W-w-1),y=ri(1,H-h-1);
   if(rooms.some(r=>x<=r.x+r.w&&x+w>=r.x&&y<=r.y+r.h&&y+h>=r.y))continue;
   rooms.push({x,y,w,h,cx:x+(w>>1),cy:y+(h>>1)});
   for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)m[j][i]=0;
  }
  if(rooms.length<5)continue;
  const link=(a,b)=>{let x=a.cx,y=a.cy;
   const hx=()=>{while(x!==b.cx){m[y][x]=0;x+=Math.sign(b.cx-x)}}, vy=()=>{while(y!==b.cy){m[y][x]=0;y+=Math.sign(b.cy-y)}};
   if(R()<.5){hx();vy()}else{vy();hx()} m[y][x]=0;};
  const order=[rooms[0]], rest=rooms.slice(1);
  while(rest.length){const l=order[order.length-1];
   rest.sort((a,b)=>(Math.abs(a.cx-l.cx)+Math.abs(a.cy-l.cy))-(Math.abs(b.cx-l.cx)+Math.abs(b.cy-l.cy)));
   order.push(rest.shift())}
  for(let i=1;i<order.length;i++)link(order[i-1],order[i]);
  for(let i=0;i<3;i++){const a=pick(rooms),b=pick(rooms); if(a!==b)link(a,b)}
  G.map=m; G.seen=m.map(r=>r.map(()=>false));
  const s=order[0]; G.start={x:s.cx,y:s.cy}; G.p.x=s.cx; G.p.y=s.cy;
  const dist=bfs(s.cx,s.cy);
  let ex=null,best=-1; for(const r of rooms){const d=dist[r.cy][r.cx]; if(d>best){best=d;ex=r}}
  if(best<10)continue;
  G.exit={x:ex.cx,y:ex.cy};
  const cells=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(m[y][x]!==0||dist[y][x]<0)continue;
   if((x===s.cx&&y===s.cy)||(x===ex.cx&&y===ex.cy))continue;
   cells.push({x,y,d:dist[y][x]});
  }
  shuffle(cells);
  const take=min=>{const i=cells.findIndex(c=>c.d>=min); return i<0?null:cells.splice(i,1)[0]};
  G.traps=[];G.items=[];G.ents=[];G.goo={};
  const tp=Object.keys(TRAPS).filter(k=>TRAPS[k].min<=fi);
  for(let i=0;i<NTRAP[fi];i++){const c=take(3); if(c)G.traps.push({x:c.x,y:c.y,k:pick(tp),rev:false})}
  const bag=[];for(const k in ITEMS)for(let i=0;i<ITEMS[k].w;i++)bag.push(k);
  for(let i=0;i<NITEM[fi];i++){const c=take(2); if(c)G.items.push({x:c.x,y:c.y,k:pick(bag)})}
  const pool=shuffle(POOL[fi].slice());
  for(let i=0;i<NENT[fi];i++){const c=take(7); if(c)spawn(pool[i%pool.length],c.x,c.y,R()<PRE[fi])}
  G.ft=0; G.vol.on=false; G.vol.decoy=null; G.vol.rest=0;
  fov(); return;
 }
}

function spawn(k,x,y,pre){
 const e={id:G.nid++,k,evo:!!(G.evolved[k]||pre),x,y,stun:0,en:0,disg:k==='mimic',alert:false};
 G.ents.push(e); return e;
}

function los(x0,y0,x1,y1){
 let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
 while(!(x===x1&&y===y1)){
  const e2=2*err; if(e2>-dy){err-=dy;x+=sx} if(e2<dx){err+=dx;y+=sy}
  if(x===x1&&y===y1)break; if(G.map[y][x]===1)return false;
 }
 return true;
}
function fov(){
 const p=G.p; let r=5;
 if(p.stat.blind)r=1; else if(G.ents.some(e=>e.k==='blind'&&e.evo&&cheb(e,p)<=3))r=2;
 const vis=new Set();
 for(let y=p.y-r;y<=p.y+r;y++)for(let x=p.x-r;x<=p.x+r;x++){
  if(!inb(x,y))continue; if((x-p.x)**2+(y-p.y)**2>r*r+r)continue;
  if(los(p.x,p.y,x,y)){vis.add(K(x,y));G.seen[y][x]=true}
 }
 G.vis=vis; G.visR=r;
}

// 陥落度を上げる。src={k,evo} か {trap}。弱点・照れ・愛紋で増える
function addMelt(n,src,mul){
 const p=G.p; let m=n*(mul||1);
 const t=src&&src.k&&TYPES[src.k]; const wl=t?(p.weak[t.w]||0):0;
 m*=1+0.4*wl; if(p.stat.blush)m*=1.4; m*=1+0.08*p.mark;
 m=Math.max(1,Math.round(m)); p.me=Math.min(100,p.me+m); if(src)G.last=src; return m;
}
function addStatus(id,t){
 const p=G.p, was=p.stat[id]||0; p.stat[id]=Math.max(was,t);
 if(!was)log('状態異常【'+STATUS[id].n+'】'+STATUS[id].d,STATUS[id].good?'good':'bad');
}
function cure(ids){ let n=0; for(const id of ids){ if(G.p.stat[id]){delete G.p.stat[id];n++} } return n; }
function markUp(n){
 const p=G.p;
 for(let i=0;i<n&&p.mark<5;i++){ p.mark++; if(p.mark<5)log(MARK[p.mark].t+'【愛紋 '+p.mark+'/5：'+MARK[p.mark].n+'】','bad big'); }
 G.vol.g=Math.min(100,G.vol.g+10);
 if(p.mark>=5){ gameOver({kind:'mark'}); return true; }
 return false;
}
function weakRoll(id,ch){
 const p=G.p, lv=p.weak[id]||0; if(lv>=3||R()>ch)return;
 p.weak[id]=lv+1;
 log(WEAK[id].t[lv]+'【'+(lv===0?'弱点発覚':'弱点開発')+'：'+WEAK[id].n+' Lv'+(lv+1)+'】','bad big');
}
function alertAll(r){ for(const e of G.ents){ if(r===undefined||cheb(e,G.p)<=r)e.alert=true; } }
// 変質進化：逃げられるほど、消されるほど、その種は学習する
function learn(k,n){
 if(G.evolved[k])return;
 G.learn[k]=(G.learn[k]||0)+n;
 if(G.learn[k]>=3){
  G.evolved[k]=true; G.stats.evo++;
  for(const e of G.ents)if(e.k===k)e.evo=true;
  log('《'+TYPES[k].n+'》の記録が巣に流れた。変質する。《'+TYPES[k].en+'》へ。','bad big');
  log(pick(VOL_EVOLVE),'vol'); noteSeen(k,true);
 }
}
