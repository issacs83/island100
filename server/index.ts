import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {emptyWorld,addPlayer,setInput,step,act,cleanName,type World} from '../src/shared.ts';
import {upgradeLife} from '../src/island-life.ts';

const PORT=Number(process.env.PORT||8787),HOST=process.env.HOST||'127.0.0.1';
const ROOT=path.resolve(process.env.STATIC_DIR||'dist'),DATA=path.resolve(process.env.DATA_DIR||'data');
type SavedRoom={world:World;keys:Record<string,string>;updated:number};
const rooms=new Map<string,SavedRoom>(), clients=new Map<WebSocket,{code:string;id:string}>();
await mkdir(DATA,{recursive:true,mode:0o700});
try{const saved=JSON.parse(await readFile(path.join(DATA,'rooms.json'),'utf8')) as SavedRoom[];for(const r of saved){if(r.world?.version!==2||Date.now()-r.updated>30*86400000)continue;r.world.resources={...emptyWorld().resources,...r.world.resources};if(r.world.life)upgradeLife(r.world.life);for(const p of Object.values(r.world.players)){p.online=false;p.ready=false;p.input={x:0,y:0,run:false};}rooms.set(r.world.code,r);}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')console.error('Could not restore rooms:',(e as Error).message);}
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size,players:clients.size}));return;}if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}let filename:string;try{filename=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end();return;}const file=path.resolve(ROOT,'.'+(filename==='/'?'/index.html':filename));if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}try{const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':filename.includes('/assets/')?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404);res.end('Not found');}});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048,perMessageDeflate:false});
function send(ws:WebSocket,data:unknown){if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<256000)ws.send(JSON.stringify(data));}
const attempts=new Map<string,{n:number;until:number}>();
wss.on('connection',(ws,req)=>{const ip=req.socket.remoteAddress||'';const a=attempts.get(ip);if(a&&a.until>Date.now()&&a.n>40){ws.close(1008,'Too many connections');return;}attempts.set(ip,{n:a&&a.until>Date.now()?a.n+1:1,until:Date.now()+60000});let count=0;const reset=setInterval(()=>count=0,1000);const timeout=setTimeout(()=>{if(!clients.has(ws))ws.close(1008,'Join timeout');},15000);let alive=true;ws.on('pong',()=>alive=true);const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},30000);
 ws.on('message',raw=>{if(++count>45){ws.close(1008,'Rate limit');return;}let m:any;try{m=JSON.parse(raw.toString());}catch{return;}if(!m||typeof m!=='object')return;
  if(m.type==='join'&&!clients.has(ws)){let code=typeof m.code==='string'?m.code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6):'';let room:SavedRoom|undefined;
   if(m.create===true){if(rooms.size>=64){send(ws,{type:'error',text:'테스트 섬이 가득 찼어요. 잠시 뒤 다시 시도해 주세요.'});return;}do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));room={world:emptyWorld(code),keys:{},updated:Date.now()};rooms.set(code,room);}else{room=rooms.get(code);if(!room){send(ws,{type:'error',text:'초대 코드를 다시 확인해 주세요.'});return;}}
   let id=typeof m.id==='string'?m.id:'';const resume=!!id&&typeof m.token==='string'&&room.keys[id]===m.token&&!!room.world.players[id];if(!resume){if(Object.values(room.world.players).filter(p=>p.online).length>=4){send(ws,{type:'error',text:'이 섬에는 동시에 4명까지 들어올 수 있어요.'});return;}if(Object.keys(room.world.players).length>=16){send(ws,{type:'error',text:'이 섬의 등록 인원이 가득 찼어요.'});return;}id=randomBytes(8).toString('hex');room.keys[id]=randomBytes(24).toString('hex');addPlayer(room.world,id,cleanName(m.name));}else{const old=[...clients.entries()].find(([,v])=>v.code===code&&v.id===id);if(old){clients.delete(old[0]);old[0].close(4001,'Replaced');}}
   const p=room.world.players[id];p.online=true;p.ready=false;p.input={x:0,y:0,run:false};clients.set(ws,{code,id});room.updated=Date.now();send(ws,{type:'joined',id,token:room.keys[id],world:room.world});return;}
  const c=clients.get(ws);if(!c)return;const r=rooms.get(c.code)!;const p=r.world.players[c.id];r.updated=Date.now();if(m.type==='input')setInput(p,m.input);else if(m.type==='ready'){p.ready=m.value===true;p.input={x:0,y:0,run:false};}else if(m.type==='action'&&typeof m.action==='string'){send(ws,{type:'notice',text:act(r.world,c.id,m.action,m.arg)});}});
 ws.on('error',()=>{});ws.on('close',()=>{clearInterval(reset);clearInterval(heartbeat);clearTimeout(timeout);const c=clients.get(ws);if(c){const p=rooms.get(c.code)?.world.players[c.id];if(p){p.online=false;p.ready=false;p.input={x:0,y:0,run:false};}clients.delete(ws);}});});
setInterval(()=>{for(const r of rooms.values())step(r.world,.05);for(const[ws,c]of clients)send(ws,{type:'state',world:rooms.get(c.code)!.world});},50);
let saving=false;async function save(){if(saving)return;saving=true;try{const values=[...rooms.values()].filter(r=>Date.now()-r.updated<30*86400000);await writeFile(path.join(DATA,'rooms.tmp'),JSON.stringify(values),{mode:0o600});await rename(path.join(DATA,'rooms.tmp'),path.join(DATA,'rooms.json'));}catch(e){console.error('Save failed:',(e as Error).message);}finally{saving=false;}}
setInterval(()=>void save(),10000);
setInterval(()=>{for(const [key,v]of attempts)if(v.until<Date.now())attempts.delete(key);for(const [code,r]of rooms)if(Date.now()-r.updated>30*86400000)rooms.delete(code);},60000);
async function shutdown(){await save();process.exit(0);}process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
server.listen(PORT,HOST,()=>console.log(`Island server: http://${HOST}:${PORT}`));
