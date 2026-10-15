import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT || 3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.pdf':'application/pdf','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/health') {res.writeHead(200,{'Content-Type':'application/json'});res.end('{"status":"ok"}');return;}
    const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
    const relative=path.relative(root,file);
    const allowed=relative==='index.html' || relative==='styles.css' || /^(src|docs)[/\\]/.test(relative);
    if(!allowed || relative.startsWith('..') || (await stat(file)).isDirectory()) {res.writeHead(404);res.end('Nem található.');return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Nem található.');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Átemelő méretező elindult, port: ${port}`));
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>process.exit(0)));
