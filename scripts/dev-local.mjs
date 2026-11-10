import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const name of ['.env','.env.local'])if(fs.existsSync(path.join(root,name)))process.loadEnvFile(path.join(root,name));
// Check both ports before starting either process; never attach to an unrelated backend.
for(const port of [8081,5173])await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error(`Port ${port} is busy. Stop the other development session, then retry.`)));probe.listen(port,'0.0.0.0',()=>probe.close(resolve));});
console.log('Starting fast local development. Admin: http://localhost:5173/admin | Display: http://localhost:5173/display');
const backend=spawn(process.execPath,['--watch','local-test/server.mjs','--localhost'],{cwd:root,env:{...process.env,PORT:'8081'},stdio:'inherit'});
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','vite.local.config.ts'],{cwd:root,stdio:'inherit'});
let stopped=false;
const stop=(code=0)=>{if(stopped)return;stopped=true;process.exitCode=code;backend.kill();frontend.kill();};
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
for(const child of [backend,frontend]){child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>stop(code??1));}
