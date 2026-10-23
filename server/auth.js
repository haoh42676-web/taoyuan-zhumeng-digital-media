import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { one } from './db.js';
import { fail } from './modules.js';
const scrypt=promisify(rawScrypt);
export const token=()=>randomBytes(32).toString('base64url');
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const uid=prefix=>prefix+'-'+randomBytes(12).toString('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return salt+':'+Buffer.from(await scrypt(password,salt,64)).toString('hex');}
export async function passwordMatches(password,saved){const [salt,key]=saved.split(':');if(!salt||!key)return false;const derived=Buffer.from(await scrypt(password,salt,64)),stored=Buffer.from(key,'hex');return derived.length===stored.length&&timingSafeEqual(derived,stored);}
export function validatePassword(value,{account='',env=process.env}={}){if(env.SINGLE_ADMIN_ACCOUNT&&account===env.SINGLE_ADMIN_ACCOUNT){if(typeof value!=='string'||value.length<6||value.length>128)fail(422,'密码须为6—128位');return value;}if(typeof value!=='string'||value.length<12||value.length>128||!/[a-zA-Z]/.test(value)||!/[0-9]/.test(value))fail(422,'密码须为12—128位，且同时包含字母和数字');return value;}
export async function enforceSingleAdmin(db,{env=process.env}={}){
 const account=env.SINGLE_ADMIN_ACCOUNT;if(!account)return;const password=env.ADMIN_PASSWORD;
 if(!/^[a-zA-Z0-9@._+-]{3,150}$/.test(account))throw Error('唯一管理员账号格式不正确');validatePassword(password,{account,env});
 await db.transaction(async tx=>{
  if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362012)');
  const all=(await tx.query('SELECT * FROM users ORDER BY created_at FOR UPDATE')).rows;
  let primary=all.find(u=>u.email===account)||all.find(u=>u.role==='admin'&&u.active);
  const previous=await one(tx,"SELECT value FROM app_meta WHERE key='single_admin_config'");
  const configured=previous?.value?.account===account&&previous.value.passwordHash&&await passwordMatches(password,previous.value.passwordHash);
  if(!primary){primary=(await tx.query('INSERT INTO users(id,email,name,role,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,false) RETURNING *',[uid('USR'),account,env.ADMIN_NAME||'项目管理员','admin',await passwordHash(password)])).rows[0];}
  if(!configured||primary.email!==account){
   await tx.query('UPDATE users SET email=$2,password_hash=$3,must_change_password=false,active=true,role=$4,updated_at=now() WHERE id=$1',[primary.id,account,await passwordHash(password),'admin']);
   await tx.query('DELETE FROM sessions');
   await tx.query("INSERT INTO app_meta(key,value) VALUES('single_admin_config',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[JSON.stringify({account,passwordHash:await passwordHash(password)})]);
  }
  await tx.query('UPDATE users SET active=true,role=$2 WHERE id=$1',[primary.id,'admin']);
  await tx.query('UPDATE users SET active=false,updated_at=now() WHERE id!=$1 AND active=true',[primary.id]);
  await tx.query('DELETE FROM sessions WHERE user_id!=$1',[primary.id]);
 });
}
export const publicUser=u=>({id:u.id,email:u.email,account:u.email,name:u.name,role:u.role,active:u.active,mustChangePassword:u.must_change_password,singleAccount:!!process.env.SINGLE_ADMIN_ACCOUNT,passwordMinLength:process.env.SINGLE_ADMIN_ACCOUNT===u.email?6:12,createdAt:u.created_at});
export function cookieMap(req){const result={};for(const item of (req.headers.cookie||'').split(';')){const i=item.indexOf('=');if(i<0)continue;try{result[item.slice(0,i).trim()]=decodeURIComponent(item.slice(i+1));}catch{}}return result;}
export function setCookie(res,name,value,{production=false,maxAge=43200000}={}){res.append('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge/1000)}${production?'; Secure':''}`);}
export async function bootstrapAdmin(db,{production,env=process.env}){
  if(await one(db,`SELECT id FROM users WHERE role='admin' AND active=true LIMIT 1`))return;
  const email=(env.ADMIN_EMAIL||'admin@taoxiang.local').trim().toLowerCase();
  let password=env.ADMIN_PASSWORD;
  if(!password&&production)throw new Error('首次生产启动需要 ADMIN_EMAIL 和 ADMIN_PASSWORD（至少12位，包含字母和数字）');
  if(!password)password='Tx'+randomBytes(15).toString('base64url')+'9';
  validatePassword(password,{account:email,env});
  await db.query('INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',[uid('USR'),email,env.ADMIN_NAME||'项目管理员','admin',await passwordHash(password)]);
  if(!production&&!env.ADMIN_PASSWORD){await mkdir('.data',{recursive:true});await writeFile('.data/first-login.txt',`数商桃乡本地后台\n地址：http://localhost:${env.PORT||8787}/admin/\n账号：${email}\n临时密码：${password}\n首次登录后请立即更换。此文件只在本地，已从Git忽略。\n`,{mode:0o600});}
}
export async function audit(tx,user,action,entity='',detail={}){await tx.query('INSERT INTO audit_logs(actor_id,actor_name,action,entity,detail) VALUES($1,$2,$3,$4,$5)',[user?.id||null,user?.name||'访客',action,entity,JSON.stringify(detail)]);}
export function authMiddleware(db,{production=false,secret,sessionCookie='peach_session',allowAnyStaff=false}){return async(req,res,next)=>{try{
  const cookies=cookieMap(req);let visitor=cookies.peach_visitor;
  if(!visitor||!/^[a-zA-Z0-9_-]{43}$/.test(visitor)){visitor=token();setCookie(res,'peach_visitor',visitor,{production,maxAge:365*86400000});}
  req.visitorHash=hash(secret+':'+visitor);
  if(cookies[sessionCookie]){const session=await one(db,'SELECT s.csrf,s.expires_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true',[hash(cookies[sessionCookie])]);if(session&&(allowAnyStaff||!process.env.SINGLE_ADMIN_ACCOUNT||session.email===process.env.SINGLE_ADMIN_ACCOUNT)){req.user=session;req.csrf=session.csrf;}}
  next();
}catch(e){next(e);}};}
export function requireRole(...roles){return(req,res,next)=>{try{if(!req.user)fail(401,'请先登录运营后台');if(!roles.includes(req.user.role))fail(403,'当前账号没有执行此操作的权限');if(req.user.must_change_password&&!req.originalUrl.startsWith('/api/auth/'))fail(403,'首次登录请先修改临时密码');if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers['x-csrf-token']!==req.csrf)fail(403,'操作凭据已失效，请刷新后台后重试');next();}catch(e){next(e);}};}
