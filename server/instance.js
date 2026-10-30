import {createHash} from 'node:crypto';

const FORBIDDEN_SOURCE_DATABASE = 'c8adf3800a556fed456b3dc8d4d8595f17750f5fe794562806d9ba0f8bc76070';

export const INSTANCE_ID = 'digital-media-independent-20261029';

export function databaseIdentity(url) {
  const parsed = new URL(url);
  return createHash('sha256').update(parsed.hostname.replace('-pooler.', '.') + parsed.pathname).digest('hex');
}

export function assertIndependentDatabase({url=process.env.DATABASE_URL, instanceId=process.env.SITE_INSTANCE_ID, expected=process.env.DATABASE_IDENTITY_SHA256, production=process.env.NODE_ENV==='production'}={}) {
  if (!url && !production) return;
  if (instanceId !== INSTANCE_ID) throw new Error('独立站实例标识缺失或不匹配，已阻止连接数据库');
  if (url && databaseIdentity(url) === FORBIDDEN_SOURCE_DATABASE) throw new Error('已阻止独立站连接原站数据库');
  if (!url || !expected || databaseIdentity(url) !== expected) throw new Error('独立站数据库指纹不匹配，已阻止连接数据库');
}
