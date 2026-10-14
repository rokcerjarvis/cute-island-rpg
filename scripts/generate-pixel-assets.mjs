// Original procedural prototype art. No downloaded assets or external packages.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
function canvas(w, h) {
  const data = Buffer.alloc(w * h * 4);
  const pixel = (x,y,c) => { x=Math.floor(x);y=Math.floor(y); if(x<0||y<0||x>=w||y>=h)return; const n=(y*w+x)*4;data[n]=c>>16&255;data[n+1]=c>>8&255;data[n+2]=c&255;data[n+3]=255; };
  const rect = (x,y,ww,hh,c) => { for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++)pixel(i,j,c); };
  const oval = (cx,cy,rx,ry,c) => { for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)pixel(x,y,c); };
  return {w,h,data,pixel,rect,oval};
}
function crc(buffer) { let n=0xffffffff;for(const b of buffer){n^=b;for(let i=0;i<8;i++)n=n&1?(n>>>1)^0xedb88320:n>>>1;}return(n^0xffffffff)>>>0; }
function chunk(type, data) { const t=Buffer.from(type); const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,sum]); }
function save(path,c) {
  const header=Buffer.alloc(13);header.writeUInt32BE(c.w);header.writeUInt32BE(c.h,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc((c.w*4+1)*c.h);for(let y=0;y<c.h;y++)c.data.copy(rows,y*(c.w*4+1)+1,y*c.w*4,(y+1)*c.w*4);
  const target=`public/assets/${path}.png`;mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
const ink=0x33493d,cream=0xfff0cf,blue=0x92c8cd,pink=0xe5a7b6,brown=0xb88d60;
const ids=['cute_001','cute_002','cute_003','cute_004','cute_005','evo_001','evo_002','mon_001','mon_002','mon_003'];
for(const id of ids){
  const boss=id==='mon_003', c=canvas(boss?64:40,boss?64:40);const{rect:r,oval:o,pixel:p}=c;
  if(boss){ o(32,37,27,24,ink);o(32,36,24,21,0x537966);r(8,4,9,24,ink);r(10,5,5,24,0x98aa74);r(45,1,10,25,ink);r(47,2,6,25,0x98aa74);o(15,39,10,9,0x749770);o(49,39,10,9,0x749770);r(20,30,6,4,0xf2ca75);r(39,30,6,4,0xf2ca75);r(25,46,15,3,ink);r(12,57,13,5,ink);r(40,57,13,5,ink); }
  else if(id==='mon_001'){for(let i=0;i<4;i++){r(3+i*9,29,3,6,ink);r(2+i*10,12,3,5,ink);}o(20,23,17,13,ink);o(20,21,14,10,0x5a6356);r(10,18,5,3,0xe9b25f);r(26,18,5,3,0xe9b25f);r(18,29,5,2,0xddb789);}
  else if(id==='mon_002'){o(20,23,17,15,ink);o(20,23,14,12,0xb3614d);r(7,6,5,10,ink);r(28,6,5,10,ink);o(20,27,12,8,0x493c39);r(9,21,22,3,cream);r(12,30,17,3,cream);r(11,14,5,3,0xffcb70);r(24,14,5,3,0xffcb70);}
  else {
    const cat=id==='cute_002',rabbit=id==='cute_003',squirrel=id==='cute_005'||id==='evo_002',evolved=id.startsWith('evo'),chestnut=id==='cute_004';
    const fill=cat?blue:rabbit?0xf1cd79:chestnut?brown:squirrel?0xc7cbd5:cream;
    if(squirrel){o(31,27,8,10,ink);o(32,26,6,8,0xa6adbd);}
    if(rabbit){r(11,1,6,18,ink);r(23,1,6,18,ink);r(13,2,2,17,0xf1cd79);r(25,2,2,17,0xf1cd79);}
    else if(cat){for(let y=3;y<13;y++){r(8,y,Math.floor((y-2)/2)+1,1,ink);r(32-Math.floor((y-2)/2),y,Math.floor((y-2)/2)+1,1,ink);}}
    else if(!chestnut){o(11,12,5,6,ink);o(28,12,5,6,ink);o(11,12,3,4,fill);o(28,12,3,4,fill);}
    o(20,26,evolved?15:13,12,ink);o(20,25,evolved?13:11,10,fill);o(20,28,8,7,cream);
    if(chestnut){o(20,17,13,9,ink);o(20,16,11,7,0x9e704f);}
    r(13,20,3,3,ink);r(25,20,3,3,ink);r(18,26,5,2,ink);r(10,25,3,2,pink);r(28,25,3,2,pink);r(11,36,6,3,ink);r(23,36,6,3,ink);
    if(cat){r(8,23,5,1,ink);r(29,23,5,1,ink);r(14,8,11,3,0x6ca8b5);}
    if(id==='cute_001'||id==='evo_001'){r(11,30,18,3,0x69adb6);r(26,31,4,5,0x69adb6);}
    if(evolved){p(19,3,0xe9b862);r(16,5,8,3,0xe9b862);}
    if(squirrel){r(7,28,5,7,fill);r(28,28,5,7,fill);r(17,14,6,2,cream);}
  }
  save(`creatures/${id.startsWith('mon')?'monsters':id.startsWith('evo')?'evolutions':'cute'}/${id}`,c);
}
for(const id of ['water','fire','earth','wind','pure_cute']){const c=canvas(16,16),{rect:r,oval:o,pixel:p}=c;
 if(id==='water'){for(let y=2;y<12;y++)r(8-Math.floor(y/3),y,Math.floor(y/3)*2+1,1,blue);o(8,11,5,4,blue);p(6,10,cream);}
 if(id==='fire'){r(7,1,3,8,0xefb764);o(8,10,6,5,0xd87959);o(8,11,3,4,0xf4cb7d);}
 if(id==='earth'){for(let y=1;y<15;y++)r(8-Math.min(y,15-y),y,2*Math.min(y,15-y),1,brown);r(6,6,4,4,cream);}
 if(id==='wind'){r(2,4,10,2,blue);r(6,7,9,2,blue);r(1,10,11,2,blue);r(11,2,2,4,blue);}
 if(id==='pure_cute'){o(5,5,4,4,pink);o(11,5,4,4,pink);for(let y=6;y<14;y++)r(y-5,y,16-2*(y-5),1,pink);}
 save(`ui/attributes/${id}`,c);}
for(const key of ['asset-fallback','capture-ball','pixel-sparkle']){const c=canvas(16,16);if(key==='capture-ball'){c.oval(8,8,7,7,ink);c.oval(8,8,5,5,cream);c.rect(3,4,10,3,pink);c.rect(2,7,12,2,ink);c.rect(7,7,3,3,cream);}else if(key==='pixel-sparkle'){c.rect(7,1,2,14,cream);c.rect(1,7,14,2,cream);}else{c.oval(8,8,7,7,ink);c.rect(6,4,5,2,cream);c.rect(9,6,2,3,cream);c.rect(7,8,2,2,cream);c.rect(7,12,2,2,cream);}save(`ui/icons/${key}`,c);}
for(const key of ['forest-grass','special-grass','forest-ground','forest-tree']){const c=canvas(32,32),{rect:r,oval:o}=c;r(0,0,32,32,0x638564);if(key.includes('grass')){for(let y=4;y<32;y+=9)for(let x=3;x<32;x+=8){r(x,y,2,6,0x355c49);r(x+2,y+2,2,3,0x9bb283);}if(key==='special-grass'){r(7,6,2,2,cream);r(23,21,2,2,pink);}}else if(key==='forest-tree'){r(12,18,8,14,0x6b6451);o(16,14,14,13,ink);o(16,12,12,10,0x47735b);r(9,6,10,2,0x719271);}else{r(4,6,4,1,0x789c71);r(23,24,3,2,0x53775d);}save(`world/tiles/${key}`,c);}
for(const key of ['campfire','crate','cabin','stall']){const c=canvas(key==='cabin'?64:32,key==='cabin'?64:32),{rect:r,oval:o}=c;if(key==='campfire'){r(4,26,24,3,brown);r(7,28,18,3,ink);o(16,20,8,9,0xd67d54);r(13,6,6,20,0xf2cb78);r(16,3,3,19,0xd67d54);}else if(key==='crate'){r(2,10,28,20,ink);r(4,12,24,16,brown);r(6,13,3,14,0xe2be82);r(24,13,3,14,0xe2be82);r(6,20,21,3,0x886943);}else if(key==='cabin'){r(7,28,50,33,ink);r(10,29,44,29,brown);for(let y=2;y<30;y++)r(32-y,y,y*2,1,0x805e47);r(26,38,12,23,ink);r(13,36,8,8,0x9fc4b4);r(43,36,8,8,0x9fc4b4);}else{r(3,8,26,6,pink);r(4,15,3,15,brown);r(26,15,3,15,brown);r(3,24,26,5,brown);r(8,21,5,4,cream);r(16,21,5,4,0x8aac7e);}save(`world/objects/${key}`,c);}
for(const key of ['battle-background','title-background']){const c=canvas(320,180),{rect:r,oval:o}=c;r(0,0,320,180,0x9bbfb1);r(0,0,320,65,0xb7d3bf);o(266,30,12,12,0xf0d4a0);for(let i=0;i<8;i++){o(i*50,100,50,40,0x698e76);o(i*49+12,133,40,31,0x50735f);}r(0,136,320,44,0x83a37a);r(0,171,320,9,0x749365);for(let x=8;x<320;x+=23)r(x,155,3,2,0xb7c89c);save(`battle/backgrounds/${key}`,c);}
const player=canvas(84,112);
for(const[d,dir]of['down','up','left','right'].entries())for(let f=0;f<3;f++){
 const r=(x,y,w,h,c)=>player.rect(f*28+x,d*28+y,w,h,c);
 r(5,23,17,2,ink);r(8,23-(f===1?1:0),4,3,0x775c45);r(16,23-(f===2?1:0),4,3,0x775c45);r(5,16,3,5,0xe9bb91);r(21,16,3,5,0xe9bb91);r(8,15,13,9,0xc9855c);r(6,4,17,11,0xf2d2ac);r(9,2,11,3,0xf2d2ac);r(8,1,10,2,0x806349);r(7,3,4,2,0x806349);
 if(dir==='up'){r(6,4,17,7,0x806349);r(10,16,9,7,0x8f9569);r(11,17,7,2,0xc4c18a);}else{if(dir!=='right')r(10,8,2,2,ink);if(dir!=='left')r(18,8,2,2,ink);r(13,12,4,1,0xd49879);if(dir==='left')r(19,15,3,8,0x8f9569);if(dir==='right')r(6,15,3,8,0x8f9569);}
}save('characters/player/player-overworld',player);
for(const folder of ['battle/effects','ui/frames','audio/sfx','audio/music']){mkdirSync(`public/assets/${folder}`,{recursive:true});writeFileSync(`public/assets/${folder}/.gitkeep`,'');}
console.log('Generated original pixel PNG assets.');
