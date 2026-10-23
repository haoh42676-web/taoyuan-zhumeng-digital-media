import { gzipSync,gunzipSync } from 'node:zlib';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { one } from './db.js';
import { fail } from './modules.js';
import {ensureMaterialsSchema} from './materials.js';
export const TABLES=['content_items','content_history','business_records','record_notes','drafts','draft_history','publications','media','analytics_events','request_logs','audit_logs','workflow_items','workflow_history','material_intakes'];
const actorColumns=['actor_id','created_by','updated_by','owner_id','assigned_to','published_by'];
export async function createBackup(db){await ensureMaterialsSchema(db);return db.transaction(async tx=>{if(db.kind==='postgres')await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const data={format:'taoxiang-backup',version:1,createdAt:new Date().toISOString(),tables:{}};for(const table of TABLES){const rows=(await tx.query('SELECT * FROM '+table+(table==='material_intakes'?" WHERE state='committed'":''))).rows;data.tables[table]=rows.map(row=>({...row,...(table==='media'?{bytes:Buffer.from(row.bytes).toString('base64')}:table==='material_intakes'?{original_bytes:Buffer.from(row.original_bytes).toString('base64')}:{})}));}return gzipSync(Buffer.from(JSON.stringify(data)));});}
export async function saveBackup(db){const dir=resolve(process.env.BACKUP_DIR||'backups');await mkdir(dir,{recursive:true});const path=join(dir,'taoxiang-'+new Date().toISOString().replaceAll(':','-')+'.json.gz');await writeFile(path,await createBackup(db),{mode:0o600});return path;}
export async function restoreBackup(db,buffer){await ensureMaterialsSchema(db);let data;try{const decoded=gunzipSync(buffer,{maxOutputLength:512*1024*1024});data=JSON.parse(decoded.toString('utf8'));}catch{fail(422,'无法读取备份，请选择本系统导出的.json.gz文件');}if(data.format!=='taoxiang-backup'||data.version!==1||!data.tables)fail(422,'备份格式或版本不匹配');for(const t of ['workflow_items','workflow_history','material_intakes'])if(data.tables[t]===undefined)data.tables[t]=[];if(TABLES.some(t=>!Array.isArray(data.tables[t])))fail(422,'备份格式或版本不匹配');if(TABLES.some(t=>data.tables[t].length>1000000))fail(422,'备份记录过多');
  await db.transaction(async tx=>{
    if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362010)');
    const users=new Set((await tx.query('SELECT id FROM users')).rows.map(r=>r.id));
    for(const table of [...TABLES].reverse())await tx.query('DELETE FROM '+table);
    for(const table of TABLES){const columns=new Set((await tx.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1",[table])).rows.map(r=>r.column_name));for(const source of data.tables[table]){if(!source||typeof source!=='object'||Array.isArray(source))fail(422,'备份记录损坏');const row={...source};for(const key of actorColumns)if(row[key]&&!users.has(row[key]))row[key]=null;if(table==='media')row.bytes=Buffer.from(row.bytes,'base64');if(table==='material_intakes')row.original_bytes=Buffer.from(row.original_bytes,'base64');const keys=Object.keys(row);if(keys.some(k=>!columns.has(k)))fail(422,'备份包含未知字段');const vals=keys.map(k=>row[k]&&typeof row[k]==='object'&&!Buffer.isBuffer(row[k])&&!(row[k] instanceof Date)?JSON.stringify(row[k]):row[k]);await tx.query('INSERT INTO '+table+' ('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+')',vals);}
      if(['content_history','record_notes','draft_history','audit_logs','workflow_history'].includes(table))await tx.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),coalesce((SELECT max(id) FROM ${table}),0)+1,false)`);
    }
    await tx.query('DELETE FROM sessions');
    await tx.query(`INSERT INTO app_meta(key,value) VALUES('last_restore',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,[JSON.stringify({at:new Date().toISOString(),sourceAt:data.createdAt})]);
  });return{restored:true,sourceAt:data.createdAt,counts:Object.fromEntries(TABLES.map(t=>[t,data.tables[t].length]))};
}
export const readBackup=path=>readFile(path);
