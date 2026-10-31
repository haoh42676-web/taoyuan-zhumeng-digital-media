import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
import {createDemoApp} from '../server/demo.js';
let application;
export async function getApplication(){
 if(!application)application=(async()=>{
  const appUrl=process.env.APP_URL||('https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const secret=process.env.SESSION_SECRET;
  if(!secret||secret.length<32||!/^https:\/\//.test(appUrl))throw new Error('Invalid independent deployment configuration');
  const db=await openDatabase();
  try{
   const demoApp=await createDemoApp(db,{production:true,secret,appUrl,initialize:false});
   const app=createApp(db,{production:true,secret,appUrl,demoApp,initialize:false});
   await app.locals.ready;
   return app;
  }catch(error){await db.close();throw error;}
 })().catch(error=>{application=null;throw error;});
 return application;
}
export default async function handler(req,res){
 try{const app=await getApplication();return app(req,res);}
 catch(error){console.error(JSON.stringify({error:error.code||error.name,message:'independent initialization failed'}));res.statusCode=503;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{message:'服务初始化失败，请稍后重试'}}));}
}
