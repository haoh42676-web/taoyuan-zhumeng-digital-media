import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { openDatabase,migrate } from './db.js';
import { seed } from './content.js';
import { bootstrapAdmin,enforceSingleAdmin,token } from './auth.js';
import { createApp,purgeExpired } from './app.js';
import {createDemoApp} from './demo.js';
import {seedDemoScenarios} from './demo-scenarios.js';
const production=process.env.NODE_ENV==='production',port=Number(process.env.PORT||8787),appUrl=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
let secret=process.env.SESSION_SECRET;
if(production){if(!secret||secret.length<32)throw new Error('生产环境SESSION_SECRET须至少32位');if(!/^https:\/\//.test(appUrl))throw new Error('生产环境APP_URL须为实际HTTPS站点地址');}
else if(!secret){await mkdir('.data',{recursive:true});try{secret=await readFile('.data/session-secret','utf8');}catch{secret=token();await writeFile('.data/session-secret',secret,{mode:0o600});}}
const db=await openDatabase();await migrate(db);await seed(db);await enforceSingleAdmin(db);await bootstrapAdmin(db,{production});await purgeExpired(db);
const demoApp=await createDemoApp(db,{production,secret,appUrl});
const app=createApp(db,{production,secret,appUrl,demoApp});await app.locals.ready;const server=app.listen(port,'0.0.0.0',()=>console.log(`数商桃乡已启动：${appUrl}\n运营后台：${appUrl}/admin/\n数据库：${db.kind}\n${production?'':'首次本地登录信息：.data/first-login.txt（仅首次创建时生成）'}`));
let purgeRunning=false;const timer=setInterval(async()=>{if(purgeRunning)return;purgeRunning=true;try{await purgeExpired(db);await purgeExpired(demoApp.locals.demoDatabase);await seedDemoScenarios(demoApp.locals.demoDatabase);}catch(e){console.error('日志保留任务失败：'+(e.code||e.name));}finally{purgeRunning=false;}},3600000);timer.unref();
let closing=false;async function close(){if(closing)return;closing=true;clearInterval(timer);server.close(async()=>{await demoApp.locals.demoDatabase.close();await db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}process.on('SIGTERM',close);process.on('SIGINT',close);
