import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=spawn(process.execPath,['local-test/server.mjs','--localhost'],{cwd:root,env:{...process.env,PORT:'8081'},stdio:'inherit'});
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','vite.local.config.ts'],{cwd:root,stdio:'inherit'});
let stopped=false;const stop=()=>{if(stopped)return;stopped=true;backend.kill();frontend.kill();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);backend.on('exit',stop);frontend.on('exit',stop);
