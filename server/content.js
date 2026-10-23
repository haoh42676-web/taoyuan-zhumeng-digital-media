import { readFile } from 'node:fs/promises';
import { Router } from 'express';
import { one } from './db.js';
import { uid, audit, requireRole } from './auth.js';
import { MODULES, ROUTES, fail, slugSchema, validateContent } from './modules.js';
import {AI_DEFAULTS} from '../ai-core.js';
export const contentRow=r=>r&&({id:r.id,module:r.module,slug:r.slug,title:r.title,data:r.draft,published:r.published,status:r.status,version:r.version,sortOrder:r.sort_order,updatedAt:r.updated_at,publishedAt:r.published_at,updatedBy:r.updated_by});
export async function seed(db){
  const baseRows=JSON.parse(await readFile(new URL('./seed-data.json',import.meta.url),'utf8'));const extras=JSON.parse(await readFile(new URL('./cms-defaults.json',import.meta.url),'utf8'));const rows=baseRows;
  await db.transaction(async tx=>{
    if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362010)');
    if(!await one(tx,"SELECT key FROM app_meta WHERE key='project_chat_scope_v1'")){
      for(const [field,oldValue]of Object.entries({welcomeMessage:'我是小桃满，帮你问清规格、发货安排和收货问题。',fallbackMessage:'这条问题还没有足够的已发布依据，请通过商品咨询交给运营核实。'})){
        await tx.query("UPDATE content_items SET draft=CASE WHEN draft->>$1=$2 THEN jsonb_set(draft,ARRAY[$1]::text[],to_jsonb($3::text)) ELSE draft END,published=CASE WHEN published->>$1=$2 THEN jsonb_set(published,ARRAY[$1]::text[],to_jsonb($3::text)) ELSE published END WHERE module='ai_settings'",[field,oldValue,AI_DEFAULTS[field]]);
      }
      await tx.query("INSERT INTO app_meta(key,value) VALUES('project_chat_scope_v1','true')");
    }
    if(new Set(rows.map(r=>r.module+'--'+r.slug)).size!==rows.length)throw Error('初始资料存在重复编号');
    // Bound each network payload while keeping validation, insertion order and conflict protection.
    async function insertRows(source,titleOf){
      for(let start=0;start<source.length;start+=150){
        const batch=source.slice(start,start+150).map(r=>{const data=validateContent(r.module,r.data);return{id:r.module+'--'+r.slug,module:r.module,slug:r.slug,title:titleOf(data,r),data,sort_order:r.sort_order};});
        await tx.query("INSERT INTO content_items(id,module,slug,title,draft,published,status,sort_order,published_at) SELECT item.id,item.module,item.slug,item.title,item.data,item.data,'published',item.sort_order,now() FROM jsonb_to_recordset($1::jsonb) AS item(id text,module text,slug text,title text,data jsonb,sort_order integer) ON CONFLICT(module,slug) DO NOTHING",[JSON.stringify(batch)]);
      }
    }
    const defaults=baseRows.find(r=>r.module==='settings').data;const patch=Object.fromEntries(["brandSubtitle","heroEyebrow","heroCaption","dashboardTitle","dashboardIntro","footerText"].map(k=>[k,defaults[k]]));await tx.query("UPDATE content_items SET draft=$1::jsonb || draft,published=CASE WHEN published IS NULL THEN NULL ELSE $1::jsonb || published END WHERE module='settings'",[JSON.stringify(patch)]);
    await insertRows(extras,(data,r)=>data.title||data.name||r.slug);if(await one(tx,"SELECT key FROM app_meta WHERE key='initial_content_seeded'")){
      if(!await one(tx,"SELECT key FROM app_meta WHERE key='matrix_seed_v2'")){
        const matrixRows=rows.filter(r=>r.module==='survey_rows'&&r.data.type==='矩阵量表');
        await tx.query("DELETE FROM content_items WHERE module='survey_rows' AND slug LIKE 'opc-B08-%' AND slug !~ '^opc-B08-m[0-9]+-[0-9]+$' AND version=1");
        await insertRows(matrixRows,(data,r)=>r.data.question);
        await tx.query("INSERT INTO app_meta(key,value) VALUES('matrix_seed_v2','true')");
      }
      return;
    }
    await insertRows(rows,(data,r)=>data.title||data.name||data.question||data.brand||r.slug);
    await tx.query(`INSERT INTO app_meta(key,value) VALUES('initial_content_seeded','true'),('matrix_seed_v2','true')`);
  });
}
export async function withBatchAvailability(db,batches){const used=(await db.query(`SELECT data->>'batchId' batch_id,sum((data->>'quantity')::int) n FROM workflow_items WHERE kind='orders' AND data->>'status' IN ('confirmed','shipped','completed') GROUP BY data->>'batchId'`)).rows;return batches.map(b=>{const allocated=Number(used.find(x=>x.batch_id===b.id)?.n||0);return{...b,allocatedQuantity:allocated,availableQuantity:b.stock===null?null:Math.max(0,b.stock-allocated)};});}
export async function published(db,module){const rows=(await db.query(`SELECT slug,published AS data FROM content_items WHERE module=$1 AND status!='archived' AND published IS NOT NULL ORDER BY sort_order,created_at`,[module])).rows.map(r=>({id:r.slug,...r.data}));return module==='batches'?withBatchAvailability(db,rows):rows;}
export async function publicBootstrap(db){
  const result=Object.fromEntries(Object.keys(MODULES).filter(k=>!MODULES[k].adminOnly).map(k=>[k,[]]));
  for(const row of (await db.query("SELECT module,slug,published FROM content_items WHERE status!='archived' AND published IS NOT NULL ORDER BY sort_order,created_at")).rows)if(Object.hasOwn(result,row.module))result[row.module].push({id:row.slug,...row.published});
  result.batches=await withBatchAvailability(db,result.batches);
  result.publications=(await db.query('SELECT id,title,body,source_refs,revision,created_at FROM publications WHERE active=true ORDER BY created_at DESC LIMIT 30')).rows.map(r=>({id:r.id,title:r.title,body:r.body,sourceRefs:r.source_refs,revision:r.revision,createdAt:r.created_at}));
  return result;
}
export const settings=async db=>(await published(db,'settings'))[0];
async function validatePublication(tx,module,slug,data){
  if(module==='batches'){const used=Number((await one(tx,`SELECT coalesce(sum((data->>'quantity')::int),0) n FROM workflow_items WHERE kind='orders' AND data->>'batchId'=$1 AND data->>'status' IN ('confirmed','shipped','completed')`,[slug])).n);if(used&&(data.status!=='verified'||data.stock===null||data.stock<used))fail(422,'该批次已有真实成交占用，总量不能少于已确认数量，事实状态须保持已核验');}
  if(module==='research_sets'&&await one(tx,`SELECT id FROM content_items WHERE module='survey_rows' AND published->>'dataset'=$1 AND (published->>'denominator')::int>$2 LIMIT 1`,[slug,data.n]))fail(422,'样本总量不能小于已发布问卷选项的有效分母，请先核对对应题目');
  if(module==='scenarios'&&!await one(tx,`SELECT id FROM content_items WHERE module='products' AND slug=$1 AND published IS NOT NULL AND status!='archived'`,[data.productId]))fail(422,'请先发布场景关联的推荐商品');
  if(module==='navigation'&&(!ROUTES.includes(slug)||data.route!==slug))fail(422,'入口编号须与固定路由一致');if(module==='home_groups'&&!['buy','create','learn'].includes(slug))fail(422,'分组编号仅支持buy、create、learn');if(module==='interface_text'){const old=await one(tx,'SELECT published FROM content_items WHERE module=$1 AND slug=$2',[module,slug]);if(old?.published&&old.published.original!==data.original)fail(422,'请保留原文定位，仅修改替换后的文字');}if(module==='pages'&&!ROUTES.includes(slug))fail(422,'页面编号须为现有网站页面');
  if(module==='batches'&&data.batchId!==slug)fail(422,'批次编号须与内容编号相同');
  if(module==='batches'&&data.status==='verified'&&!await one(tx,`SELECT id FROM content_items WHERE module='products' AND slug=$1 AND published IS NOT NULL AND status!='archived'`,[data.productId]))fail(422,'已核验批次须对应一款已发布规格，数量以该规格的箱或盒为单位');
  if(module==='batches'){const active=await one(tx,`SELECT data FROM workflow_items WHERE kind='orders' AND data->>'batchId'=$1 AND data->>'status' IN ('confirmed','shipped','completed') LIMIT 1`,[slug]);if(active&&active.data.productId!==data.productId)fail(422,'已有成交的批次不能更换商品规格，请新建对应规格的批次');}
  if(module==='research_sets'&&!['consumer','opc','farmer'].includes(slug))fail(422,'调查分组编号须为consumer、opc或farmer');
  if(module==='survey_rows'){
    const set=await one(tx,`SELECT published FROM content_items WHERE module='research_sets' AND slug=$1`,[data.dataset]);
    if(!set?.published)fail(422,'请先发布调查分组');
    if(data.denominator>set.published.n)fail(422,'有效分母不能大于该调查的样本总量');
    const duplicate=await one(tx,`SELECT id FROM content_items WHERE module='survey_rows' AND slug!=$1 AND status!='archived' AND published IS NOT NULL AND published->>'dataset'=$2 AND published->>'question'=$3 AND published->>'option'=$4 AND coalesce(published->>'dimension','')=$5`,[slug,data.dataset,data.question,data.option,data.dimension]);
    if(duplicate)fail(409,'此调查题号及选项已经存在，请编辑原记录');
  }
}
export function contentRouter(db,send){const router=Router();
  router.use(['/schema','/content'],requireRole('admin','operator','editor','viewer'));
  router.get('/schema',(req,res)=>send(res,{modules:MODULES,routes:ROUTES}));
  router.get('/content',async(req,res)=>{const module=req.query.module;if(!Object.hasOwn(MODULES,module))fail(422,'请选择内容模块');const {rows}=await db.query('SELECT * FROM content_items WHERE module=$1 ORDER BY sort_order,created_at',[module]);send(res,rows.map(contentRow));});
  router.get('/content/:id/history',async(req,res)=>{const rows=(await db.query('SELECT h.*,u.name AS actor_name FROM content_history h LEFT JOIN users u ON u.id=h.actor_id WHERE content_id=$1 ORDER BY id DESC LIMIT 100',[req.params.id])).rows;send(res,rows);});
  router.post('/content',requireRole('admin','operator','editor'),async(req,res)=>{const{module,slug,data,sortOrder=0}=req.body;if(!Object.hasOwn(MODULES,module))fail(422,'内容模块不存在');slugSchema.parse(slug);if(MODULES[module].singleton&&slug!==(MODULES[module].fixedSlug||'site'))fail(422,'该基础资料的编号固定，请编辑已有条目');if(module==='pages'&&!ROUTES.includes(slug))fail(422,'只可维护现有页面，请选择页面编辑');if(module==='research_sets'&&!['consumer','opc','farmer'].includes(slug))fail(422,'调查分组使用已有的三类编号');if(['settings','feature_controls'].includes(module)&&req.user.role!=='admin')fail(403,'网站设置仅管理员可修改');const validated=validateContent(module,data);if(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>100000)fail(422,'排序须为0—100000整数');const row=await db.transaction(async tx=>{const r=await one(tx,'INSERT INTO content_items(id,module,slug,title,draft,sort_order,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[uid('CNT'),module,slug,validated.title||validated.name||validated.question||validated.brand||slug,JSON.stringify(validated),sortOrder,req.user.id]);await audit(tx,req.user,'content.create',r.id,{module,slug});return r;});send(res,contentRow(row),201);});
  router.patch('/content/:id',requireRole('admin','operator','editor'),async(req,res)=>{const{version,data,sortOrder}=req.body;const row=await db.transaction(async tx=>{if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362011)');const r=await one(tx,'SELECT * FROM content_items WHERE id=$1 FOR UPDATE',[req.params.id]);if(!r)fail(404,'内容不存在');if(['settings','feature_controls'].includes(r.module)&&req.user.role!=='admin')fail(403,'网站设置仅管理员可修改');if(version!==r.version)fail(409,'这条内容已被其他人修改，请刷新后再编辑');const validated=validateContent(r.module,data);if(sortOrder!==undefined&&(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>100000))fail(422,'排序须为0—100000整数');await tx.query('INSERT INTO content_history(content_id,version,data,action,actor_id) VALUES($1,$2,$3,$4,$5)',[r.id,r.version,JSON.stringify(r.draft),'save',req.user.id]);const next=await one(tx,'UPDATE content_items SET title=$2,draft=$3,sort_order=$4,version=version+1,updated_at=now(),updated_by=$5 WHERE id=$1 RETURNING *',[r.id,validated.title||validated.name||validated.question||validated.brand||r.slug,JSON.stringify(validated),sortOrder??r.sort_order,req.user.id]);await audit(tx,req.user,'content.save',r.id,{module:r.module,version:next.version});return next;});send(res,contentRow(row));});
  router.post('/content/:id/:action',requireRole('admin','operator'),async(req,res)=>{if(!['publish','unpublish','archive','restore'].includes(req.params.action))fail(404,'操作不存在');const row=await db.transaction(async tx=>{if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362011)');const r=await one(tx,'SELECT * FROM content_items WHERE id=$1 FOR UPDATE',[req.params.id]);if(!r)fail(404,'内容不存在');if(['settings','feature_controls'].includes(r.module)&&req.user.role!=='admin')fail(403,'网站设置仅管理员可修改');if(req.body.version!==r.version)fail(409,'版本已变化，请刷新后重试');const action=req.params.action;
    if(['unpublish','archive'].includes(action)&&((r.module==='settings')||(r.module==='pages')||(r.module==='research_sets')||(r.module==='ip_profile')||(r.module==='feature_controls')||(r.module==='ai_settings')||(r.module==='navigation')||(r.module==='home_groups')))fail(422,'基础栏目不能撤下，可通过编辑内容调整');
    if(['unpublish','archive'].includes(action)&&r.module==='batches'&&await one(tx,"SELECT id FROM workflow_items WHERE kind='orders' AND data->>'batchId'=$1 AND data->>'status' IN ('confirmed','shipped') LIMIT 1",[r.slug]))fail(422,'该批次有未完成履约订单，完成或取消后才能撤下');
    if(['unpublish','archive'].includes(action)&&r.module==='products'&&await one(tx,`SELECT id FROM content_items WHERE module='scenarios' AND status!='archived' AND published->>'productId'=$1 LIMIT 1`,[r.slug]))fail(422,'此商品被消费场景推荐，请先修改场景的推荐商品');
    let data=r.draft;
    if(action==='restore'){const history=await one(tx,'SELECT data FROM content_history WHERE id=$1 AND content_id=$2',[req.body.historyId,r.id]);if(!history)fail(404,'历史版本不存在');data=history.data;}
    if(action==='publish')await validatePublication(tx,r.module,r.slug,validateContent(r.module,data));
    await tx.query('INSERT INTO content_history(content_id,version,data,action,actor_id) VALUES($1,$2,$3,$4,$5)',[r.id,r.version,JSON.stringify(r.draft),action,req.user.id]);
    const next=await one(tx,`UPDATE content_items SET draft=$2,published=$3,status=$4,version=version+1,updated_at=now(),updated_by=$5,published_at=$6,title=$7 WHERE id=$1 RETURNING *`,[r.id,JSON.stringify(data),action==='publish'?JSON.stringify(data):['unpublish','archive'].includes(action)?null:r.published?JSON.stringify(r.published):null,action==='publish'?'published':action==='archive'?'archived':'draft',req.user.id,action==='publish'?new Date():r.published_at,data.title||data.name||data.question||data.brand||r.slug]);await audit(tx,req.user,'content.'+action,r.id,{module:r.module,version:next.version});return next;});send(res,contentRow(row));});
  return router;
}
