'use strict';
const $=id=>document.getElementById(id),canvas=$('track'),ctx=canvas.getContext('2d');
// Three original circuit layouts inspired by real racing design principles.
// Same track IDs are retained to preserve Firebase leaderboard compatibility.
const circuits={
 speed:[[115,225],[125,145],[210,112],[480,112],[635,115],[710,158],[718,275],[675,360],[555,402],[270,402],[132,363],[98,303]],
 technical:[[115,132],[290,120],[425,128],[470,185],[414,228],[322,206],[292,272],[370,319],[470,283],[600,247],[700,287],[664,385],[518,408],[425,371],[300,415],[163,381],[100,314],[174,247],[102,203]],
 grand:[[105,160],[225,118],[415,118],[490,156],[645,122],[708,177],[665,237],[560,260],[602,318],[701,342],[650,402],[510,408],[445,361],[357,388],[245,422],[116,381],[91,312],[170,273],[135,224]]
};
const tyres={soft:{grip:1.20,wear:.013},medium:{grip:1.06,wear:.008},hard:{grip:.95,wear:.0045}};
const state={running:false,finished:false,started:false,distance:0,speed:0,battery:80,aero:'LOW DRAG',time:0,lapStart:0,laps:[],best:Infinity,tyreWear:0,offTrack:0,incidentCooldown:0,incidents:0};
const input={gas:false,brake:false,boost:false};let points=[],length=0,prev=null,boosting=false;
function makeTrack(){const anchors=circuits[$('circuit').value],samples=[];for(let i=0;i<anchors.length;i++){const p0=anchors[(i-1+anchors.length)%anchors.length],p1=anchors[i],p2=anchors[(i+1)%anchors.length],p3=anchors[(i+2)%anchors.length];for(let j=0;j<24;j++){let t=j/24,t2=t*t,t3=t2*t;let coord=k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3);samples.push({x:coord(0),y:coord(1)})}}points=[];length=0;for(let i=0;i<samples.length;i++){const a=samples[i],b=samples[(i+1)%samples.length];let segment=Math.hypot(b.x-a.x,b.y-a.y);points.push({...a,d:length,seg:segment});length+=segment}draw()}
function pos(distance){let d=((distance%length)+length)%length;let lo=0,hi=points.length-1;while(lo<hi){let mid=(lo+hi+1)>>1;if(points[mid].d<=d)lo=mid;else hi=mid-1}const a=points[lo],b=points[(lo+1)%points.length],t=Math.min(1,(d-a.d)/Math.max(a.seg,.0001));return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x),index:lo}}
function cornerSeverity(distance){
 // Heading change over a 55 m window gives a continuous estimate of bend severity.
 const before=pos(distance-27.5),after=pos(distance+27.5);
 const delta=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
 return Math.abs(delta);
}
function cornerLimit(severity,grip,downforce){
 // Gentle bends allow racing speeds; hairpins demand heavy braking.
 const base=severity<.12?355:Math.max(68,255/(1+severity*2.4));
 return Math.min(355,base*grip*(downforce?1.16:1));
}
function draw(){ctx.fillStyle='#28503a';ctx.fillRect(0,0,800,520);
// Trackside gravel and runoff add circuit depth without affecting the physics.
ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
ctx.strokeStyle='#b7a586';ctx.lineWidth=113;ctx.stroke();
ctx.strokeStyle='#355d49';ctx.lineWidth=102;ctx.stroke();ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#f2f2f2';ctx.lineWidth=84;ctx.stroke();ctx.strokeStyle='#db3d3e';ctx.lineWidth=79;ctx.setLineDash([16,16]);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#303640';ctx.lineWidth=65;ctx.stroke();ctx.strokeStyle='#8e99a6';ctx.lineWidth=1.5;ctx.setLineDash([8,14]);ctx.stroke();ctx.setLineDash([]);const s=pos(0);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);for(let i=0;i<8;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?'#111':'#fff';ctx.fillRect(-8+j*8,-36+i*9,8,9)}ctx.restore();const p=pos(state.distance);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);if(boosting){ctx.fillStyle='#2ac6ff';ctx.beginPath();ctx.moveTo(-17,-6);ctx.lineTo(-43,0);ctx.lineTo(-17,6);ctx.fill()}ctx.fillStyle='#ff3543';ctx.fillRect(-20,-8,40,16);ctx.fillStyle='#0c1017';for(const x of [-13,10])for(const y of [-13,8])ctx.fillRect(x,y,10,5);ctx.fillStyle='#f8f8f8';ctx.fillRect(4,-5,9,10);ctx.restore()}
function fmt(s){if(!Number.isFinite(s))return '--:--.---';const m=Math.floor(s*1000);return `${Math.floor(m/60000)}:${String(Math.floor(m/1000)%60).padStart(2,'0')}.${String(m%1000).padStart(3,'0')}`}
function history(){let h=$('history');h.replaceChildren();state.laps.forEach((v,i)=>{let r=document.createElement('div');r.className='laprow'+(v===state.best?' best':'');let a=document.createElement('span'),b=document.createElement('b');a.textContent='LAP '+(i+1)+(v===state.best?' · BEST':'');b.textContent=fmt(v);r.append(a,b);h.append(r)})}
function update(dt){
 const compound=tyres[$('tyres').value]||tyres.medium;
 const severity=cornerSeverity(state.distance+Math.max(15,state.speed/3.6*.55));
 const grip=compound.grip*Math.max(.52,1-.006*state.tyreWear);
 const limit=cornerLimit(severity,grip,state.aero==='HIGH DOWNFORCE');
 state.incidentCooldown=Math.max(0,state.incidentCooldown-dt);
 if(state.offTrack>0){
   state.offTrack=Math.max(0,state.offTrack-dt);
   state.speed=Math.max(0,state.speed-180*dt);
   state.time+=dt;
   $('status').textContent='OFF TRACK! Lost time in runoff · brake earlier next lap.';
 }else{
   let acceleration=input.gas?40:0;
   acceleration-=(state.aero==='LOW DRAG'?.00012:.0003)*state.speed*state.speed;
   if(input.brake){acceleration-=115;if(state.speed>10)state.battery=Math.min(100,state.battery+35*dt)}
   boosting=input.boost&&input.gas&&!input.brake&&state.battery>0;
   if(boosting){acceleration+=115;state.battery=Math.max(0,state.battery-38*dt)}
   state.speed=Math.max(0,Math.min(355,state.speed+acceleration*dt));
   // Tyres degrade with distance, and overdriving accelerates wear.
   const overspeed=Math.max(0,state.speed-limit);
   state.tyreWear=Math.min(100,state.tyreWear+state.speed/3.6*dt*compound.wear*(1+Math.min(4,overspeed/35)));
   if(severity>.12&&overspeed>18&&state.incidentCooldown<=0){
     state.incidents++;
     state.offTrack=Math.min(2.8,1.1+overspeed/95);
     state.incidentCooldown=2.8;
     state.speed=Math.min(state.speed,Math.max(25,limit*.48));
     boosting=false;
     $('status').textContent='OFF TRACK! Corner entered too fast · '+state.offTrack.toFixed(1)+'s lost.';
   }else{
     $('status').textContent=severity>.12?
       ('CORNER · safe speed ~'+Math.round(limit)+' km/h · '+(overspeed>0?'BRAKE NOW!':'hold your line')):
       (boosting?'MGU-K DEPLOYED · strong acceleration!':'STRAIGHT · low drag reduces resistance');
   }
   const old=state.distance;
   state.distance+=state.speed/3.6*dt;
   state.time+=dt;
   if(Math.floor(state.distance/length)>Math.floor(old/length)){
     const crossing=(Math.floor(old/length)+1)*length;
     const f=(crossing-old)/(state.distance-old);
     const crossingTime=state.time-dt+f*dt;
     const lapTime=crossingTime-state.lapStart;
     state.lapStart=crossingTime;state.laps.push(lapTime);
     state.best=Math.min(state.best,lapTime);history();
     if(state.laps.length===3){finish();return}
   }
 }
 $('tyreWear').textContent=Math.round(state.tyreWear)+'%';
 $('lap').textContent=(state.laps.length+1)+' / 3';
 $('current').textContent=fmt(state.time-state.lapStart);
 $('best').textContent=fmt(state.best);
 $('speed').textContent=Math.round(state.speed)+' km/h';
 $('batteryFill').style.width=state.battery+'%';
 $('batteryText').textContent=Math.round(state.battery)+'%';
 $('boost').classList.toggle('active',boosting);
}
function frame(t){if(!state.running)return;if(prev===null)prev=t;let dt=Math.min((t-prev)/1000,.04);prev=t;update(dt);draw();if(state.running)requestAnimationFrame(frame)}
function finish(){state.running=false;state.finished=true;boosting=false;Object.keys(input).forEach(k=>input[k]=false);$('quit').hidden=true;$('overlay').hidden=false;$('overlayText').textContent='FINISHED · BEST LAP '+fmt(state.best);window.dispatchEvent(new CustomEvent('f1-race-finished',{detail:{name:$('name').value.trim()||'Driver',track:$('circuit').value,time:state.best}}));$('start').textContent='RACE AGAIN';$('circuit').disabled=false;$('name').disabled=false;$('tyres').disabled=false;draw()}
function start(){state.running=true;state.finished=false;state.distance=0;state.speed=0;state.battery=80;state.aero='LOW DRAG';state.time=0;state.lapStart=0;state.laps=[];state.best=Infinity;state.tyreWear=0;state.offTrack=0;state.incidentCooldown=0;state.incidents=0;$('tyreWear').textContent='0%';prev=null;boosting=false;Object.keys(input).forEach(k=>input[k]=false);$('aero').innerHTML='AERO<br><small>LOW DRAG</small>';$('current').textContent='0:00.000';$('best').textContent='--:--.---';$('lap').textContent='1 / 3';$('history').textContent='No completed laps yet';$('circuit').disabled=true;$('name').disabled=true;$('tyres').disabled=true;$('overlay').hidden=true;$('quit').hidden=false;requestAnimationFrame(frame)}
function quitRace(){
 if(!state.running)return;
 const abandonedLap=Math.min(3,state.laps.length+1);
 state.running=false;state.finished=false;boosting=false;prev=null;
 Object.keys(input).forEach(k=>input[k]=false);
 state.distance=0;state.speed=0;state.time=0;state.lapStart=0;
 state.laps=[];state.best=Infinity;state.tyreWear=0;state.offTrack=0;state.incidentCooldown=0;state.incidents=0;$('tyreWear').textContent='0%';state.battery=80;
 $('lap').textContent='1 / 3';$('current').textContent='0:00.000';
 $('best').textContent='--:--.---';$('speed').textContent='0 km/h';
 $('batteryFill').style.width='80%';$('batteryText').textContent='80%';
 $('history').textContent='No completed laps yet';
 $('boost').classList.remove('active');
 $('circuit').disabled=false;$('name').disabled=false;$('tyres').disabled=false;
 $('quit').hidden=true;$('overlay').hidden=false;
 $('overlayText').textContent='QUIT ON LAP '+abandonedLap+' · TRY AGAIN';
 $('start').textContent='START RACE';
 $('status').textContent='Race abandoned. No lap time was submitted.';
 draw();
}
$('quit').addEventListener('click',quitRace);
$('start').addEventListener('click',start);$('circuit').addEventListener('change',()=>{if(!state.running){state.distance=0;makeTrack()}});
function hold(id,key){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();if(!state.running)return;el.setPointerCapture(e.pointerId);input[key]=true});for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>input[key]=false)}hold('gas','gas');hold('brake','brake');hold('boost','boost');
$('aero').addEventListener('click',()=>{if(!state.running)return;state.aero=state.aero==='LOW DRAG'?'HIGH DOWNFORCE':'LOW DRAG';$('aero').innerHTML='AERO<br><small>'+state.aero+'</small>'});
const keys={ArrowUp:'gas',ArrowDown:'brake',' ':'boost'};document.addEventListener('keydown',e=>{if(!state.running)return;if(keys[e.key]){e.preventDefault();input[keys[e.key]]=true}if(e.key.toLowerCase()==='a'&&!e.repeat)$('aero').click()});document.addEventListener('keyup',e=>{if(keys[e.key])input[keys[e.key]]=false});window.addEventListener('blur',()=>Object.keys(input).forEach(k=>input[k]=false));makeTrack();
