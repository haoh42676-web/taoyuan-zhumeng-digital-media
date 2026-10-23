import {readFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';

const cache=new Map();
/** Explicit public JS/CSS only. Never use for API output, private uploads or configuration. */
export async function sendPublicAsset(req,res,file){
 const info=await stat(file),key=file+':'+info.mtimeMs+':'+info.size;
 let asset=cache.get(key);
 if(!asset){
  const plain=await readFile(file),gzip=plain.length>=1024?gzipSync(plain,{level:6}):null;
  asset={plain,gzip,etag:'"'+createHash('sha256').update(plain).digest('hex').slice(0,24)+'"'};
  if(cache.size>=40)cache.clear();cache.set(key,asset);
 }
 res.set('Cache-Control','public, max-age=0, must-revalidate').set('ETag',asset.etag).vary('Accept-Encoding');
 if(req.headers['if-none-match']?.split(',').map(s=>s.trim().replace(/^W\//,'')).includes(asset.etag))return res.status(304).end();
 res.type(extname(file));
 const encoding=String(req.headers['accept-encoding']||'').split(',').map(s=>s.trim()).find(s=>/^gzip(?:;|$)/i.test(s));
 if(asset.gzip&&encoding&&!/;\s*q=0(?:\.0*)?\s*$/i.test(encoding))return res.set('Content-Encoding','gzip').send(asset.gzip);
 return res.send(asset.plain);
}
