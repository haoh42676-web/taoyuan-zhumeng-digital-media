// Curated public knowledge only. Never import source_library or operating records here.
// Customer facts remain separate from the private material intake and LLM credentials.
const fact=(id,topic,text,source,status='reference')=>Object.freeze({id,topic,text,source,status});
const V2C='问卷V2 · 01_消费者调研问卷.csv（现行问卷汇总）';
const V2B='问卷V2 · 02_学生与OPC调研问卷.csv（现行问卷汇总）';
const FARMER='附件04 · 上坪镇鹰嘴蜜桃产业农户调研数据';
const FACTS=Object.freeze([
  fact('project-identity','overview','数商桃乡（桃源筑梦）围绕广东河源连平县上坪镇鹰嘴蜜桃，口号为“数商桃乡，让好桃被看见”。项目把真实产地与批次信息、IP内容表达、消费咨询、履约回访和青年协作连接起来。','icanAIOPC项目书 §3.1；实践报告 §3-1','plan'),
  fact('project-path','overview','完整路径是：桃农确认商品与批次事实 → 学生采集和表达 → 运营审核 → 发布内容与接受咨询 → 对接已有店铺的真实成交 → 履约售后 → 回访和经营复盘。演示平台用记录串起流程，业务结果需真实凭据验证。','icanAIOPC §3.1、§3.2、§5.1—§5.5；实践报告 §3-1、§4-2','plan'),
  fact('product-fresh5','sales','5斤大果家庭装，单果约150—200g，方案参考价65元。参考价不等于含配送费的到手总价；是否可售、实际价格和发货窗口待当批核验。','project-data.js · products/fresh-5；icanAIOPC商品方案','reference'),
  fact('product-fresh2','sales','2—3斤尝鲜装用于降低首次体验门槛；当季批次价格待确认，不把未知价格填成0元。','project-data.js · products/fresh-2；问卷V2 C15','reference'),
  fact('product-gifts','sales','12个大果礼盒单果约180—200g，方案参考价68元/盒；12个特大果礼盒单果约200—225g，方案参考价78元/盒。礼盒数量和重量是不同计量口径，实际内容与到手总价须按批次确认。','project-data.js · products/gift-12、gift-max','reference'),
  fact('product-group','sales','8斤大果团购装方案参考价88元，仍需核验收货区域、配送费、数量与交付窗口。小桃满礼盒卡和贴纸属于设计展示，不能当作可售鲜桃或虚构库存。','project-data.js · products/group-8、ip-card','reference'),
  fact('purchase-confirmation','sales','下单前需确认七项：真实产地与实际发货地、规格与分级、批次可售数量、商品价格与单位、区域配送费、采摘及发货窗口、售后规则。展示规格或提交商品咨询不等于付款成功或订单确认。','server/modules.js · REVIEW_ITEMS；实践报告 §3-1','boundary'),
  fact('delivery-limit','delivery','鲜果按成熟度分批采摘；配送地区、运费、发货窗口和到手总价以已核验批次及运营确认为准。问卷里的48小时假设与访谈中的冷链讨论都不是实际48小时到货承诺。','问卷V2消费情境；附件02、06；公开售后FAQ','boundary'),
  fact('delivery-tracking','delivery','平台可关联已登记订单与人工录入的发货、签收状态，未接入快递实时轨迹。核验本人登记记录后只应展示必要且脱敏的信息，不能用他人单号、手机号或姓名查询。','icanAIOPC §5.4；server/workflow-schema.js · orders','boundary'),
  fact('aftercare-process','aftercare','收到果品先检查外箱与果品，保留外箱、面单和问题照片，按购买前公开的当批规则提交反馈，由运营结合凭据核验和联系处理。提交表单不等于已确认赔付、自动退款或已转账。','公开FAQ；icanAIOPC §5.4；附件02、06','boundary'),
  fact('aftercare-storage','aftercare','保存与食用以随箱当批指南为准。缺少正式温度、时长或成熟度信息时不能自行补造保鲜天数；可请运营确认并优先处理到货问题。','公开FAQ · 收到后如何保存','reference'),
  fact('trace-four','trace','事实链分四步：果园采摘记录产地、采摘日、批次和规格；分拣装箱记录果重、分档、数量及包装；发货记录区域、运费、窗口与保存提示；收货回访记录反馈、问题照片和人工处理结果。每步需对应责任人和来源。','project-data.js · traceSteps；icanAIOPC §4.5；实践报告 §3-1','plan'),
  fact('trace-limit','trace','批次号和核验码仅帮助定位资料，不自动证明真伪。已核验是责任人对原始记录的确认，不等于区块链、第三方认证或检测报告。示例、待核验与已核验记录必须分开。','server/workflow-schema.js · PROJECT_MAP/facts；批次公开规范','boundary'),
  fact('ip-character','ip','小桃满定位为“上坪桃林守护人、品牌好物推荐官”，性格真诚、细致、有点俏皮。以icanAIOPC角色设计为准，保持桃形轮廓、草帽和服饰识别特征。','icanAIOPC 策划书4.2；公开ip_profile','plan'),
  fact('ip-six-series','ip','小桃满的六类栏目为：桃林日记、一箱桃的说明卡、小桃满的社群话术、直播导购脚本、收货后的陪伴、一日桃乡导览。分别承接真实采摘分拣、规格服务说明、授权后的社群沟通、直播咨询、收货保存反馈和农文旅意向。','project-data.js · ipData；公开ip_series','plan'),
  fact('ip-marketing-path','ip','IP辅助营销流程为：收集真实产地素材与已确认商品事实 → 选栏目和渠道模板 → 生成草稿 → 七项事实与服务复核 → 人工发布或导出 → 记录渠道反馈与咨询 → 复盘。IP帮助理解、记忆与分享，不能代替事实或直接宣称提高成交率。','icanAIOPC §4.4、§4.6、§5.2；实践报告 §3-1、§4-2','plan'),
  fact('ip-fiction-boundary','ip','角色故事、插画和情绪表达是原创创意内容，不能当作当地历史、真实果园照片、产地证明或农残认证。IP画面与真实素材分别标明；真实批次、规格、价格和售后在下单前展示。','icanAIOPC IP设计；问卷V2 C20；公开角色使用规范','boundary'),
  fact('research-samples','research','三组调查独立：消费者243份；学生与OPC437份，其中在校学生351人；产业端206份，其中自有果园159人、管理他人果树47人。不能把437人全部称作学生或专业运营者，也不能把三组直接合并为一个代表性总体。',V2C+'；'+V2B+'；'+FARMER,'research'),
  fact('research-C14','research','消费者C14（多选，有效分母243）：口感/甜度/质地137人，56.4%；新鲜度与到货完好112人，46.1%；到手总价59人，24.3%；产地证明70人，28.8%；农残检测信息48人，19.8%；口碑与售后60人，24.7%。这是消费者直接回答，不能用农户转述替代。',V2C+' · C14','research'),
  fact('research-C15','research','消费者C15：2—3斤尝鲜装76人、5斤家庭装86人，合计162/243=66.7%。支持先验证尝鲜与家庭装需求，选择意向不是已售数量。',V2C+' · C15','research'),
  fact('research-C16','research','消费者C16在统一5斤情境下：最高可接受到手价49元及以下56人、50—69元93人，合计149/243=61.3%的上限不超过69元。这是设定情境的支付意愿，不是成交价、统一定价或真实配送承诺。',V2C+' · C16','research'),
  fact('research-C17','research','消费者C17：只接受包邮93人、可接受1—10元配送费79人，合计172/243=70.8%。应据区域核算配送成本，不应据此声称平台已经包邮。',V2C+' · C17','research'),
  fact('research-C20','research','消费者C20（多选，分母243）：真实果园采摘分拣实拍123人，50.6%；真实开箱试吃评价100人，41.2%；规格重量口感对比85人，35.0%；小桃满插画/科普32人，13.2%。IP可辅助营销，但真实证据和服务信息优先。',V2C+' · C20','research'),
  fact('research-C25','research','消费者C25（多选，分母243）：到手总价超预算107人，44.0%；担心产地不真实91人，37.4%；破损或时效不确定93人，38.3%；售后不清楚56人，23.0%。不能从农户端价格回答较少推断消费者不重视价格。',V2C+' · C25','research'),
  fact('research-B07','research','学生与OPC的B07（分母437）：只接触相关知识155人；有课程/竞赛/公益实践但未处理真实订单145人，合计300/437=68.6%；参与过真实订单但非主要负责91人；独立或主要负责经营售后35人；无法判断11人。68.6%按原始人数计算，不能相加四舍五入的百分比得到68.7%。',V2B+' · B07','research'),
  fact('research-industry','research','产业端：Q02自有果园159/206；Q06不会用线上软件卖桃199/206；Q04没有统一运输/包装地点157/206；Q08不愿长期统一收果112/206。不会操作不等于不愿学习；材料不支持旧说法“67.48%不愿学习线上销售”和“62.14%种桃非家庭主要收入”。',FARMER+' · Q02、Q04、Q06、Q08','research'),
  fact('research-indirect','research','产业端Q09中179/195=91.79%是农户回答“客人买桃最看重什么”中的口感偏好，属于农户转述，不是消费者直接验证。Q10销售渠道/市场问题148/198；Q14希望拓展或稳定销售144/189。各题用有效分母，不能统一套206。',FARMER+' · Q09、Q10、Q14','research'),
  fact('research-interviews','research','附件01市民访谈用于理解购买沟通；附件02企业负责人访谈涉及分级、物流与短季，生产量、广告费和运费属于口述估计；附件06为30人次访谈汇编，可能与单独访谈重合。80箱、120箱、150箱是受访者的采购经历，不能计作团队销量。','附件01、02、06 · 公开脱敏访谈摘要','qualitative'),
  fact('research-outcomes','research','已完成页面、角色设计、问卷汇总和流程实现，与经营效果分开。降低购买疑虑、减少争议、提升销量等效果需真实试行数据。初始4万元和三年财务测算属于预算或预测，不能写成已投入、已收入或已盈利。','实践报告 §4-1、§4-2、§5-2；预算与财务测算说明','boundary'),
  fact('opc-roles','opc','桃农确认产品与批次事实；学生承担真实素材采集、事实整理、渠道文案或服务记录等明确任务；有经验的运营者审核并承担经营责任；AI辅助重复整理，不能默认学生能独立经营。','实践报告 §3-1、§3-3、§4-2；问卷V2 B07','plan'),
  fact('opc-task-loop','opc','青年协作需先培训与操作演练，再明确任务、事实来源、交付标准、执行人和审核人；交付后可退回返工，验收通过后登记工时、约定费用与结算凭据。系统只记录结算，不代为转账。','server/workflow-schema.js · tasks；实践报告 §4-2；icanAIOPC §7.1','plan'),
  fact('opc-decisions','opc','OPC经营闭环：记录市场/消费者/履约信号 → 提出假设、行动、指标和风险 → 运营采纳或拒绝 → 派发任务 → 验收 → 小范围对照观察 → 记录结果与局限 → 回写内容、客户或规则。规则建议公开依据，不等于模型推理或因果证明。','icanAIOPC §3.2.1—§3.2.4；工作流signals/decisions/tasks/experiments','plan'),
  fact('cooperation-start','cooperation','合作可从果园事实采集、分拣与配送协同、学生任务、IP内容和接待意向切入。先明确合作角色、可提供事实、容量、成本与责任，再通过站内咨询登记，由运营核验后决定是否承接。意向不是签约，不编造已有合作单位或收益保障。','icanAIOPC §3.1、§5.4、§7.1；实践报告 §3-1、§4-2','plan'),
  fact('cooperation-privacy','cooperation','合作说明可用非敏感角色与流程；私人电话、个人二维码、学生名册和农户明细不公开。服务联系与营销授权分别记录，服务同意不能当营销同意。','公开社交入口脱敏说明；工作流customers/tasks','boundary'),
  fact('competition-map','competition','赛事辅助演示可围绕四条讲解线：问题与研究证据、消费者选购路径、小桃满IP辅助营销、OPC协作与乡村推广。页面承担材料与流程解释，不自动证明商业成果、赛事资格、奖项或已落地合作。','公开slides；问卷V2、附件01/02/04/06；实践报告 §3-2','plan'),
  fact('competition-boundary','competition','文化传播、品牌设计、数字乡村服务和农文旅可按具体赛项重点组织材料；当届组别、资格、日期和提交要求须以该届正式通知为准，本知识库不声称掌握最新赛程。','项目赛事讲解使用边界','boundary'),
  fact('tour-route','tour','“一日桃乡”设想包含果园观察、分拣体验、集市与礼盒等节点，用小桃满导览串联真实体验。接待日期、人员、容量、安全和卫生条件须合作方确认，路线展示不是正式开放承诺。','project-data.js · rural；icanAIOPC农文旅方案','plan'),
  fact('tour-intention','tour','基线方案的接待日期与容量尚未核实；可记录出行意向。提交意向不预留名额、不收费、不确认预约或接待方接受，正式安排需后续人工确认。','公开tours初始接待条件；bookingAvailable/openDates/capacity','boundary'),
  fact('platform-tech','platform','平台前端以HTML、CSS和JavaScript实现页面与交互，服务端为Node.js与Express，线上数据使用Neon PostgreSQL并由Render提供网页服务；本地可使用PGlite。浏览器通过同源HTTP API连接服务端，数据库连接与模型密钥仅在服务端配置。','package.json；server/app.js、db.js；项目技术说明','reference'),
  fact('platform-demo','platform','GitHub Pages静态备份的记录仅保存在当前浏览器，不能当成连通生产后台。演示账号与演示业务数据应隔离并标为模拟；真实经营看板不应由模拟销量填充。','项目静态备份与演示隔离说明','boundary'),
  fact('platform-ai','platform','智能辅助包括客服、商品文案、基于浏览或场景的可解释推荐、经营看板和资料分类草稿。规则或模板可独立运行；外部模型以当前服务状态为准。生成文案和资料归类都需人工核验，上传原件与私人档案不向客服公开。','ai-core.js；智能辅助与资料导入规范','boundary'),
  fact('platform-account','platform','客户登录与后台工作人员账号分开。客户会话和本人登记状态需按权限访问，客服不能提供后台密码、他人数据或数据库内容。速率、站点与账户限额减少滥用，不宣称绝对防代理。','server/customer.js；客服隐私与限额规范','boundary')
]);

