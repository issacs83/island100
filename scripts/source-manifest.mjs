import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'.');
const ignored=new Set(['node_modules','dist','release','data','.git','SOURCE-MANIFEST.sha256']);
async function walk(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(ignored.has(entry.name))continue;const name=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(name));else if(entry.isFile())files.push(name);else throw new Error(`Unsupported source entry: ${name}`);}return files;}
const files=(await walk(root)).sort();let bytes=0;const lines=[];
for(const file of files){const data=await readFile(file);bytes+=data.length;lines.push(`${createHash('sha256').update(data).digest('hex')}  ${path.relative(root,file).split(path.sep).join('/')}`);}
await writeFile(path.join(root,'SOURCE-MANIFEST.sha256'),lines.join('\n')+'\n');
console.log(JSON.stringify({files:files.length,bytes,manifest:'SOURCE-MANIFEST.sha256'}));
