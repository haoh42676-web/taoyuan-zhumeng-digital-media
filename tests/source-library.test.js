import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../server/db.js';
import {seed} from '../server/content.js';
import {createApp} from '../server/app.js';
import {passwordHash} from '../server/auth.js';
import {validateContent} from '../server/modules.js';
test('source archive and imported images remain private while editable, versioned, and backed up',async()=>{
 const db=await openDatabase({url:'',dataDir:'memory://'});let server;
 try{await migrate(db);await seed(db);await db.query('INSERT INTO users(id,email,name,role,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,false)',['test-admin','source@test.local','测试管理员','admin',await passwordHash('SourceTest2026!')]);
 server=createApp(db,{secret:'source-test-'.repeat(5),disableLimits:true}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let cookie='',csrf='';
 async function req(path,method='GET',body,auth=true){const r=await fetch(base+path,{method,headers:{'X-Peach-Request':'1','Content-Type':'application/json',Cookie:auth?cookie:'','X-CSRF-Token':auth?csrf:''},body:body?JSON.stringify(body):undefined});if(auth){const c=r.headers.getSetCookie();if(c.length)cookie=c.map(x=>x.split(';')[0]).join('; ');}const j=r.headers.get('content-type')?.includes('json')?await r.json():null;if(j?.data?.csrf)csrf=j.data.csrf;return{status:r.status,data:j?.data};}
 assert.equal((await req('/api/admin/content?module=source_library','GET',null,false)).status,401);assert.equal((await req('/api/auth/login','POST',{email:'source@test.local',password:'SourceTest2026!'})).status,200);
 const data=validateContent('source_library',{title:'脱敏项目档案',category:'proposal',evidenceStatus:'plan',sourceRef:'本地来源测试',fileHash:'a'.repeat(64),part:'1/1',body:'项目方案只是待验证设想。',reviewNote:'仅后台保存'});let item=(await req('/api/admin/content','POST',{module:'source_library',slug:'source-test',data})).data;assert.ok(item.id);
 item=(await req('/api/admin/content/'+item.id+'/publish','POST',{version:item.version})).data;assert.equal(item.status,'published');let boot=await req('/api/bootstrap','GET',null,false);assert.equal(boot.data.content.source_library,undefined);assert.equal((await req('/api/bootstrap?preview='+item.id)).status,403);
 assert.equal((await req('/api/admin/content/'+item.id,'PATCH',{version:item.version,data:{...data,body:'管理员修订后的档案'}})).status,200);assert.equal((await req('/api/admin/content/'+item.id+'/history')).data.length,2);
 const id='IMG-'+ 'a'.repeat(24);await db.query("INSERT INTO media(id,name,mime,size,visibility,bytes,alt,source_ref) VALUES($1,'reference.webp','image/webp',3,'private',$2,'资料图','资料来源')",[id,Buffer.from([1,2,3])]);assert.equal((await req('/api/admin/source-media')).data.length,1);assert.equal((await req('/api/admin/source-media/'+id+'.webp')).status,200);assert.equal((await req('/api/admin/source-media/'+id+'.webp','GET',null,false)).status,401);assert.equal((await req('/media/'+id+'.webp','GET',null,false)).status,404);assert.equal((await req('/api/admin/media')).data.some(x=>x.id===id),false);
 const{createBackup}=await import('../server/backup.js');const{gunzipSync}=await import('node:zlib');const backup=JSON.parse(gunzipSync(await createBackup(db)));assert.ok(backup.tables.content_items.some(x=>x.module==='source_library'));assert.ok(backup.tables.media.some(x=>x.id===id));
 }finally{if(server)await new Promise(r=>server.close(r));await db.close();}
});