const TOPIC_RULES=[
  ['research',/问卷|调查|调研|样本|分母|访谈|证据|数据来源|多少(?:人|份)|C(?:14|15|16|17|20|25)|B07|Q(?:02|04|06|08|09|10|14)|243|437|206|351|91[.．]79|68[.．]6/i],
  ['ip',/小桃满|\bIP\b|角色|插画|贴纸|草帽|文创|营销|内容创作|直播|脚本|桃林日记|说明卡|传播/i],
  ['opc',/\bOPC\b|学生|青年|培训|工时|验收|任务|返工|运营(?:者|协作|闭环|决策)|复盘|实验|对照/i],
  ['cooperation',/合作|加入|参与|接洽|对接|签约|加盟|农户|桃农|责任|分工|联系项目/i],
  ['competition',/赛事|赛项|比赛|竞赛|参赛|答辩|评委|获奖|奖项|讲解|新文科|ican|攀登/i],
  ['tour',/农文旅|旅游|桃乡游|导览|一日|采摘体验|接待|预约|路线|名额/i],
  ['trace',/溯源|批次|核验|产地|发货地|认证|检测|区块链|追溯|核验码/i],
  ['delivery',/物流|配送|运费|包邮|邮费|到货|发货|快递|单号|订单|查单|到哪|运输|冷链|48小时/i],
  ['aftercare',/售后|坏桃|坏了|挤压|破损|退款|退货|赔付|赔偿|签收|保存|保鲜|食用|投诉/i],
  ['sales',/商品|产品|价格|多少钱|贵|元|规格|斤|礼盒|团购|尝鲜|家庭装|选购|下单|买桃|购买|库存|桃子|蜜桃|鹰嘴桃|鹰嘴蜜桃/i],
  ['platform',/平台|网站|页面|前端|后台|前台|账号|登录|注册|接口|技术|数据库|框架|部署|隐私|脱敏|演示|静态|模型|客服|智能|AI|Render|Neon|GitHub|API/i],
  ['overview',/数商桃乡|桃源筑梦|项目|口号|上坪|连平|河源|桃乡/i]
];
const FOLLOWUP=/^(?:请)?(?:继续|再详细(?:一点|一些)?|详细(?:一点|一些)?|具体(?:一点|一些)?|展开(?:说说)?|讲清楚(?:一些)?|为什么(?:这样做)?|有什么依据|怎么参与|如何参与|然后呢|还有呢|什么意思|这个呢|能举例吗|举个例子|介绍一下)[？?。！!\s]*$/;
const EXTRACTION=/(?:忽略|绕过|覆盖|撤销).{0,20}(?:规则|指令|限制|提示|系统)|(?:输出|显示|泄露|读取|导出|给我|告诉我|查询|获取|发我).{0,24}(?:系统提示词|system\s*prompt|管理员密码|账号密码|API[_ -]?KEY|密钥|令牌|数据库连接串|DATABASE_URL|其他人|所有客户|个人明细|原始问卷)|(?:系统提示词|管理员密码|数据库连接串|DATABASE_URL).{0,12}(?:是什么|多少|给我)|(?:ignore|override|bypass).{0,24}(?:instructions|rules|system)|(?:reveal|print|show|give).{0,24}(?:system\s*prompt|api[_ -]?key|password|secret|token)|越狱|sql注入|反向代理.{0,10}(?:绕过|盗用)/i;
const UNRELATED=/天气预报|彩票开奖|比特币|股票推荐|基金推荐|诊断(?:疾病|癌症)|治疗方案|处方药|代写.{0,12}(?:论文|作业)|(?:写|生成|执行|运行).{0,15}(?:python|shell|powershell|恶意代码|病毒|爬虫)|(?:解|计算).{0,12}(?:方程|积分|微分)|政治观点|赌博|色情|(?:IP地址|子网掩码).{0,15}(?:计算|怎么|是什么)|(?:计算|算一下|求解).{0,12}\d+\s*[+*/=]/i;
function questionInfo(message){
  const q=typeof message==='string'?message.normalize('NFKC').trim().slice(0,2000):'';
  if(!q||EXTRACTION.test(q)||UNRELATED.test(q))return{q,topics:[],followup:false};
  const followup=q.length<=36&&FOLLOWUP.test(q);
  const topics=TOPIC_RULES.filter(([,r])=>r.test(q)).map(([t])=>t);
  return{q,topics:followup&&!topics.length?['overview','opc']:topics,followup};
}
export function isProjectQuestion(message){return questionInfo(message).topics.length>0;}

