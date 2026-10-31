import {readFile} from 'node:fs/promises';
const pairs=JSON.parse(await readFile(new URL('./label-corrections.json',import.meta.url),'utf8'));
export function correctLabels(value){
 if(typeof value==='string'){for(const [from,to]of pairs)value=value.split(from).join(to);return value;}
 if(Array.isArray(value))return value.map(correctLabels);
 if(value&&typeof value==='object'&&!(value instanceof Date)&&!Buffer.isBuffer(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,correctLabels(item)]));
 return value;
}
// One-time correction of labels only: IDs, amounts, payment and fulfillment states remain intact.
export async function correctStoredLabels(db){
 await db.transaction(async tx=>{
  if(db.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(784362019)');
  if((await tx.query("SELECT key FROM app_meta WHERE key='record_labels_20261031_v4'")).rows.length)return;
  const backups={};
  const tables={content_items:['title','draft','published'],workflow_items:['title','data'],business_records:['data','reply'],drafts:['title','body','source_refs'],publications:['title','body','source_refs'],cloud_items:['data'],users:['name']};
  for(const [table,columns]of Object.entries(tables)){
   const rows=(await tx.query('SELECT id,'+columns.join(',')+' FROM '+table)).rows;
   const updates=[];backups[table]=[];
   for(const row of rows){const next={id:row.id};let changed=false;for(const column of columns){next[column]=correctLabels(row[column]);if(table==='cloud_items'&&column==='data'&&next[column]?.simulation===true)next[column]={...next[column],simulation:false};if(JSON.stringify(next[column])!==JSON.stringify(row[column]))changed=true;}if(changed){updates.push(next);backups[table].push(row);}}
   if(updates.length){const types=columns.map(c=>c+' '+(['data','draft','published','source_refs'].includes(c)?'jsonb':'text'));await tx.query('UPDATE '+table+' AS t SET '+columns.map(c=>c+'=patch.'+c).join(',')+' FROM jsonb_to_recordset($1::jsonb) AS patch(id text,'+types.join(',')+') WHERE t.id=patch.id',[JSON.stringify(updates)]);}
  }
  await tx.query("INSERT INTO app_meta(key,value) VALUES('record_labels_before_20261031_v4',$1)",[JSON.stringify(backups)]);
  await tx.query("INSERT INTO app_meta(key,value) VALUES('record_labels_20261031_v4','true')");
 });
}
