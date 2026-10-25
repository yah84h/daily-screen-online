import {build,mergeConfig,loadConfigFromFile} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist-local');
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
for(const name of await fs.readdir(path.join(root,'local-test'))){
 if(name==='adapter.ts'||name.startsWith('.'))continue;
 if(!(await fs.stat(path.join(root,'local-test',name))).isFile())continue;
 await fs.copyFile(path.join(root,'local-test',name),path.join(out,name));
 if(name.endsWith('.command')) await fs.chmod(path.join(out,name),0o755);
}
const {config}=await loadConfigFromFile({command:'build',mode:'production'},path.join(root,'vite.config.ts'));
await build(mergeConfig(config,{configFile:false,root,plugins:[{name:'local-only-backend',enforce:'pre',async load(id){if(id===path.join(root,'src/lib/supabase.ts'))return fs.readFile(path.join(root,'local-test/adapter.ts'),'utf8')}}],build:{outDir:path.join(out,'web'),emptyOutDir:true}}));
console.log('Local package ready: dist-local. Run node dist-local/server.mjs');