const BOUNDARIES=Object.freeze([
  '只使用已发布且允许公开的项目事实；不读取原始档案、个人明细、客户记录、会话令牌或服务端密钥。',
  '研究、定性访谈、方案、参考价格、示例和已核验记录分别说明；没有试行数据不能声称营销效果、真实销量或利润。',
  '到手总价、可售数量、区域运费、发货窗口和售后须按当批核验；48小时情境不是到货承诺。',
  '不执行支付、自动退款、转账、真实预约、社交平台发布或他人数据查询；人工复核与经营责任保留。',
  '模型是否可用以运行时结果为准；规则回答、模型辅助、演示模拟分别标注。'
]);

// Published publicBootstrap maps are allowed. Raw CMS rows and private modules are not.
const PUBLIC_FIELDS=Object.freeze({
  pages:['title','intro','body','notice','sourceRef'],
  products:['name','category','scene','type','price','priceNote','desc','fields','sourceRef'],
  scenarios:['title','productId','copy','filter'],
  batches:['batchId','productId','status','originName','shippingOrigin','harvestDate','stock','availableQuantity','shippingFee','shippingWindow','grading','shippingRegions','aftercareRule','sourceRef','verifiedAt'],
  trace_steps:['title','description','state'],
  ip_profile:['name','identity','tone','description','guide','sourceRef'],
  ip_series:['title','copy','use','voice','sourceRef'],
  research_sets:['name','n','source','note'],
  survey_rows:['dataset','question','dimension','type','option','label','count','denominator','sourceRef'],
  interviews:['title','type','body','sourceRef'],
  tours:['name','description','stops','openDates','capacity','inquiryEnabled','bookingAvailable','conditions','sourceRef'],
  faqs:['question','answer','sourceRef'],
  slides:['title','copy','source','route'],
  templates:['title','channel','body','sourceRef'],
  settings:['brand','brandSubtitle','slogan','heroIntro','heroNote','privacyNotice']
});
const MODULE_TOPICS={pages:'overview',products:'sales',scenarios:'sales',batches:'trace',trace_steps:'trace',ip_profile:'ip',ip_series:'ip',research_sets:'research',survey_rows:'research',interviews:'research',tours:'tour',faqs:'aftercare',slides:'competition',templates:'ip',settings:'overview'};
const PAGE_TOPICS={home:'overview',evidence:'research',consumer:'sales',trace:'trace',ip:'ip',operator:'opc',content:'ip',rural:'tour',service:'aftercare',competition:'competition',records:'platform',api:'platform'};
const INSTRUCTION=/(?:忽略|覆盖|绕过|撤销|不遵守).{0,18}(?:指令|规则|提示|限制|系统)|(?:你是|扮演|变成).{0,15}(?:系统|管理员|root|开发者)|system\s*(?:prompt|message)|(?:输出|显示|透露|读取|访问|发送).{0,18}(?:密钥|密码|环境变量|令牌|数据库|原件|提示词)|(?:ignore|override|bypass).{0,24}(?:instructions|rules|system)|(?:API[_ -]?KEY|DATABASE_URL|password|authorization)\s*[:=]|<\s*script|javascript:|data:|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/i;
function clean(value,max=650){
  if(typeof value!=='string')return'';
  let s=value.normalize('NFKC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').trim();
  if(!s||INSTRUCTION.test(s))return'';
  s=s.replace(/https?:\/\/[^\s<>()]+/gi,'[链接略]').replace(/(?:[A-Z]:[\\/]|\\\\)[^\s，。；]+/gi,'[本地路径略]')
    .replace(/sk-[a-z0-9_-]{8,}/gi,'[密钥已隐藏]').replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+)\b/gi,'[令牌已隐藏]')
    .replace(/(?:\+?86[- ]?)?1[3-9](?:[- ]?\d){9}(?!\d)/g,'[手机号已隐藏]').replace(/\b\d{17}[\dXx]\b/g,'[证件号已隐藏]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]')
    .replace(/(?:姓名|联系人|受访者姓名|学生姓名|真实姓名)\s*[:：=]\s*[\p{Script=Han}A-Za-z· ]{2,20}/gu,'[个人姓名已隐藏]')
    .replace(/(?:详细地址|家庭住址|收货地址|学号|微信号|身份证号)\s*[:：=]\s*[^，。；\n]{1,90}/g,'[个人信息已隐藏]')
    .replace(/<[^>]*>/g,'').replace(/\s{2,}/g,' ');
  return s.slice(0,max);
}
function safeValue(v){
  if(typeof v==='string')return clean(v);
  if(typeof v==='boolean'||v===null)return v;
  if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=1e8?v:undefined;
  if(Array.isArray(v))return v.slice(0,12).map(x=>Array.isArray(x)?x.slice(0,2).map(t=>clean(t,220)).filter(Boolean):clean(x,220)).filter(x=>Array.isArray(x)?x.length===2:!!x);
}
function publicRows(publicContent,module){
  if(!publicContent||typeof publicContent!=='object'||Array.isArray(publicContent)||!Object.hasOwn(publicContent,module)||!Array.isArray(publicContent[module]))return[];
  return publicContent[module].slice(0,module==='survey_rows'?700:50).flatMap(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.hasOwn(row,'draft')||Object.hasOwn(row,'published')||row.visibility==='private'||row.status==='draft'||row.status==='archived'||row.public===false)return[];
    const id=clean(row.id,80);if(!id||!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id))return[];
    const data={id};for(const k of PUBLIC_FIELDS[module])if(Object.hasOwn(row,k)){const v=safeValue(row[k]);if(v!==undefined&&v!=='')data[k]=v;}
    return[data];
  });
}
const label={title:'标题',intro:'介绍',body:'内容',notice:'状态说明',name:'名称',category:'类别',scene:'消费场景',type:'类型',price:'公布价格',priceNote:'价格状态',desc:'说明',fields:'详情',productId:'关联商品',copy:'说明',filter:'类别',batchId:'批次编号',status:'事实状态',originName:'实际产地',shippingOrigin:'实际发货地',harvestDate:'采摘日期',stock:'本批总量',availableQuantity:'可售余量',shippingFee:'配送费',shippingWindow:'发货窗口',grading:'分档',shippingRegions:'配送区域和费用',aftercareRule:'当批售后',verifiedAt:'核验日期',description:'说明',state:'记录状态',identity:'角色定位',tone:'语气',guide:'使用规范',use:'使用触点',voice:'角色台词',n:'样本总量',note:'口径局限',dimension:'维度',question:'题号或问题',option:'选项',answer:'回答',stops:'路线节点',openDates:'可接待日期',capacity:'容量',inquiryEnabled:'接受意向',bookingAvailable:'接待条件已核实',conditions:'接待限制',route:'对应页面',channel:'渠道',brand:'品牌',brandSubtitle:'副标题',slogan:'口号',heroIntro:'首页介绍',heroNote:'首页状态',privacyNotice:'隐私说明'};
function line(row,excluded=[]){return Object.entries(row).filter(([k])=>!['id','sourceRef','source',...excluded].includes(k)).map(([k,v])=>(label[k]||k)+'：'+(Array.isArray(v)?v.map(x=>Array.isArray(x)?x.join('—'):x).join('；'):v===null?'待确认':typeof v==='boolean'?(v?'是':'否'):v)).join('；').slice(0,2200);}
const SURVEYS=Object.freeze({consumer:{name:'消费者',n:243,prefix:'C',source:V2C},opc:{name:'学生与OPC',n:437,prefix:'B',source:V2B},farmer:{name:'产业端',n:206,prefix:'Q',source:FARMER}});
function researchContext(publicContent){
  const sets=new Map(publicRows(publicContent,'research_sets').filter(r=>Object.hasOwn(SURVEYS,r.id)&&r.name&&r.source&&Number.isInteger(r.n)&&r.n>0).map(r=>[r.id,r]));
  const rows=publicRows(publicContent,'survey_rows').filter(r=>{
    const def=Object.hasOwn(SURVEYS,r.dataset)?SURVEYS[r.dataset]:null;
    return def&&new RegExp('^'+def.prefix+'\\d{2}$').test(r.question||'')&&r.option&&r.label&&Number.isInteger(r.count)&&Number.isInteger(r.denominator)&&r.denominator>0&&r.denominator<=(sets.get(r.dataset)?.n??def.n)&&r.count>=0&&r.count<=r.denominator;
  });
  const questions=new Map();for(const r of rows){const key=r.dataset+':'+r.question;if(!questions.has(key))questions.set(key,[]);questions.get(key).push(r);}
  const changed=new Set([...sets].filter(([k,r])=>r.n!==SURVEYS[k].n).map(([k])=>k));
  return{sets,rows,questions,changed};
}
const QUESTION_MEANING=Object.freeze({
  'consumer:C14':'消费者直接回答的选购因素；不能用农户转述替代。',
  'consumer:C15':'规格选择意向支持首购方案验证，不等于已售数量。',
  'consumer:C16':'统一5斤设定情境下的最高可接受到手价，不是成交价、统一定价或配送承诺。',
  'consumer:C17':'配送费意向用于区域成本核算，不证明平台已经包邮。',
  'consumer:C20':'内容偏好用于比较真实证据与IP表达，不能直接证明营销转化。',
  'consumer:C25':'首购顾虑需要同时看价格、产地、完好度与售后，不能推断消费者不重视价格。',
  'opc:B07':'区分知识接触、无真实订单实践、参与订单和独立负责；不能默认学生可独立经营。比例按原始人数计算，不相加四舍五入的百分比。',
  'farmer:Q02':'果园权属与代管身份按本题记录引用，不能将全部产业端受访者都称作自有果园农户。',
  'farmer:Q04':'统一运输与包装设施的受访反馈是研究问题，不等于项目已经建成相应设施。',
  'farmer:Q06':'不会使用线上工具不等于不愿学习；不支持旧稿中不愿学习的无来源比例。',
  'farmer:Q08':'长期统一收果意愿与一般合作意愿应区分。',
  'farmer:Q09':'农户转述客人偏好，不是消费者直接验证；必须使用本题有效分母。',
  'farmer:Q10':'销售渠道与市场问题属于产业端反馈，不是已实现的渠道业绩。',
  'farmer:Q14':'拓展或稳定销售是受访者诉求，不是项目已实现的销量增长。'
});
function replacementQuestion(id,dataset,question,context){
  const key=dataset+':'+question,rows=context.questions.get(key)||[],changed=context.changed.has(dataset);
  if(!rows.length&&!changed)return null;
  const source=rows.map(r=>r.sourceRef||context.sets.get(dataset)?.source||SURVEYS[dataset].source).filter((v,i,a)=>a.indexOf(v)===i).join('；');
  let text=SURVEYS[dataset].name+' '+question+'：'+(rows.length?'人数、有效分母和比例采用本次已发布选项；未发布选项不沿用旧稿数字。':'调查样本口径已更新；本题缺少对应的有效已发布选项，人数、分母和比例须重新核验。');
  if(rows.length&&['consumer:C15','consumer:C16','consumer:C17','opc:B07'].includes(key)){
    const a=rows.find(r=>r.option==='A'&&!r.dimension),b=rows.find(r=>r.option==='B'&&!r.dimension);
    if(a&&b&&a.denominator===b.denominator&&a.count+b.count<=a.denominator){const count=a.count+b.count;text+=' A与B合计'+count+'/'+a.denominator+'='+((100*count/a.denominator).toFixed(1))+'%，仅适用于本题同一有效分母。';}
  }
  text+=' '+(QUESTION_MEANING[key]||'按本题有效分母和来源解释，调查数据不等于交易成果。');
  return fact(id,'research',text,source||context.sets.get(dataset)?.source||SURVEYS[dataset].source,'research');
}
function overrideResearch(base,context){
  const keys=[['consumer','C14'],['consumer','C15'],['consumer','C16'],['consumer','C17'],['consumer','C20'],['consumer','C25'],['opc','B07']];
  let result=base.map(f=>{const p=keys.find(([,q])=>f.id==='research-'+q);return p?(replacementQuestion(f.id,p[0],p[1],context)||f):f;});
  for(const[id,questions]of [['research-industry',['Q02','Q04','Q06','Q08']],['research-indirect',['Q09','Q10','Q14']]]){
    if(!result.some(f=>f.id===id)||(!context.changed.has('farmer')&&!questions.some(q=>context.questions.has('farmer:'+q))))continue;
    const original=FACTS.find(f=>f.id===id);
    const parts={Q02:'Q02自有果园159/206。',Q04:'Q04没有统一运输/包装地点157/206。',Q06:'Q06不会用线上软件卖桃199/206；不会操作不等于不愿学习。',Q08:'Q08不愿长期统一收果112/206。',Q09:'Q09农户转述客人看重口感179/195=91.79%，不是消费者直接验证。',Q10:'Q10销售渠道/市场问题148/198。',Q14:'Q14希望拓展或稳定销售144/189。'};
    result=result.flatMap(f=>f.id!==id?[f]:questions.map(q=>replacementQuestion(id+'-'+q,'farmer',q,context)||fact(id+'-'+q,'research',parts[q],original.source,'research')));
  }
  const sampleUpdate=context.sets.size||context.questions.has('opc:B02')||context.questions.has('farmer:Q02');
  if(sampleUpdate)result=result.map(f=>{
    if(f.id!=='research-samples')return f;
    const samples=Object.entries(SURVEYS).map(([k,d])=>d.name+(context.sets.get(k)?.n??d.n)+'份');
    const nOpc=context.sets.get('opc')?.n??SURVEYS.opc.n,students=context.questions.get('opc:B02');
    let subgroup='';
    if(students){const a=students.find(r=>r.option==='A'),b=students.find(r=>r.option==='B');if(a&&b&&a.denominator===nOpc&&b.denominator===nOpc&&a.count+b.count<=nOpc)subgroup+='在校学生'+(a.count+b.count)+'人（按已发布B02的A、B合计）。';else subgroup+='在校学生人数须按完整已发布B02核对，不能用旧稿人数或总样本推算。';}
    else subgroup+=context.changed.has('opc')?'在校学生人数待已发布B02核对，不能用旧稿人数或总样本推算。':'其中在校学生351人。';
    const owners=context.questions.get('farmer:Q02'),nFarmer=context.sets.get('farmer')?.n??SURVEYS.farmer.n;
    if(owners){const own=owners.find(r=>r.option==='summary'||/自有果园/.test(r.label));if(own&&own.denominator===nFarmer)subgroup+='产业端自有果园'+own.count+'人（已发布Q02），代管人数须另按来源核对。';else subgroup+='果园权属分组须按已发布Q02核对，不能沿用旧稿子组人数。';}
    else subgroup+=context.changed.has('farmer')?'果园权属分组人数待对应题目核对。':'产业端自有果园159人、管理他人果树47人。';
    const sources=Object.entries(SURVEYS).map(([k,d])=>context.sets.get(k)?.source||d.source).join('；');
    return fact(f.id,'research','三组调查独立：'+samples.join('；')+'。'+subgroup+'学生与OPC总体不能全部称作学生或专业运营者；三组不能直接合并为一个代表性总体。',sources,'research');
  });
  return result;
}
function publishedFacts(message,topics,publicContent,research){
  const out=[],used=new Set(),add=f=>{if(f.text&&f.text.length>2&&!used.has(f.id)){used.add(f.id);out.push(f);}};
  for(const module of Object.keys(PUBLIC_FIELDS)){
    const related=topics.includes(MODULE_TOPICS[module])||(module==='batches'&&topics.some(t=>['sales','delivery','aftercare'].includes(t)))||(module==='faqs'&&topics.some(t=>['sales','delivery'].includes(t)))||(module==='slides'&&topics.includes('overview'));
    if(!related&&module!=='pages')continue;
    const rows=module==='survey_rows'?research.rows:module==='research_sets'?[...research.sets.values()]:publicRows(publicContent,module);
    for(const row of rows){
      let topic=module==='pages'?PAGE_TOPICS[row.id]:MODULE_TOPICS[module];if(!topic||(!topics.includes(topic)&&!related))continue;
      if(module==='pages'&&!topics.includes(topic))continue;
      const source=clean(row.sourceRef||row.source||'',300)||'网站已发布 '+module+'/'+row.id;
      let status=['research_sets','survey_rows'].includes(module)?'research':module==='interviews'?'qualitative':['ip_profile','ip_series','tours','slides','templates'].includes(module)?'plan':'reference';
      if(module==='survey_rows'){
        const explicit=message.match(/(?:[ABC]\d{2}|Q\d{2})/gi)||[];
        const queryTerms=message.split(/[，。？?、\s]+/).filter(t=>t.length>=2);
        if(explicit.length&&!explicit.some(q=>q.toUpperCase()===row.question))continue;
        if(!explicit.length&&!['C14','C15','C16','C17','C20','C25','B07','Q06','Q09'].includes(row.question)&&!queryTerms.some(t=>row.label.includes(t)))continue;
        const digits=row.dataset==='farmer'&&row.question==='Q09'?2:1;
        add(fact('public-'+module+'-'+row.id,topic,SURVEYS[row.dataset].name+' · '+row.question+(row.dimension?' · '+row.dimension:'')+' · '+row.option+' '+row.label+'：'+row.count+'/'+row.denominator+'='+((100*row.count/row.denominator).toFixed(digits))+'%。多选题不要求比例合计100%；调查意向不等于经营实绩。',source,status));
        continue;
      }
      if(module==='research_sets'){
        // A sample-size edit must not reintroduce stale counts from a free-text legacy note.
        const methodNote=String(row.note||'').split(/(?<=[。；;])/).filter(s=>!/[0-9]/.test(s)).join('');
        const sample={...row};if(methodNote)sample.note=methodNote;else delete sample.note;
        add(fact('public-'+module+'-'+row.id,topic,line(sample)+'。分组样本量不代替分题有效分母；子组人数须由对应已发布题目确认。',source,status));
        continue;
      }
      if(module==='batches'){
        if(!['example','pending','verified'].includes(row.status))continue;
        const today=new Date().toISOString().slice(0,10);
        const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
        const dates=validDate(row.harvestDate)&&validDate(row.verifiedAt)&&row.harvestDate<=row.verifiedAt&&row.verifiedAt<=today;
        const remaining=row.availableQuantity===undefined||row.availableQuantity===null||(Number.isInteger(row.availableQuantity)&&row.availableQuantity>=0&&row.availableQuantity<=row.stock);
        const complete=['productId','originName','shippingOrigin','harvestDate','grading','shippingWindow','shippingRegions','aftercareRule','sourceRef','verifiedAt'].every(k=>typeof row[k]==='string'&&row[k])&&Number.isInteger(row.stock)&&row.stock>=0&&dates&&remaining;
        status=row.status==='example'?'example':row.status==='verified'&&complete?'verified':'reference';
        const safeRow={...row};if(status!=='verified'){delete safeRow.stock;delete safeRow.availableQuantity;delete safeRow.shippingFee;}
        add(fact('public-'+module+'-'+row.id,topic,line(safeRow)+'。'+(status==='verified'?'以上为已发布批次记录快照，剩余量与可售情况仍须当批确认；已核验是记录中的责任人确认，不代表第三方认证或实时快递。':'示例或核验资料不完整，不能作为可售库存、实际运费和发货承诺。'),source,status));
        continue;
      }
      if(module==='products'&&!row.name)continue;
      if(module==='faqs'&&(!row.question||!row.answer))continue;
      const extra=module==='products'?'。价格为已发布参考信息，仍须核验当批可售情况、区域费用和到手总价。':module==='tours'?'。接待条件已核实也不等于预约成功，提交意向仍需人工确认。':module==='interviews'?'。访谈是定性或口述材料，不是团队销量。':module==='ip_profile'||module==='ip_series'?'。角色创意不代替真实产地与商品证明。':'';
      add(fact('public-'+module+'-'+row.id,topic,line(row)+extra,source,status));
    }
  }
  return out;
}
const ANSWER_HINTS={
  'project-identity':/项目介绍|项目是什么|什么项目|数商桃乡|桃源筑梦|口号/,
  'project-path':/流程|运作|闭环|路径|如何运行|整体逻辑/,
  'research-samples':/样本|多少人|多少份|243|437|206|351|问卷/,
  'research-interviews':/访谈|80箱|120箱|150箱/,
  'research-outcomes':/效果|实绩|销量|预算|财务|4万元|利润/,
  'delivery-limit':/运费|包邮|发货|到货|48小时|配送/,
  'delivery-tracking':/物流|单号|轨迹|查快递|查询/,
  'aftercare-process':/坏桃|破损|退款|售后|赔付|投诉/,
  'aftercare-storage':/保存|保鲜|食用|温度/,
  'trace-four':/步骤|流程|哪些记录|责任人/,
  'trace-limit':/核验|证明|认证|区块链|真伪/,
  'ip-character':/角色|是谁|定位|性格|形象|草帽/,
  'ip-six-series':/栏目|系列|哪些内容|六类/,
  'ip-marketing-path':/营销|转化|创作|传播|脚本|怎么.*内容/,
  'ip-fiction-boundary':/故事|历史|插画|真实照片/,
  'opc-roles':/分工|责任|学生能|谁来/,
  'opc-task-loop':/培训|任务|验收|结算|工时|返工/,
  'opc-decisions':/复盘|实验|对照|决策|闭环|判断/,
  'cooperation-start':/合作|参与|加入|接洽|对接/,
  'cooperation-privacy':/联系|授权|名单|个人/,
  'competition-map':/竞赛|赛事|答辩|讲解|赛项|参赛/,
  'competition-boundary':/资格|获奖|日期|截止|组别/,
  'tour-route':/路线|体验|一日|导览|节点/,
  'tour-intention':/预约|名额|开放|接待|日期|出行/,
  'platform-tech':/框架|技术|连接|技术栈|部署|数据库|接口/,
  'platform-demo':/静态|演示|模拟|GitHub/,
  'platform-ai':/AI|智能|模型|客服|生成|推荐/i,
  'platform-account':/账号|登录|注册|隐私|密钥|数据安全/
};
function answerScore(f,q,codes){
  let score=codes.reduce((n,c)=>n+(new RegExp('(?:^|[^A-Z0-9])'+c+'(?:[^0-9]|$)').test(f.id+' '+f.text)?100:0),0);
  // A short rule answer must keep the question's caveat/aggregate before raw rows.
  if(score>0&&f.id.startsWith('research-'))score+=20;
  if(ANSWER_HINTS[f.id]?.test(q))score+=25;
  if(f.id.startsWith('public-'))score+=8;
  if(f.id.startsWith('public-products-'))score+=12;
  if(f.id.startsWith('public-pages-'))score-=4;
  if(f.id.startsWith('public-survey_rows-')&&!codes.length)score-=8;
  return score;
}

