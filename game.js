'use strict';
// Accessible arcade engineering model, not real F1 telemetry or FIA performance simulation.
const $=id=>document.getElementById(id),canvas=$('scene'),ctx=canvas.getContext('2d');
const definitions=[
 {name:'Speed Ring',desc:'Long straights · fast bends',level:'EASY',points:[[100,200],[350,155],[650,200],[720,340],[650,475],[340,510],[90,450],[30,330]]},
 {name:'Technical Circuit',desc:'Hairpins · frequent braking',level:'MEDIUM',points:[[100,130],[360,115],[480,200],[360,290],[170,250],[90,380],[260,505],[550,520],[680,420],[610,310],[680,160]]},
 {name:'Grand Prix Circuit',desc:'Straights · chicanes · tight bends',level:'HARD',points:[[95,150],[350,120],[590,155],[675,275],[540,335],[630,445],[495,520],[325,440],[180,515],[65,390],[175,290],[70,225]]}
];
let chosen=0,course=null,raf=0,last=null;
const game={running:false,name:'',color:'#f53942',distance:0,speed:0,energy:80,mode:'LOW DRAG',time:0,lapStart:0,laps:[],best:Infinity,penalty:0};
const held={gas:false,brake:false,boost:false};
function buildCourse(points){
 // Closed Catmull-Rom spline, sampled at a constant resolution and measured by arc length.
 const samples=[],n=points.length,steps=36;
 for(let i=0;i<n;i++)for(let j=0;j<steps;j++){
  const p0=points[(i-1+n)%n],p1=points[i],p2=points[(i+1)%n],p3=points[(i+2)%n],t=j/steps,t2=t*t,t3=t2*t;
  const calc=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);
  samples.push({x:calc(0),y:calc(1)});
 }
 let length=0;for(let i=0;i<samples.length;i++){samples[i].s=length;const a=samples[i],b=samples[(i+1)%samples.length];length+=Math.hypot(b.x-a.x,b.y-a.y)}
 return {samples,length};
}
function at(s){
 const arr=course.samples;let d=((s%course.length)+course.length)%course.length;
 let lo=0,hi=arr.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(arr[m].s<=d)lo=m;else hi=m-1}
 const a=arr[lo],b=arr[(lo+1)%arr.length],span=(lo===arr.length-1?course.length: b.s)-a.s;
 const f=Math.max(0,Math.min(1,(d-a.s)/span));return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
