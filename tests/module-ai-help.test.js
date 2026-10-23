import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULES} from '../server/modules.js';
test('AI rules help matches primary, fallback and current local-only material classification',()=>{
 const help=MODULES.ai_settings.help;
 assert.ok(help.includes('项目AI主模型'));
 assert.ok(help.includes('六秒未完成或报错切换DeepSeek备用'));
 assert.ok(help.includes('回退本地规则'));
 assert.ok(help.includes('资料分类当前使用本地规则，GLM暂不启用'));
 assert.ok(help.includes('演示后台不调用外部AI'));
 assert.ok(help.includes('公开脱敏片段'));
 assert.ok(help.includes('密钥仅放环境变量'));
});
