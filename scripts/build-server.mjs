import {createRequire} from 'node:module';
import {mkdir,cp,writeFile,rm} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite')]}));
await mkdir('release',{recursive:true});
await build({entryPoints:['server/index.ts'],outfile:'release/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['ws']});
await rm('release/dist',{recursive:true,force:true});
await cp('dist','release/dist',{recursive:true});
await writeFile('release/package.json',JSON.stringify({name:'island100-server',private:true,type:'module',dependencies:{ws:'8.22.0'}},null,2));