function curvature(d){const p=at(d-20),q=at(d+20);let diff=Math.atan2(Math.sin(q.angle-p.angle),Math.cos(q.angle-p.angle));return Math.abs(diff)/40}
function fmt(s){if(!Number.isFinite(s))return '--:--.---';const ms=Math.floor(s*1000+1e-7);return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
function draw(){
 const w=canvas.width,h=canvas.height,p=at(game.distance);ctx.clearRect(0,0,w,h);ctx.save();
 // Camera follows the vehicle; scale is tuned for a phone-sized viewport.
 ctx.translate(w/2,h*.53);ctx.scale(1.15,1.15);ctx.translate(-p.x,-p.y);
 ctx.fillStyle='#27553d';ctx.fillRect(-500,-500,1800,1600);
 const path=()=>{ctx.beginPath();course.samples.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath()};
 path();ctx.lineJoin='round';ctx.strokeStyle='#e8e8e8';ctx.lineWidth=78;ctx.stroke();
 path();ctx.strokeStyle='#d93637';ctx.lineWidth=72;ctx.setLineDash([15,15]);ctx.stroke();ctx.setLineDash([]);
 path();ctx.strokeStyle='#303640';ctx.lineWidth=61;ctx.stroke();
 path();ctx.strokeStyle='#89929b';ctx.lineWidth=1.5;ctx.setLineDash([13,17]);ctx.stroke();ctx.setLineDash([]);
 const start=at(0);ctx.save();ctx.translate(start.x,start.y);ctx.rotate(start.angle);for(let x=-29;x<30;x+=10)for(let y=-7;y<8;y+=7){ctx.fillStyle=((x+29)/10+(y+7)/7)%2===0?'white':'#111';ctx.fillRect(-5+y,x,7,10)}ctx.restore();
 // Player car (nose to the right)
 ctx.translate(p.x,p.y);ctx.rotate(p.angle);
 if(held.boost&&held.gas&&game.energy>0&&!held.brake){ctx.fillStyle='#1bc8ff';ctx.beginPath();ctx.moveTo(-20,-7);ctx.lineTo(-49-Math.random()*15,0);ctx.lineTo(-20,7);ctx.fill()}
 ctx.fillStyle='#101318';ctx.fillRect(-15,-15,12,8);ctx.fillRect(-15,7,12,8);ctx.fillRect(9,-15,12,8);ctx.fillRect(9,7,12,8);
 ctx.fillStyle=game.color;ctx.fillRect(-22,-7,46,14);ctx.fillRect(13,-12,6,24);ctx.fillRect(-23,-13,5,26);ctx.fillStyle='#c8e8ff';ctx.fillRect(2,-4,9,8);
 ctx.restore();
}
function update(dt){
 const corner=curvature(game.distance+30);const inCorner=corner>.0027;
 // Track units are scaled to distance units; speeds are displayed in arcade km/h.
 let a=(held.gas?48:0)-(game.mode==='LOW DRAG'?.00024:.00044)*game.speed*game.speed;
 if(held.brake){a-=130;if(game.speed>15)game.energy=Math.min(100,game.energy+35*dt)}
 const deploying=held.boost&&held.gas&&!held.brake&&game.energy>0;
 if(deploying){a+=115;game.energy=Math.max(0,game.energy-35*dt)}
 game.speed=Math.max(0,Math.min(355,game.speed+a*dt));
 const safe=inCorner?(game.mode==='HIGH DOWNFORCE'?205:135):355;
 if(game.speed>safe){game.speed=Math.max(safe,game.speed-(inCorner?230:0)*dt);game.penalty+=dt}
 const previous=game.distance;const step=game.speed/3.6*dt*1.9;
 game.distance+=step;game.time+=dt;
 const oldLap=Math.floor(previous/course.length),newLap=Math.floor(game.distance/course.length);
 if(newLap>oldLap){const crossing=(oldLap+1)*course.length;const f=step>0?(crossing-previous)/step:1;const crossingTime=game.time-dt+dt*f;const lapTime=crossingTime-game.lapStart;game.laps.push(lapTime);game.lapStart=crossingTime;game.best=Math.min(game.best,lapTime);renderHistory();if(game.laps.length>=3){finish();return}}
 $('lap').textContent=`${game.laps.length+1}/3`;$('current').textContent=fmt(game.time-game.lapStart);$('best').textContent=fmt(game.best);
 $('speed').textContent=`${Math.round(game.speed)} km/h`;$('energytext').textContent=`${Math.round(game.energy)}%`;$('energybar').style.width=`${game.energy}%`;
 $('zone').textContent=inCorner?'CORNER':'STRAIGHT';$('boost').classList.toggle('engaged',deploying);
 $('message').textContent=game.speed>safe+2?'⚠ GRIP LIMIT! Brake earlier or add downforce.':deploying?'⚡ MGU-K DEPLOYED — STRONG ELECTRIC ACCELERATION':inCorner?'CORNER: High downforce improves grip.':'STRAIGHT: Low drag reduces resistance.';
}
function frame(t){if(!game.running)return;if(last===null)last=t;const dt=Math.min((t-last)/1000,.04);last=t;update(dt);draw();if(game.running)raf=requestAnimationFrame(frame)}
function renderHistory(){const html=game.laps.map((v,i)=>`<div class="laprow ${Math.abs(v-game.best)<1e-7?'fast':''}"><span>Lap ${i+1}${Math.abs(v-game.best)<1e-7?' · BEST':''}</span><span>${fmt(v)}</span></div>`).join('');$('history').innerHTML=html;$('finalhistory').innerHTML=html}
function finish(){game.running=false;Object.keys(held).forEach(k=>held[k]=false);$('race').hidden=true;$('finish').hidden=false;$('summary').textContent=`${game.name} · ${definitions[chosen].name}`;$('result').textContent=fmt(game.best);const key=`f1-record-${chosen}`,prior=Number(localStorage.getItem(key));if(!prior||game.best<prior)localStorage.setItem(key,String(game.best));}
function start(){course=buildCourse(definitions[chosen].points);Object.assign(game,{running:true,name:$('name').value.trim()||'Driver',color:$('color').value,distance:0,speed:0,energy:80,mode:'LOW DRAG',time:0,lapStart:0,laps:[],best:Infinity,penalty:0});Object.keys(held).forEach(k=>held[k]=false);$('menu').hidden=true;$('finish').hidden=true;$('race').hidden=false;$('aero').innerHTML='LOW DRAG<br><small>TAP TO SWITCH</small>';$('aero').classList.remove('downforce');$('history').textContent='Complete a lap to record a time.';$('best').textContent='--:--.---';$('current').textContent='0:00.000';$('lap').textContent='1/3';last=null;cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}
function hold(id,key){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held[key]=true});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>held[key]=false)}
hold('gas','gas');hold('brake','brake');hold('boost','boost');
$('aero').addEventListener('click',()=>{if(!game.running)return;game.mode=game.mode==='LOW DRAG'?'HIGH DOWNFORCE':'LOW DRAG';$('aero').innerHTML=`${game.mode}<br><small>TAP TO SWITCH</small>`;$('aero').classList.toggle('downforce',game.mode==='HIGH DOWNFORCE')});
const keys={ArrowUp:'gas',ArrowDown:'brake',' ':'boost'};document.addEventListener('keydown',e=>{if(!game.running)return;if(keys[e.key]){e.preventDefault();held[keys[e.key]]=true}if(e.key.toLowerCase()==='a'&&!e.repeat)$('aero').click()});document.addEventListener('keyup',e=>{if(keys[e.key])held[keys[e.key]]=false});window.addEventListener('blur',()=>Object.keys(held).forEach(k=>held[k]=false));
$('tracks').innerHTML=definitions.map((t,i)=>`<button class="trackcard ${i===0?'selected':''}" data-track="${i}"><span><b>${t.name}</b><small>${t.desc}</small></span><em>${t.level}</em></button>`).join('');$('tracks').addEventListener('click',e=>{const b=e.target.closest('[data-track]');if(!b)return;chosen=Number(b.dataset.track);document.querySelectorAll('.trackcard').forEach(el=>el.classList.toggle('selected',Number(el.dataset.track)===chosen))});$('start').addEventListener('click',start);$('again').addEventListener('click',start);$('menuBtn').addEventListener('click',()=>{$('finish').hidden=true;$('menu').hidden=false});
