import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parse} from 'acorn';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
test('IE compatibility scripts parse as ES5 and match the current entry sources',async()=>{
 const manifest=JSON.parse(await readFile(resolve(root,'assets/compat/build.json'),'utf8'));
 assert.equal(manifest.target,'IE11');
 for(const file of ['boot.js','polyfills.js',...manifest.scripts.map(s=>'js/'+s)]){
  const source=await readFile(resolve(root,'assets/compat',file),'utf8');
  assert.doesNotThrow(()=>parse(source,{ecmaVersion:5}),file);
 }
 for(const [file,hash]of Object.entries(manifest.inputs))assert.equal(createHash('sha256').update(await readFile(resolve(root,file))).digest('hex'),hash,file);
});
test('every bundled WebP has a nonempty PNG counterpart for legacy image and canvas rendering',async()=>{
 async function walk(folder){for(const item of await readdir(resolve(root,folder),{withFileTypes:true})){
  if(item.name==='compat')continue;const file=folder+'/'+item.name;
  if(item.isDirectory())await walk(file);
  else if(file.endsWith('.webp')){
   const png=resolve(root,'assets/compat/images',file.replace(/\.webp$/,'.png'));
   assert.ok((await stat(png)).size>0,file);const header=(await readFile(png)).subarray(0,8);assert.equal(header.toString('hex'),'89504e470d0a1a0a',file);
  }
 }}await walk('assets');
});
