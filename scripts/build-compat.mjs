import {readFile,writeFile,mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformAsync} from '@babel/core';
import presetEnv from '@babel/preset-env';
import {build} from 'esbuild';
import postcss from 'postcss';
import preset from 'postcss-preset-env';
import {parse} from 'acorn';
import sharp from 'sharp';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'assets/compat');await mkdir(target,{recursive:true});
const imageProfile='palette256-1600-v1';
const previous=await readFile(path.join(target,'build.json'),'utf8').then(JSON.parse).catch(()=>({}));
const pages={
 season:{html:'index.html',css:['season.css','browser-adapt.css']},
 market:{html:'market.html',css:['ui-system.css','digital.css','season-market.css','browser-adapt.css']},
 admin:{html:'admin/index.html',css:['admin/admin.css','admin/digital.css','admin/ai.css','admin/materials.css','ui-system.css','ip-experience.css','admin/season.css','browser-adapt.css']}
};
const sources=new Set();
for(const config of Object.values(pages)){
 const html=await readFile(path.join(root,config.html),'utf8');
 for(const match of html.matchAll(/data-peach-src="([^"]+)"/g))sources.add(match[1].replace(/^\//,''));
}
// The old cloud URLs contain small redirect scripts and use the same compatibility bootstrap.
sources.add('cloud/redirect.js');sources.add('cloud/admin-redirect.js');sources.add('browser-adapt.js');
for(const file of sources){
 let source=await readFile(path.join(root,file),'utf8');
 if(source.includes('import(')){
  const bundle=await build({entryPoints:[path.join(root,file)],bundle:true,write:false,format:'iife',target:'es2015',legalComments:'none'});
  source=bundle.outputFiles[0].text;
 }
 const result=await transformAsync(source,{filename:file,presets:[[presetEnv,{targets:{ie:'11'},modules:false,useBuiltIns:false}]],comments:false,compact:true,sourceMaps:false});
 parse(result.code,{ecmaVersion:5});
 const dest=path.join(target,'js',file);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,result.code+'\n');
}
const bundled=await build({entryPoints:[path.join(root,'scripts/compat/polyfills.js')],bundle:true,write:false,format:'iife',target:'es2015',legalComments:'eof',minify:false});
const polyfilled=await transformAsync(bundled.outputFiles[0].text,{presets:[[presetEnv,{targets:{ie:'11'},modules:false,useBuiltIns:false}]],comments:false,compact:true});
parse(polyfilled.code,{ecmaVersion:5});await writeFile(path.join(target,'polyfills.js'),polyfilled.code+'\n');
const boot=await readFile(path.join(root,'scripts/compat/boot.js'),'utf8');parse(boot,{ecmaVersion:5});await writeFile(path.join(target,'boot.js'),boot);
const legacy=await readFile(path.join(root,'scripts/compat/legacy.css'),'utf8');
for(const [name,config]of Object.entries(pages)){
 let all='';
 for(const file of config.css){
  let css=await readFile(path.join(root,file),'utf8');
  css=css.replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(full,quote,url)=>{
   if(/^(data:|https?:|#)/.test(url))return full;
   const asset=path.posix.normalize(path.posix.join(path.posix.dirname(file),url.replace(/^\//,'')));
   const output=asset.endsWith('.webp')?'images/'+asset.replace(/\.webp$/,'.png'):'../../'+asset;
   return 'url("'+output+'")';
  });
  all+=css+'\n';
 }
 const result=await postcss([preset({stage:3,browsers:['ie 11'],preserve:false,autoprefixer:{grid:false},features:{'custom-properties':{preserve:false},'nesting-rules':true,'hexadecimal-alpha-notation':true,'color-functional-notation':true,'color-mix':true}})]).process(all+'\n'+legacy,{from:undefined});
 await writeFile(path.join(target,name+'.css'),result.css);
}
async function images(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  if(item.name==='compat')continue;
  const full=path.join(dir,item.name);
  if(item.isDirectory())await images(full);
  else if(item.name.endsWith('.webp')){
   const relative=path.relative(root,full),dest=path.join(target,'images',relative.replace(/\.webp$/,'.png'));
   if(previous.imageProfile===imageProfile&&await stat(dest).then(async info=>info.mtimeMs>=(await stat(full)).mtimeMs).catch(()=>false))continue;
   await mkdir(path.dirname(dest),{recursive:true});await sharp(full).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png({palette:true,quality:85,colours:256,effort:7,compressionLevel:9}).toFile(dest);
  }
 }
}
await images(path.join(root,'assets'));
const libraries=['core-js','whatwg-fetch','abortcontroller-polyfill','url-polyfill','dialog-polyfill','@babel/core'];
const notices=[];
for(const lib of libraries){
 const pkg=JSON.parse(await readFile(path.join(root,'node_modules',lib,'package.json'),'utf8'));
 let license='';for(const name of ['LICENSE','LICENSE.txt','LICENSE.md'])try{license=await readFile(path.join(root,'node_modules',lib,name),'utf8');break;}catch{}
 notices.push(lib+' '+pkg.version+'\n'+license);
}
await writeFile(path.join(target,'THIRD-PARTY-LICENSES.txt'),notices.join('\n\n----------------\n\n'));
await copyFile(path.join(root,'node_modules/dialog-polyfill/dist/dialog-polyfill.css'),path.join(target,'dialog.css'));
const inputs=[...new Set([...sources,...Object.values(pages).flatMap(x=>[x.html,...x.css]),'scripts/compat/boot.js','scripts/compat/events.js','scripts/compat/polyfills.js','scripts/compat/legacy.css','scripts/build-compat.mjs','package-lock.json','project-knowledge.js','ai-core.js'])];
const hashes={};for(const file of inputs)hashes[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
await writeFile(path.join(target,'build.json'),JSON.stringify({format:'ES5',target:'IE11',imageProfile,scripts:[...sources],pages:Object.keys(pages),libraries,inputs:hashes},null,2)+'\n');
console.log('Compatibility build: '+sources.size+' ES5 scripts, local polyfills, three stylesheets and PNG assets.');
