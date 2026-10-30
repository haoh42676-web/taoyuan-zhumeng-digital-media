import {mkdir,copyFile,cp,readdir,rm,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const compat=JSON.parse(await readFile('assets/compat/build.json','utf8'));
for(const [file,hash]of Object.entries(compat.inputs)){
 if(createHash('sha256').update(await readFile(file)).digest('hex')!==hash)throw Error('Compatibility assets need rebuilding: npm run build:compat ('+file+')');
}
await rm('public',{recursive:true,force:true});await mkdir('public');
for(const file of await readdir('.'))if(/\.(html|css|js)$/.test(file)&&!['runtime-config.js','static-admin.html'].includes(file))await copyFile(file,'public/'+file);
for(const folder of ['admin','assets','cloud'])await cp(folder,'public/'+folder,{recursive:true});
