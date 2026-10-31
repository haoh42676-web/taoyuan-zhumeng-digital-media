'use strict';
window.PeachDigitalAdmin=(()=>{
  let data={},config=null,selected=null;
  const labels={pending:'待确认',confirmed:'已确认 · 未付款',paid:'收款已核实',shipped:'已发货',completed:'已完成',cancelled:'已取消',approved:'已通过',rejected:'未通过',assigned:'待完成',submitted:'待审核',changes_requested:'需修改'};
  const money=v=>'¥'+Number(v||0).toFixed(2);
  const tag=o=>`<span class="pill">${o.simulation?'演示 · ':''}${esc(labels[o.status]||o.status)}</span>`;
  const btn=(s,a,v='',c='small')=>button(s,'dm-'+a,v,c);
  const field=(label,name,value='',type='text',extra='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const area=(label,name,value='',rows=3)=>`<label class="dm-wide">${esc(label)}<textarea name="${name}" rows="${rows}" required>${esc(value)}</textarea></label>`;
  const error='<p class="form-error dm-wide" role="alert" hidden></p>';
  const form=(type,body,label='保存更改')=>`<form data-form="dm-${type}" class="dm-form">${body}${error}<div class="dm-wide dm-actions"><button class="primary" type="submit">${label}</button></div></form>`;
  const tabs=(items,current)=>`<nav class="dm-tabs" aria-label="当前分类">${items.map(([id,name])=>`<a href="#digital/${id}" ${id===current?'aria-current="page"':''}>${name}</a>`).join('')}</nav>`;
  async function site(){return config=await api('/admin/digital/site');}
  async function saveConfig(){config=await api('/admin/digital/site',{method:'PUT',body:config});}
  async function page(route){
    const part=route.split('/')[1]||'overview';
    if(part==='overview'){
      const d=await api('/admin/digital/overview');
      return heading('今天，先做好这三件事。','确认订单，更新桃乡照片，带伙伴完成推广任务。',btn('刷新','refresh','','primary'))+
        `<div class="stats">${stat('待确认 / 待付款订单',d.orders.pending,'提交订单尚未付款')}${stat('待回复售后',d.orders.openClaims,'在订单中回复，顾客可查看')}${stat('待审核报名',d.applications.pending,'通过后开放培训与工作台')}${stat('待审核作品',d.tasks.submitted,'审核通过后另行发布')}</div>`+
        `<div class="dm-start panel"><img src="/assets/ip-actions/guide.webp" alt="小桃满"><div><h2>商品事实 → 下单履约 → 推广内容</h2><p>${esc(d.notice)}</p><div class="dm-actions"><a class="primary" href="#digital/orders">处理网站订单</a><a class="small" href="#digital/members">审核成员与任务</a><a class="small" href="#digital/content">更新桃乡见闻</a></div></div></div>`+
        `<section class="panel"><h2>经营记录</h2><div class="settings-values"><div><small>已核实真实收款</small><b>${money(d.orders.realRevenue)}</b></div><div><small>真实已付款订单</small><b>${d.orders.realPaid}</b></div><div><small>订单</small><b>${d.orders.simulated}</b></div><div><small>已通过推广成员</small><b>${d.applications.approved}</b></div></div><p class="muted">订单独立标记，不计入真实收款。没有实际记录时显示 0。</p></section>`;
    }
    if(part==='orders'){
      data.orders=await api('/admin/digital/orders');
      return heading('网站订单','核对当批供应后确认，凭收款依据登记付款，再登记快递信息。',btn('刷新','refresh','','primary'))+tabs([['orders','网站订单'],['products','商品与库存']],part)+`<section class="panel">${table(['订单 / 时间','商品','金额','状态','操作'],data.orders.map(o=>[`${esc(o.id)}<small>${time(o.createdAt)}</small>`,`${esc(o.product.name)} × ${o.quantity}`,money(o.total),tag(o),btn('查看与处理','order',o.id)]))}</section>`;
    }
    if(part==='products'){
      data.products=await api('/admin/digital/products');
      return heading('商品与库存','所有商品价格、配送规则、库存与开放状态在这里管理。',btn('新增商品','new-product','','primary'))+tabs([['orders','网站订单'],['products','商品与库存']],part)+`<section class="panel"><p class="notice-box">默认方案商品仅可提交订单。开放实际销售前，须填全当批核验依据。</p>${table(['商品','规格与金额','库存 / 已保留','销售状态','操作'],data.products.map(p=>[`${esc(p.name)}<small>${esc(p.id)}</small>`,`${esc(p.weight)} · ${money(p.price)}<small>每单配送 ${money(p.shippingFee)}</small>`,`${p.stock} / ${p.reserved}`,p.active?(p.realEnabled?'实际销售':'选购'):'已隐藏',btn('编辑','product',p.id)+' '+btn('文案草稿','copy-product',p.id)]))}</section>`;
    }
    if(part==='content'){
      await site();
      return heading('照片与内容','首页和桃乡见闻使用同一份照片资料。保持原图色彩，只描述已核实的事实。',btn('添加照片','new-photo','','primary'))+`<div class="dm-gallery">${config.gallery.map(p=>`<article class="panel"><img src="/${esc(p.image.replace(/^\//,''))}" alt="${esc(p.title)}" loading="lazy"><div><small>${esc(p.category)}</small><h2>${esc(p.title)}</h2><p>${esc(p.caption)}</p>${btn('编辑照片说明','photo',p.id)} ${btn('前移','photo-up',p.id)} ${btn('后移','photo-down',p.id)} ${btn('移出展示','remove-photo',p.id)}</div></article>`).join('')}</div><section class="panel"><h2>更多素材</h2><p>上传照片后，将素材路径选入照片条目；公开照片请核对授权和说明。</p><a class="small" href="#media">打开素材库</a> <a class="small" href="#drafts">打开内容审核</a></section>`;
    }
    if(part==='members'||part==='tasks'){
      [data.applications,data.tasks]=await Promise.all([api('/admin/digital/applications'),api('/admin/digital/tasks')]);
      const body=part==='members'?table(['申请人 / 地区','申请时间','状态','基础培训','操作'],data.applications.map(a=>[`${esc(a.name)}<small>${esc(a.area)}</small>`,time(a.createdAt),tag(a),`${a.completedLessons?.length??a.trainingCompleted??0} / ${a.trainingTotal??2}`,btn('审核申请','application',a.id)])):
        table(['任务 / 成员','截止','状态','操作'],data.tasks.map(t=>[`${esc(t.title)}<small>${esc(t.memberName)}</small>`,esc(t.dueAt||'未约定'),tag(t),btn('查看成果','task',t.id)]));
      return heading('推广成员','报名审核 → 基础培训 → 派发任务 → 提交成果 → 管理员审核。成员不拥有管理权限。',btn('派发新任务','new-task','','primary'))+tabs([['members','报名与成员'],['tasks','推广任务'],['training','基础培训']],part)+`<section class="panel">${body}</section>`;
    }
    if(part==='training'){
      await site();
      return heading('基础培训','维护事实核对、素材使用与隐私保护课程。全部课程通过后才能派发任务。',btn('新增课程','new-lesson','','primary'))+tabs([['members','报名与成员'],['tasks','推广任务'],['training','基础培训']],part)+`<section class="panel">${table(['课程','内容','测验','操作'],config.training.map(l=>[esc(l.title),esc(l.body.slice(0,85))+'…',l.questions.length+' 题',btn('编辑课程','lesson',l.id)]))}</section>`;
    }
    if(part==='settings'){
      await site();const s=config.site;
      return heading('网站设置','保存后在前台生效。只在这里维护数字媒体赛副本。')+`<section class="panel">${form('site',field('网站名称','name',s.name,'text','required maxlength="60"')+field('标语','slogan',s.slogan,'text','required maxlength="80"')+area('首页项目说明','intro',s.intro)+area('加入我们说明','joinIntro',s.joinIntro)+area('下单与配送提示','shippingNote',s.shippingNote)+area('通用售后说明','aftercare',s.aftercare))}</section><section class="panel"><h2>系统管理</h2><p>账号与运行维护在二级工具中管理。</p><div class="dm-actions"><a href="#users" class="small">唯一管理员</a><a href="#system" class="small">备份与运行</a><a href="#audit" class="small">操作记录</a></div></section>`;
    }
    throw Error('此分类不存在');
  }
  function productEditor(p){
    selected=p||{id:'',version:0,name:'',subtitle:'',weight:'',grade:'',origin:'',price:0,shippingFee:0,stock:0,image:'assets/web/fact-crisp-a1.webp',description:'',dispatch:'',regions:'',aftercare:'',batchCode:'',realEnabled:false,evidence:'',active:true};
    const x=selected;modal(p?'编辑商品':'新增商品',form('product',field('商品编号','id',x.id,'text',`required pattern="[a-zA-Z0-9_-]{1,80}" ${p?'readonly':''}`)+field('商品名称','name',x.name,'text','required maxlength="80"')+field('一句话说明','subtitle',x.subtitle)+field('重量规格','weight',x.weight,'text','required')+field('等级','grade',x.grade,'text','required')+field('产地','origin',x.origin,'text','required')+field('单价（元）','price',x.price,'number','required min="0" step="0.01"')+field('每单配送费（元）','shippingFee',x.shippingFee,'number','required min="0" step="0.01"')+field('当批总库存（箱）','stock',x.stock,'number','required min="0" step="1"')+field('商品图片路径','image',x.image,'text','required')+field('批次编号','batchCode',x.batchCode)+area('商品介绍','description',x.description)+area('发货安排','dispatch',x.dispatch)+area('配送地区','regions',x.regions)+area('售后规则','aftercare',x.aftercare)+area('价格、库存与批次核验依据','evidence',x.evidence)+`<label class="dm-check"><input type="checkbox" name="active" ${x.active?'checked':''}>在网站展示</label><label class="dm-check"><input type="checkbox" name="realEnabled" ${x.realEnabled?'checked':''}>开放实际销售（须先核实以上信息）</label>`));
  }
  function orderEditor(o){
    selected=o;const r=o.recipient;
    const choices={pending:[['confirm','确认当批供应'],['paid',o.simulation?'确认付款':'核实已收款'],['cancel','取消未付款订单']],confirmed:[['paid',o.simulation?'确认付款':'核实已收款'],['cancel','取消未付款订单']],paid:[['ship','登记发货']],shipped:[['complete','确认完成']]};
    const actions=choices[o.status]||[];
    modal('订单 '+o.id,`<p>${tag(o)} ${esc(o.notice)}</p><section class="panel"><h3>${esc(o.product.name)} × ${o.quantity}</h3><p>${esc(o.product.weight)} · ${esc(o.product.grade)} · ${esc(o.product.origin)}</p><p>商品 ${money(o.unitPrice*o.quantity)} + 配送 ${money(o.shippingFee)} = <b>${money(o.total)}</b></p><p>${esc(r.name)} · ${esc(r.phone)}<br>${esc(r.region)} ${esc(r.address)}</p><p>顾客备注：${esc(o.note||'无')}</p>${o.tracking?`<p>物流：${esc(o.carrier)} · ${esc(o.tracking)}</p>`:''}</section>`+
      (actions.length?form('order',`<label>下一步<select name="action">${actions.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>${field('实收金额（元，核实付款时填写）','paidAmount',o.total,'number','min="0" step="0.01"')}${field('收款凭据编号（真实付款必填）','paymentReference')}${field('快递公司（发货时必填）','carrier')}${field('运单号（发货时必填）','tracking')}${area('处理说明','note','',2).replace('required','')}`,'保存处理记录'):'')+
      `<h3>售后反馈</h3>${o.claims?.length?o.claims.map(c=>`<section class="panel"><p>${esc(c.message)}</p><p class="muted">${time(c.createdAt)} · ${c.status==='resolved'?'已处理':'待处理'}</p>${c.reply?`<p>回复：${esc(c.reply)}</p>`:''}${btn('回复 / 更新','claim',c.id)}</section>`).join(''):'<p class="muted">暂无售后反馈。</p>'}<details><summary>查看订单状态记录</summary>${o.history.map(h=>`<p>${time(h.at)} · ${esc(h.note)}</p>`).join('')}</details>`);
  }
  function photoEditor(p){
    selected=p||null;
    const categories=[['orchard','桃园风景'],['harvest','采摘日常'],['sorting','分拣装箱'],['market','桃乡市集'],['fruit','桃子特写']];
    const category=p?.category || 'orchard';
    const legacy=categories.some(([key])=>key===category)?'':`<option value="${esc(category)}" selected>原分类：${esc(category)}（保留）</option>`;
    const categoryField=`<label>分类<select name="category" required>${legacy}${categories.map(([key,label])=>`<option value="${key}" ${key===category?'selected':''}>${label}</option>`).join('')}</select></label>`;
    modal(p?'编辑照片':'添加照片',form('photo',field('照片编号','id',p?.id||'','text',`required pattern="[a-zA-Z0-9_-]{1,60}" ${p?'readonly':''}`)+field('标题','title',p?.title||'','text','required')+categoryField+field('图片路径','image',p?.image||'assets/orchard/orchard-hills.webp','text','required')+area('真实照片说明','caption',p?.caption||''))+`<p class="muted">素材路径可从<a href="#media" data-action="dm-open-media">素材库</a>复制。不得填入私有资料路径。</p>`);
  }
  function lessonEditor(l){selected=l||{id:'',title:'',body:'',questions:[{question:'',options:['',''],answer:0}]};const x=selected;modal('编辑培训课程',form('lesson',field('课程编号','id',x.id,'text',`required pattern="[a-zA-Z0-9_-]{1,50}" ${l?'readonly':''}`)+field('课程名称','title',x.title,'text','required')+area('课程正文','body',x.body,7)+x.questions.map((q,i)=>`<fieldset class="dm-wide"><legend>测验 ${i+1}</legend>${field('题目','q'+i,q.question,'text','required')}${q.options.map((v,j)=>field('选项 '+(j+1),`q${i}o${j}`,v,'text','required')).join('')}<label>正确选项<select name="a${i}">${q.options.map((_,j)=>`<option value="${j}" ${q.answer===j?'selected':''}>选项 ${j+1}</option>`).join('')}</select></label></fieldset>`).join('')));}
  async function action(name,value){
    if(!name.startsWith('dm-'))return false;const a=name.slice(3);
    if(a==='open-media'){closeModal();location.hash='media';return true;}
    if(a==='refresh'){await load();return true;}
    if(a==='product'||a==='new-product'){productEditor(data.products.find(p=>p.id===value));return true;}
    if(a==='copy-product'){const p=data.products.find(x=>x.id===value),text=`${p.name} · ${p.weight}\n${p.subtitle}\n产地：${p.origin}\n等级：${p.grade}\n单价：${money(p.price)}，每单配送：${money(p.shippingFee)}\n发货：${p.dispatch}\n配送地区：${p.regions}\n售后：${p.aftercare}\n${p.realEnabled?'订单提交后尚未付款，须核对当批供应与配送安排。':'方案商品；订单提交后按实际状态跟进。'}`;modal('基于商品事实的文案草稿',`<p class=notice-box>规则辅助生成，可复制后核对并写入商品介绍；不自动发布。</p><textarea rows=14 readonly>${esc(text)}</textarea>`+button('复制草稿','copy',text));return true;}
    if(a==='order'){orderEditor(await api('/admin/digital/orders/'+value));return true;}
    if(a==='claim'){const o=selected,c=o.claims.find(c=>c.id===value);selected={order:o,claim:c};modal('回复售后反馈',`<p>${esc(c.message)}</p>`+form('claim',area('回复内容','reply',c.reply)+`<label>处理状态<select name="status"><option value="resolved">已处理</option><option value="pending">继续跟进</option></select></label>`,'保存回复'));return true;}
    if(a==='photo'||a==='new-photo'){photoEditor(config.gallery.find(p=>p.id===value));return true;}
    if(a==='photo-up'||a==='photo-down'){const from=config.gallery.findIndex(p=>p.id===value),to=from+(a==='photo-up'?-1:1);if(to<0||to>=config.gallery.length){notice('已经在这一端。');return true;}[config.gallery[from],config.gallery[to]]=[config.gallery[to],config.gallery[from]];await saveConfig();await load();return true;}
    if(a==='remove-photo'){config.gallery=config.gallery.filter(p=>p.id!==value);await saveConfig();await load();notice('照片已移出展示，原文件保留。');return true;}
    if(a==='lesson'||a==='new-lesson'){lessonEditor(config.training.find(l=>l.id===value));return true;}
    if(a==='application'){selected=data.applications.find(a=>a.id===value);const x=selected;modal('审核推广报名',`<section class="panel"><h3>${esc(x.name)} · ${esc(x.area)}</h3><p>联系：${esc(x.phone)}</p><p>技能：${esc(x.skills)}</p><p>加入理由：${esc(x.motivation)}</p>${tag(x)}</section>`+form('application',`<label>审核结论<select name="status"><option value="approved">通过，开放成员培训与工作台</option><option value="rejected">暂未通过，可重新申请</option></select></label>${area('审核意见','reviewNote',x.reviewNote||'')}`,'保存审核结论'));return true;}
    if(a==='new-task'){data.applications=await api('/admin/digital/applications');const rows=data.applications.filter(a=>a.status==='approved');if(!rows.length)throw Error('请先审核通过至少一名推广成员，再完成培训。');modal('派发推广任务',form('task',`<label>选择成员<select name="accountId">${rows.map(a=>`<option value="${esc(a.accountId)}">${esc(a.name)} · ${esc(a.area)} · ${esc(a.id.slice(-8))}</option>`).join('')}</select></label><label>任务类型<select name="type"><option value="copy">商品文案</option><option value="photo">图片整理</option><option value="script">短视频脚本</option></select></label>${field('任务名称','title','','text','required')}${field('截止日期','dueAt','','date')}${area('具体要求与验收标准（勿填写客户隐私）','brief','')}${field('报酬与结算约定','reward','尚未约定，以实际审核与另行约定为准')}`,'派发任务'));return true;}
    if(a==='task'){selected=data.tasks.find(t=>t.id===value);const t=selected;modal(t.title,`<p>${tag(t)} · ${esc(t.memberName)}</p><p class="dm-pre">${esc(t.brief)}</p><p>约定：${esc(t.reward)}</p><h3>成员提交内容</h3><div class="dm-pre panel">${esc(t.submission?.text||'尚未提交')}</div>${(t.submission?.links||[]).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">查看作品链接 ↗</a>`).join(' ')}${t.reviewNote?`<p>审核意见：${esc(t.reviewNote)}</p>`:''}`+(t.status==='submitted'?form('task-review',`<label>审核结果<select name="status"><option value="approved">通过验收（发布与结算另行确认）</option><option value="changes_requested">退回修改</option></select></label>${area('审核意见','reviewNote','')}`,'保存审核结果'):''));return true;}
    throw Error('未识别此管理操作');
  }
  async function submit(formEl){
    if(!formEl.dataset.form?.startsWith('dm-'))return false;const type=formEl.dataset.form.slice(3),v=Object.fromEntries(new FormData(formEl));
    if(type==='site'){config.site=v;await saveConfig();notice('网站说明已更新。');await load();return true;}
    if(type==='product'){const{id,...body}=v;for(const k of ['price','shippingFee','stock'])body[k]=Number(body[k]);body.active=formEl.elements.active.checked;body.realEnabled=formEl.elements.realEnabled.checked;body.version=selected.version;await api('/admin/digital/products/'+id,{method:'PUT',body});}
    if(type==='order'){const body={...v,version:selected.version};if(!body.paidAmount)delete body.paidAmount;else body.paidAmount=Number(body.paidAmount);await api('/admin/digital/orders/'+selected.id+'/action',{method:'POST',body});}
    if(type==='claim')await api('/admin/digital/orders/'+selected.order.id+'/claims/'+selected.claim.id,{method:'POST',body:{...v,version:selected.order.version}});
    if(type==='photo'){if(selected)config.gallery=config.gallery.map(p=>p.id===selected.id?v:p);else config.gallery.push(v);await saveConfig();}
    if(type==='lesson'){const questions=selected.questions.map((q,i)=>({question:v['q'+i],options:q.options.map((_,j)=>v[`q${i}o${j}`]),answer:Number(v['a'+i])})),next={id:v.id,title:v.title,body:v.body,questions};const index=config.training.findIndex(l=>l.id===next.id);if(index>=0)config.training[index]=next;else config.training.push(next);await saveConfig();}
    if(type==='application')await api('/admin/digital/applications/'+selected.id+'/review',{method:'POST',body:{...v,version:selected.version}});
    if(type==='task')await api('/admin/digital/tasks',{method:'POST',body:v});
    if(type==='task-review')await api('/admin/digital/tasks/'+selected.id+'/review',{method:'POST',body:{...v,version:selected.version}});
    closeModal();await load();notice('已保存，相关用户可查看更新。');return true;
  }
  return{page,action,submit};
})();
