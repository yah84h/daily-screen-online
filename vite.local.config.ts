import {mergeConfig} from 'vite';
import base from './vite.config';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export default mergeConfig(base,{plugins:[{name:'local-demo-backend',enforce:'pre',async load(id:string){if(id===fileURLToPath(new URL('./src/lib/supabase.ts',import.meta.url)))return readFile(new URL('./local-test/adapter.ts',import.meta.url),'utf8');}}],server:{host:'0.0.0.0',proxy:{'/api':'http://127.0.0.1:8081','/local':'http://127.0.0.1:8081','/storage':'http://127.0.0.1:8081'}}});
