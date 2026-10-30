import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

// Dedicated local preview: fresh local data, generated staff login, public demo account.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
for(const key of Object.keys(process.env)){
  if(/^(DATABASE|ADMIN_|SINGLE_ADMIN|SITE_INSTANCE|SESSION_SECRET|SERVERLESS|TRUST_PROXY)/.test(key)||/API_KEY$/.test(key))delete process.env[key];
}
process.env.NODE_ENV='development';
process.env.DATABASE_URL='';
process.env.PORT=process.env.OPC_PREVIEW_PORT||'8791';
process.env.APP_URL='http://127.0.0.1:'+process.env.PORT;
process.env.LOCAL_DATA_DIR=resolve(root,'.data/opc-preview');
await import('../server/index.js');
