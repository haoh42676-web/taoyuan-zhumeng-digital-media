import { Router } from 'express';
import { z } from 'zod';
import { one } from './db.js';
import { audit,requireRole } from './auth.js';
import { settings } from './content.js';
import { ROUTES,fail } from './modules.js';
import { pageParams } from './records.js';
export const csvCell=value=>'"'+String(value??'').replace(/^[=+\-@\t\r]/,'\'$&').replaceAll('"','""')+'"';
export function sendCSV(res,name,headers,rows){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${name}.csv"`);res.send('\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'));}
export function range(query){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),start=query.start||new Date(Date.parse(today+'T00:00:00Z')-6*86400000).toISOString().slice(0,10),end=query.end||today;
  for(const v of[start,end])if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail(422,'请选择有效日期范围');
  if(start>end||Date.parse(end)-Date.parse(start)>730*86400000)fail(422,'日期范围须为0—730天');
  return{start,end,args:[start+'T00:00:00+08:00',new Date(Date.parse(end+'T00:00:00+08:00')+86400000).toISOString()]};
}
const eventSchema=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),sessionId:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/),event:z.enum(['pageview','engagement','click']),route:z.enum(ROUTES),target:z.string().max(100).default(''),referrer:z.string().max(500).default(''),duration:z.number().int().min(0).max(30).default(0)});
const deviceInfo=ua=>({device:/iPad|Tablet/i.test(ua)?'平板':/Mobile|Android|iPhone/i.test(ua)?'手机':'电脑',browser:/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'其他',os:/Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Mac OS/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'其他'});
export async function collect(db,req){
  const config=await settings(db);if(!config?.analyticsEnabled||req.headers.dnt==='1'||req.body?.optOut===true||/bot|crawler|spider|headless|preview/i.test(req.headers['user-agent']||''))return{accepted:0};
  const events=z.array(eventSchema).min(1).max(30).parse(req.body.events),device=deviceInfo(req.headers['user-agent']||'');let accepted=0;
  await db.transaction(async tx=>{for(const e of events){let referrer='直接访问';try{if(e.referrer){const u=new URL(e.referrer);if(['http:','https:'].includes(u.protocol))referrer=u.hostname;}}catch{}const r=await tx.query(`INSERT INTO analytics_events(id,visitor_hash,session_id,event,route,target,referrer,device,browser,os,duration) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING RETURNING id`,[e.id,req.visitorHash,e.sessionId,e.event,e.route,e.target,referrer,device.device,device.browser,device.os,e.event==='engagement'?e.duration:0]);accepted+=r.rows.length;}});return{accepted};
}
export async function analyticsSummary(db,query){
  const r=range(query),where='created_at>=$1 AND created_at<$2';
  const total=await one(db,`SELECT count(*) FILTER(WHERE event='pageview') AS pv,count(DISTINCT visitor_hash) FILTER(WHERE event='pageview') AS uv,count(DISTINCT session_id) FILTER(WHERE event='pageview') AS sessions,count(*) FILTER(WHERE event='click') AS clicks,count(*) FILTER(WHERE event='conversion') AS conversions,coalesce(sum(duration),0) AS duration FROM analytics_events WHERE ${where}`,r.args);
  const daily=(await db.query(`SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date,count(*) FILTER(WHERE event='pageview') AS pv,count(DISTINCT visitor_hash) FILTER(WHERE event='pageview') AS uv,count(*) FILTER(WHERE event='conversion') AS conversions FROM analytics_events WHERE ${where} GROUP BY date ORDER BY date`,r.args)).rows;
  const pages=(await db.query(`SELECT route,count(*) FILTER(WHERE event='pageview') AS pv,count(DISTINCT visitor_hash) FILTER(WHERE event='pageview') AS uv,coalesce(sum(duration),0) AS duration FROM analytics_events WHERE ${where} GROUP BY route ORDER BY pv DESC`,r.args)).rows;
  const sources=(await db.query(`SELECT referrer,count(*) AS pv,count(DISTINCT visitor_hash) AS uv FROM analytics_events WHERE ${where} AND event='pageview' GROUP BY referrer ORDER BY pv DESC LIMIT 30`,r.args)).rows;
  const devices=(await db.query(`SELECT device,browser,os,count(*) AS pv FROM analytics_events WHERE ${where} AND event='pageview' GROUP BY device,browser,os ORDER BY pv DESC LIMIT 30`,r.args)).rows;
  const clicks=(await db.query(`SELECT route,target,count(*) AS n FROM analytics_events WHERE ${where} AND event='click' GROUP BY route,target ORDER BY n DESC LIMIT 40`,r.args)).rows;
  const conversions=(await db.query(`SELECT target,count(*) AS n FROM analytics_events WHERE ${where} AND event='conversion' GROUP BY target ORDER BY n DESC`,r.args)).rows;
  const requests=await one(db,`SELECT count(*) AS total,count(*) FILTER(WHERE status>=400) AS errors,coalesce(round(avg(duration)),0) AS average_ms FROM request_logs WHERE ${where}`,r.args);
  const first=await one(db,'SELECT min(created_at) AS first FROM analytics_events');
  const active=await one(db,`SELECT count(DISTINCT visitor_hash) AS n FROM analytics_events WHERE created_at>now()-interval '5 minutes'`);
  const bounced=await one(db,`SELECT count(*) FILTER(WHERE pv=1) AS bounces,count(*) AS total FROM(SELECT session_id,count(*) AS pv FROM analytics_events WHERE ${where} AND event='pageview' GROUP BY session_id) s`,r.args);
  return{range:{start:r.start,end:r.end,timeZone:'Asia/Shanghai'},total,daily,pages,sources,devices,clicks,conversions,requests,firstEventAt:first.first,activeVisitors:Number(active.n),bounceRate:Number(bounced.total)?Math.round(Number(bounced.bounces)/Number(bounced.total)*1000)/10:0,notes:'UV按匿名浏览器标识估算；跨设备、清除Cookie或拒绝统计会影响计数。活跃为近5分钟有记录的匿名访客。停留为页面可见期间心跳累计，不含后台页面。访问转化为服务端成功保存的意向，不是订单或付款。HTTP请求含后台/API/素材请求。'};
}
export function analyticsRouter(db,send){const r=Router();r.use(['/analytics','/requests'],requireRole('admin','operator','viewer'));
  r.get('/analytics/summary',async(req,res)=>send(res,await analyticsSummary(db,req.query)));
  r.get('/analytics/events',async(req,res)=>{const{args}=range(req.query),{page,limit}=pageParams(req.query);let where='created_at>=$1 AND created_at<$2';if(ROUTES.includes(req.query.route)){args.push(req.query.route);where+=' AND route=$3';}const total=Number((await one(db,'SELECT count(*) AS n FROM analytics_events WHERE '+where,args)).n);const rows=(await db.query(`SELECT id,left(visitor_hash,12) AS visitor,session_id,event,route,target,referrer,device,browser,os,duration,created_at FROM analytics_events WHERE ${where} ORDER BY created_at DESC LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,(page-1)*limit])).rows;send(res,{items:rows,total,page,limit});});
  r.get('/analytics/export',async(req,res)=>{const{args}=range(req.query),limit=50000;const rows=(await db.query(`SELECT event,route,target,left(visitor_hash,12) AS visitor,session_id,referrer,device,browser,os,duration,created_at FROM analytics_events WHERE created_at>=$1 AND created_at<$2 ORDER BY created_at LIMIT $3`,[...args,limit+1])).rows;if(rows.length>limit)fail(422,'该范围超过50000条，请缩小日期范围后分批导出');await audit(db,req.user,'analytics.export','',{rows:rows.length});sendCSV(res,'taoxiang-analytics',['时间（UTC）','事件','页面','目标','匿名访客','会话','来源域名','设备','浏览器','系统','可见停留秒数'],rows.map(x=>[new Date(x.created_at).toISOString(),x.event,x.route,x.target,x.visitor,x.session_id,x.referrer,x.device,x.browser,x.os,x.duration]));});
  r.get('/requests',async(req,res)=>{const{args}=range(req.query),{page,limit}=pageParams(req.query);const errorOnly=req.query.errors==='1'?' AND status>=400':'';const total=Number((await one(db,'SELECT count(*) AS n FROM request_logs WHERE created_at>=$1 AND created_at<$2'+errorOnly,args)).n);const rows=(await db.query('SELECT * FROM request_logs WHERE created_at>=$1 AND created_at<$2'+errorOnly+' ORDER BY created_at DESC LIMIT $3 OFFSET $4',[...args,limit,(page-1)*limit])).rows;send(res,{items:rows,total,page,limit});});
  return r;
}
