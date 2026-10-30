import test from 'node:test';
import assert from 'node:assert/strict';
import {INSTANCE_ID, assertIndependentDatabase, databaseIdentity} from '../server/instance.js';

test('independent database guard rejects an old or mistyped database before connecting', () => {
  const own='postgresql://user:password@independent.example/app';
  const old='postgresql://user:password@old-site.example/app';
  const expected=databaseIdentity(own);
  assert.doesNotThrow(()=>assertIndependentDatabase({url:own,instanceId:INSTANCE_ID,expected,production:true}));
  assert.throws(()=>assertIndependentDatabase({url:old,instanceId:INSTANCE_ID,expected,production:true}),/指纹/);
  assert.throws(()=>assertIndependentDatabase({url:own,instanceId:'',expected,production:true}),/实例/);
  assert.throws(()=>assertIndependentDatabase({url:own,instanceId:INSTANCE_ID,expected:'',production:true}),/指纹/);
});

test('database guard treats a pooled hostname as the same database, and permits offline development', () => {
  assert.equal(databaseIdentity('postgresql://a:b@ep-example-pooler.test/db'),databaseIdentity('postgresql://a:b@ep-example.test/db'));
  assert.notEqual(databaseIdentity('postgresql://a:b@ep-example.test/db'),databaseIdentity('postgresql://a:b@ep-example.test/other'));
  assert.doesNotThrow(()=>assertIndependentDatabase({url:'',production:false}));
  assert.throws(()=>assertIndependentDatabase({url:'',instanceId:INSTANCE_ID,production:true}),/指纹/);
});
