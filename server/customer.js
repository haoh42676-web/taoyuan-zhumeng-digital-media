import {Router} from 'express';
import {z} from 'zod';
import {one} from './db.js';
import {createHmac} from 'node:crypto';
import {token,hash,uid,passwordHash,passwordMatches,setCookie,cookieMap} from './auth.js';
import {fail} from './modules.js';
const schemaPromises=new WeakMap();
export function ensureCustomerSchema(db){if(!schemaPromises.has(db))schemaPromises.set(db,createCustomerSchema(db).catch(e=>{schemaPromises.delete(db);throw e;}));return schemaPromises.get(db); }
async function createCustomerSchema(db){
 await db.query('CREATE TABLE IF NOT EXISTS customer_accounts(id text PRIMARY KEY,account text NOT NULL UNIQUE,password_hash text NOT NULL,display_name text NOT NULL,demo boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now())');
 await db.query('CREATE TABLE IF NOT EXISTS customer_sessions(token_hash text PRIMARY KEY,account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,csrf text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');
 await db.query('CREATE TABLE IF NOT EXISTS ai_usage(bucket text PRIMARY KEY,used integer NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL)');
 await db.query('CREATE TABLE IF NOT EXISTS ai_leases(account_id text PRIMARY KEY,token text NOT NULL,expires_at timestamptz NOT NULL)');
 await db.query('CREATE TABLE IF NOT EXISTS customer_chats(id text PRIMARY KEY,account_id text NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,question text NOT NULL,answer text NOT NULL,provider text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');
 const existing=await one(db,"SELECT id FROM customer_accounts WHERE account='test1'");if(!existing)await db.query("INSERT INTO customer_accounts(id,account,password_hash,display_name,demo) VALUES($1,'test1',$2,'测试体验账号',true) ON CONFLICT(account) DO NOTHING",[uid('CUS'),await passwordHash('123456')]);
}
export function customerPublic(c){return{id:c.id,account:c.account,name:c.display_name,demo:c.demo};}
export function customerMiddleware(db){return async(req,res,next)=>{try{const value=cookieMap(req)[req.demoMode?'peach_demo_customer':'peach_customer'];if(value){const row=await one(db,'SELECT c.*,s.csrf FROM customer_sessions s JOIN customer_accounts c ON c.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(value)]);if(row)req.customer=row;}next();}catch(e){next(e);}};}
export function requireCustomer(req,res,next){try{if(!req.customer)fail(401,'请先登录再与小桃满对话');if(!['GET','HEAD'].includes(req.method)&&req.headers['x-customer-csrf']!==req.customer.csrf)fail(403,'客服操作凭据已失效，请重新登录');next();}catch(e){next(e);}}
export function customerRouter(db,send,{production,limiter}){
 const r=Router();
 r.get('/session',(req,res)=>send(res,{user:req.customer?customerPublic(req.customer):null,csrf:req.customer?.csrf||'',limits:{perMinute:5,perDay:req.customer?.demo?10:40},demoAdminPath:'/demo/admin/'}));
 const credentials=z.object({account:z.string().trim().regex(/^[a-zA-Z0-9_]{3,40}$/),password:z.string().min(6).max(128)}).strict();
 r.post('/register',limiter(4,3600000),async(req,res)=>{const p=credentials.parse(req.body);if(p.password.length<10)fail(422,'新注册账号密码请至少10位');const user=await one(db,'INSERT INTO customer_accounts(id,account,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING *',[uid('CUS'),p.account.toLowerCase(),await passwordHash(p.password),p.account]);await login(user,req,res);});
 async function login(user,req,res){const value=token(),csrf=token();await db.query("INSERT INTO customer_sessions(token_hash,account_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '4 hours')",[hash(value),user.id,csrf]);setCookie(res,req.demoMode?'peach_demo_customer':'peach_customer',value,{production,maxAge:4*3600000});send(res,{user:customerPublic(user),csrf});}
 r.post('/login',limiter(8,900000),async(req,res)=>{const p=credentials.parse(req.body),user=await one(db,'SELECT * FROM customer_accounts WHERE account=$1',[p.account.toLowerCase()]);const matched=await passwordMatches(p.password,user?.password_hash||'0'.repeat(32)+':'+'0'.repeat(128));if(!user||!matched)fail(401,'账号或密码不正确');await login(user,req,res);});
 r.post('/logout',requireCustomer,async(req,res)=>{await db.query('DELETE FROM customer_sessions WHERE token_hash=$1',[hash(cookieMap(req)[req.demoMode?'peach_demo_customer':'peach_customer']||'')]);setCookie(res,req.demoMode?'peach_demo_customer':'peach_customer','',{production,maxAge:0});send(res,{loggedOut:true});});
 r.get('/chats',requireCustomer,async(req,res)=>send(res,req.customer.demo?[]:(await db.query('SELECT question,answer,provider,created_at FROM customer_chats WHERE account_id=$1 ORDER BY created_at DESC LIMIT 20',[req.customer.id])).rows.reverse()));
 r.delete('/chats',requireCustomer,async(req,res)=>{await db.query('DELETE FROM customer_chats WHERE account_id=$1',[req.customer.id]);send(res,{deleted:true});});return r;
}
// Persistent atomic quotas survive process restarts; account + IP + site total.
export async function reserveChat(db,req){
 const minute=Math.floor(Date.now()/60000),day=new Date().toISOString().slice(0,10),a=req.customer.id;
 const ip=createHmac('sha256',process.env.SESSION_SECRET||'local-development').update(req.ip||'unknown').digest('hex'),lease=token();
 const limits=[[a+':m:'+minute,5],[a+':d:'+day,req.customer.demo?10:40],['ip:'+ip+':'+day,100],['site:'+day,Math.max(1,Math.min(1000,Number(process.env.AI_SITE_DAILY_LIMIT)||300))]];
 await db.transaction(async tx=>{const active=await one(tx,"INSERT INTO ai_leases(account_id,token,expires_at) VALUES($1,$2,now()+interval '45 seconds') ON CONFLICT(account_id) DO UPDATE SET token=EXCLUDED.token,expires_at=EXCLUDED.expires_at WHERE ai_leases.expires_at<now() RETURNING token",[a,lease]);if(!active)fail(429,'上一条回答尚未完成，请稍候');for(const [bucket,limit] of limits){const row=await one(tx,"INSERT INTO ai_usage(bucket,used,expires_at) VALUES($1,1,now()+interval '2 days') ON CONFLICT(bucket) DO UPDATE SET used=ai_usage.used+1 WHERE ai_usage.used<$2 RETURNING used",[bucket,limit]);if(!row)fail(429,'今日或当前时段对话额度已用完，请稍后再试；商品咨询和售后表单仍可使用');}});
 return async({refund=false}={})=>db.transaction(async tx=>{await tx.query('DELETE FROM ai_leases WHERE account_id=$1 AND token=$2',[a,lease]);if(refund)await tx.query('UPDATE ai_usage SET used=greatest(0,used-1) WHERE bucket=$1',['site:'+day]);});
}