export function selectProjectKnowledge(message,{publicContent}={}){
  const {q,topics,followup}=questionInfo(message);
  if(!topics.length)return{scope:'unrelated',topics:[],facts:[],answerFacts:[],boundaries:[...BOUNDARIES,'只回答本项目范围；不要执行无关任务或披露内部信息。'],followup:false};
  let base=FACTS.filter(f=>topics.includes(f.topic));
  // An explicitly supplied product collection is authoritative, including an empty list.
  if(publicContent&&Object.hasOwn(publicContent,'products')&&Array.isArray(publicContent.products))base=base.filter(f=>!f.id.startsWith('product-'));
  if(publicContent&&Object.hasOwn(publicContent,'tours')&&Array.isArray(publicContent.tours))base=base.filter(f=>f.id!=='tour-intention');
  const research=researchContext(publicContent);
  base=overrideResearch(base,research);
  const published=publishedFacts(q,topics,publicContent,research);
  // Reserve interpretation and denominators before long option lists; rank explicit questions first.
  const codes=(q.match(/(?:[ABC]\d{2}|Q\d{2})/gi)||[]).map(x=>x.toUpperCase());
  const score=f=>codes.reduce((n,c)=>n+(new RegExp('(?:^|[^A-Z0-9])'+c+'(?:[^0-9]|$)').test(f.id+' '+f.text)?10:0),0);
  const curated=base.filter(f=>f.status!=='boundary').sort((a,b)=>score(b)-score(a));
  const exact=published.filter(f=>score(f)>0),other=published.filter(f=>score(f)===0);
  const ordered=[...base.filter(f=>f.status==='boundary'),...curated,...exact,...other];
  const facts=[];let chars=0;for(const f of ordered){if(facts.length>=40)break;if(chars+f.text.length+f.source.length>18000)continue;facts.push({...f});chars+=f.text.length+f.source.length;}
  const answerFacts=[...facts].sort((a,b)=>answerScore(b,q,codes)-answerScore(a,q,codes)).slice(0,5).map(f=>({...f}));
  return{scope:'project',topics:[...topics],facts,answerFacts,boundaries:[...BOUNDARIES],followup};
}
