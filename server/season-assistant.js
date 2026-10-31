import {readFile} from 'node:fs/promises';
import {classifyProjectMessage} from '../project-knowledge.js';
const data=JSON.parse(await readFile(new URL('../cloud/seed.json',import.meta.url),'utf8'));
// Use the same public facts as server-side plan pricing. No visitor records enter prompts.
export function seasonAnswer(message){
 const q=String(message||''),classification=classifyProjectMessage(q);
 if(classification.kind==='privacy')return null;
 let answer,intent='project';
 if(/物流|快递|运单|订单.*(?:哪里|状态)|退款|赔付|售后|破损|缺重|联系|反馈/.test(q)){
  intent='handoff';answer='请在“我的桃园 → 服务与探园”选择关联记录和问题类型，果园的回复与处理进度会回到同一页面。商城订单请从商城对应订单提交反馈。小桃满不能查询私人物流，也不能承诺赔付或退款。';
 }else if(/礼|送|赠|心意|领取/.test(q)){
  const p=data.plans.find(p=>p.id==='gift');answer=p.name+'方案为'+p.price+'元，含'+p.weight+p.unit+'礼盒装鲜桃及电子心意卡。在“寄份心意”填写称呼和祝福，生成领取链接；领取后，双方可在“我的桃园”查看状态。生成礼卡不代表已付款或已确认配送，实际权益须由企业确认。';
 }else if(/时间|收到|什么时候|几月|配送|运费|发货/.test(q)){
  answer=data.plans.map(p=>p.name+'：'+p.delivery+'；'+p.shipping+'。').join(' ')+'以上均为2027桃季方案，实际批次、物候、地区与配送条款须经企业确认，不承诺具体到货日期。';
 }else if(/方案|选择|价格|多少|认养|家庭|尝鲜|预算|云养/.test(q)){
  answer=data.plans.map(p=>p.name+'：'+p.price+'元，'+p.weight+p.unit+'，含'+p.rights.join('、')+'。').join(' ')+'以上均为2027桃季方案，方案报价含广东省内包装与配送；意向与预订须按付款、履约和签收状态分别确认，不直接等同已完成交易。';
 }else if(/成长|桃园|物候|记录|收藏|愿望/.test(q)){
  answer='在“四季桃园”查看六站物候、前期实拍与成长手记，可以收藏节点、记录观察或写下愿望，再到“我的桃园”查看参与记录。实拍反映拍摄时的场景，2027年成长管护内容按季节计划接续，不作为实时果园监控。';
 }else return null;
 return {intent,answer,provider:'rules',label:'小桃满 · 本站公开资料',sources:[{title:'桃园云养当前公开方案与服务流程',ref:'cloud/seed.json · '+data.season}],modelUsed:false};
}
