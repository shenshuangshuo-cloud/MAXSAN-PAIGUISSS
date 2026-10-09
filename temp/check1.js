
const CONTAINER_TYPES={
'40HQ':{key:'40HQ',name:'40HQ常温大柜',maxVol:65,maxWeight:26000,temp:'常温'},
'40RF':{key:'40RF',name:'40RF冷冻大柜',maxVol:50,maxWeight:22000,temp:'冷冻'},
'20GP':{key:'20GP',name:'20GP常温小柜',maxVol:26,maxWeight:17000,temp:'常温'},
'20RF':{key:'20RF',name:'20RF冷冻小柜',maxVol:20,maxWeight:17000,temp:'冷冻'}};
const LARGE_TYPE={'常温':'40HQ','冷冻':'40RF'},SMALL_TYPE={'常温':'20GP','冷冻':'20RF'};
const MASTER_FIELDS=['物料编码','物料名称','大类','厂家','温度属性','单箱体积','单箱净重','单箱毛重','唛头','海关编码','货物描述','单位','包装单位','关单'];
const ORDER_FIELDS=['物料编码','箱数'];
const CONVERSION_FIELDS=['物料编码','转换数量','说明'];
const RESULT_HEADERS=['序号','大类','物料编码','物料名称','厂家','温度属性','确认数量','包装数量','单箱体积(CBM)','总体积(CBM)','单箱净重(KG)','总净重(KG)','单箱毛重(KG)','总毛重(KG)','柜型','体积利用率','重量利用率','备注','柜号'];
const ALIAS={
'物料编码':'物料编码','物料编号':'物料编码','编码':'物料编码','料号':'物料编码','物料号':'物料编码','SKU':'物料编码','sku':'物料编码','code':'物料编码',
'物料名称':'物料名称','物料':'物料名称','品名':'物料名称','名称':'物料名称','name':'物料名称',
'大类':'大类','类别':'大类','分类':'大类','category':'大类','厂家':'厂家','厂商':'厂家','供应商':'厂家','factory':'厂家',
'温度属性':'温度属性','温度':'温度属性','温区':'温度属性','temp':'温度属性',
'箱数':'箱数','件数':'箱数','数量':'箱数','boxes':'箱数','确认数量':'箱数','确认数':'箱数','单箱体积':'单箱体积','单箱体积(CBM)':'单箱体积','单箱体积（CBM）':'单箱体积','单箱CBM':'单箱体积','CBM':'单箱体积','体积':'单箱体积','perVol':'单箱体积',
'单箱净重':'单箱净重','单箱净重(KG)':'单箱净重','单箱净重（KG）':'单箱净重','净重':'单箱净重','perNet':'单箱净重',
'单箱毛重':'单箱毛重','单箱毛重(KG)':'单箱毛重','单箱毛重（KG）':'单箱毛重','毛重':'单箱毛重','perWeight':'单箱毛重',
'唛头':'唛头','MARK':'唛头','mark':'唛头','shippingmark':'唛头','ShippingMark':'唛头',
'海关编码':'海关编码','HSCODE':'海关编码','HScode':'海关编码','HS编码':'海关编码','海关编码(HSCODE)':'海关编码',
'货物描述':'货物描述','描述':'货物描述','DESCRIPTION':'货物描述','description':'货物描述',
'单位':'单位','UNIT':'单位','unit':'单位',
'包装单位':'包装单位','PACKINGUNIT':'包装单位','packingunit':'包装单位',
'关单':'关单','关单号':'关单','报关单号':'关单'};
const $=id=>document.getElementById(id);
const SHARED_MASTER=[];//内嵌共享默认资料库数据：分发文件给他人时，首次打开自动载入并留存到本地；空数组则不干预
let master=[],orders=[],conversions=[],orderNo='',currentResult=null,modalMode='order';

function num(v){const n=parseFloat(String(v??'').replace(/[^\d.\-]/g,''));return isNaN(n)?0:n}
function rnd(v,d=2){return Math.round(v*10**d)/10**d}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function normalizeTemp(v){return /冻|冷藏|冷/.test(String(v))?'冷冻':'常温'}
function csvParse(text){
let out=[],row=[],cur='',q=false;
for(let i=0;i<text.length;i++){let c=text[i];
if(q){if(c=='"'){if(text[i+1]=='"'){cur+='"';i++}else q=false}else cur+=c}
else if(c=='"')q=true;else if(c==','||c=='\t'){row.push(cur);cur=''}
else if(c=='\n'||c=='\r'){if(c=='\r'&&text[i+1]=='\n')i++;row.push(cur);cur='';if(row.some(x=>String(x).trim()))out.push(row);row=[]}
else cur+=c}
if(cur!==''||row.length){row.push(cur);if(row.some(x=>String(x).trim()))out.push(row)}
return out}
function decodeUtf8(bytes){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  catch(e){return null}
}
function decodeGbk(bytes){
  try{return new TextDecoder('gb18030',{fatal:false}).decode(bytes)}
  catch(e){return null}
}
function looksLikeGarbage(text){
  if(!text)return true;
  const bad=(text.match(/�/g)||[]).length;
  const moj=(text.match(/[\u00C0-\u00FF]/g)||[]).length;
  return bad>0 || moj>Math.max(5, text.length*0.02);
}
async function readCsvFile(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  // UTF-8 BOM
  if(bytes.length>=3 && bytes[0]===0xEF && bytes[1]===0xBB && bytes[2]===0xBF){
    return new TextDecoder('utf-8').decode(bytes);
  }
  // First try strict UTF-8, then GB18030 for common Excel/Windows Chinese CSVs.
  const utf=decodeUtf8(bytes);
  if(utf && !looksLikeGarbage(utf)) return utf;
  const gb=decodeGbk(bytes);
  if(gb) return gb;
  if(utf) return utf;
  throw new Error('无法识别文件编码');
}
function normalizeHeader(h){
  return String(h??'').replace(/^\uFEFF/,'').trim()
    .replace(/[\s]/g,'')
    .replace(/（/g,'(').replace(/）/g,')')
    .replace(/ＣＢＭ/gi,'CBM').replace(/ＫＧ/gi,'KG');
}
function mapRows(grid,fields){
if(!grid.length)return[];
let keys=grid[0].map(h=>{
  const raw=normalizeHeader(h);
  return ALIAS[raw]||ALIAS[raw.toLowerCase()]||null;
});
let has=keys.filter(Boolean).length>=2;
let data=has?grid.slice(1):grid, final=has?keys:fields;
return data.map(r=>{let o={};final.forEach((k,i)=>{if(k)o[k]=String(r[i]??'').trim()});return o})
}
function saveMaster(){localStorage.setItem('paigui_master_v2',JSON.stringify(master));schedulePush()}
function saveMasterLocal(){localStorage.setItem('paigui_master_v2',JSON.stringify(master))}
function loadMaster(){try{master=JSON.parse(localStorage.getItem('paigui_master_v2')||'[]')}catch(e){master=[]};if(!master.length&&SHARED_MASTER.length){master=SHARED_MASTER.map(x=>({...x}));saveMasterLocal()}}
// ===== 云端同步（多人共享物料资料库）=====
const SYNC_API='';//同域部署留空即可；本地预览连远程时改为 https://你的应用.onrender.com
const SYNC_KEY='master';
let lastVersion=0,pushTimer=null,pushRetry=null;
function setSync(status,msg){const el=document.getElementById('sync-bar');if(!el)return;const map={ok:'已同步',pulling:'同步中…',error:'同步失败',off:'未连接'};el.textContent=msg||(map[status]||status);el.className='sync-bar sync-'+status}
async function apiGet(){const r=await fetch(SYNC_API+'/api/master');if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function apiPut(data){const r=await fetch(SYNC_API+'/api/master',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
function schedulePush(){clearTimeout(pushTimer);pushTimer=setTimeout(pushMaster,900)}
async function pushMaster(){try{const j=await apiPut(master);lastVersion=j.version;setSync('ok')}catch(e){setSync('error','云端同步失败，修改仅保存在本地，将自动重试');if(!pushRetry)pushRetry=setTimeout(()=>{pushRetry=null;pushMaster()},8000)}}
function isEditingMaster(){const a=document.activeElement;return !!(a&&a.tagName==='INPUT'&&a.closest('#master-body'))}
async function pullMaster(){try{setSync('pulling');const j=await apiGet();if(j.version>lastVersion){if(isEditingMaster()){lastVersion=j.version;setSync('ok','云端有新资料，你正在编辑，稍后自动同步');return}master=j.data;saveMasterLocal();renderMaster();lastVersion=j.version;setSync('ok')}else if(j.version===0&&master.length){await pushMaster();setSync('ok')}else{lastVersion=j.version;setSync('ok')}}catch(e){setSync('error','无法连接云端，当前使用本地数据')}}
function connectEvents(){if(!('EventSource'in window))return;try{const es=new EventSource(SYNC_API+'/api/events');es.onmessage=e=>{try{const ev=JSON.parse(e.data);if(ev.key===SYNC_KEY&&ev.version>lastVersion)setTimeout(pullMaster,200)}catch(x){}};es.onerror=()=>{}}catch(e){}}
function initSync(){connectEvents();pullMaster()}
function saveOrder(){localStorage.setItem('paigui_order_v2',JSON.stringify(orders));localStorage.setItem('paigui_order_no_v2',orderNo)}
function saveConversions(){localStorage.setItem('paigui_conversions_v1',JSON.stringify(conversions))}
function loadConversions(){try{conversions=JSON.parse(localStorage.getItem('paigui_conversions_v1')||'[]')||[]}catch(e){conversions=[]}}
function blankConversion(){return {'物料编码':'','转换数量':'1','说明':''}}
function findConversion(code){code=String(code||'').trim();return conversions.find(x=>String(x['物料编码']||'').trim()===code)}
function getConversion(code){let x=findConversion(code),n=num(x?.['转换数量']);return n>0?n:1}
function calcPackageQty(code,confirmed){return num(confirmed)/getConversion(code)}
function renderConversions(){
let tb=$('conv-body');if(!tb)return;tb.innerHTML='';
conversions.forEach((c,i)=>{
let m=findMaterial(c['物料编码']),tr=document.createElement('tr');
tr.innerHTML='<td>'+(i+1)+'</td><td><input value="'+esc(c['物料编码'])+'" data-i="'+i+'" data-f="物料编码"></td><td><input readonly value="'+esc(m?.['物料名称']||'')+'"></td><td><input type="number" min="0.000001" step="any" value="'+esc(c['转换数量']||'1')+'" data-i="'+i+'" data-f="转换数量"></td><td><input value="'+esc(c['说明']||'')+'" data-i="'+i+'" data-f="说明"></td><td><button class="del" data-del="'+i+'">删除</button></td>';
tb.appendChild(tr)});
if(!conversions.length)tb.innerHTML='<tr><td colspan="6" class="empty">暂无转换系数</td></tr>';
$('conv-info').innerHTML='当前转换系数：<b>'+conversions.length+'</b> 条；未设置转换系数的物料默认按 1 处理。';
tb.querySelectorAll('input[data-f]').forEach(inp=>inp.oninput=()=>{let i=+inp.dataset.i,f=inp.dataset.f;conversions[i][f]=inp.value;saveConversions();if(f==='物料编码'||f==='转换数量'){renderConversions();renderOrders()}});
tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{conversions.splice(+b.dataset.del,1);saveConversions();renderConversions();renderOrders()});
}
function exportConversions(){let lines=[CONVERSION_FIELDS.join(',')];conversions.forEach(c=>lines.push(CONVERSION_FIELDS.map(f=>'"'+String(c[f]??'').replace(/"/g,'""')+'"').join(',')));downloadBlob('转换系数.csv','\ufeff'+lines.join('\n'),'text/csv;charset=utf-8')}

function loadOrder(){try{orders=JSON.parse(localStorage.getItem('paigui_order_v2')||'[]');orderNo=localStorage.getItem('paigui_order_no_v2')||''}catch(e){orders=[]}}
function blankMaster(){return {'物料编码':'','物料名称':'','大类':'食材','厂家':'','温度属性':'常温','单箱体积':'','单箱净重':'','单箱毛重':'','唛头':'','海关编码':'','货物描述':'','单位':'','包装单位':'','关单':''}}
function blankOrder(){return {'物料编码':'','箱数':''}}
function findMaterial(code){code=String(code||'').trim();return master.find(m=>String(m['物料编码']||'').trim()===code)}
function validateMaster(){
let seen={},bad=[];
master.forEach((m,i)=>{let c=String(m['物料编码']||'').trim();if(!c)bad.push('第'+(i+1)+'行缺少物料编码');else if(seen[c])bad.push('物料编码重复：'+c);else seen[c]=1;
if(c&&(!m['物料名称']||num(m['单箱体积'])<=0||num(m['单箱毛重'])<0))bad.push('物料 '+c+' 的名称/单箱体积/单箱毛重资料不完整')});return bad}
function renderMaster(){
let q=($('master-search').value||'').toLowerCase(),list=master.filter(m=>[m['物料编码'],m['物料名称'],m['厂家']].join('|').toLowerCase().includes(q));
let tb=$('master-body');tb.innerHTML='';
list.forEach((m,i)=>{let tr=document.createElement('tr'),real=master.indexOf(m);tr.innerHTML='<td>'+(real+1)+'</td>';
MASTER_FIELDS.forEach(f=>{let td=document.createElement('td'),inp=document.createElement('input');inp.value=m[f]??'';inp.addEventListener('input',e=>{m[f]=e.target.value;saveMaster();renderMasterInfo()});td.appendChild(inp);tr.appendChild(td)});
let td=document.createElement('td');let b=document.createElement('button');b.className='del';b.textContent='删除';b.onclick=()=>{if(confirm('确定删除 '+(m['物料编码']||'该物料')+'？')){master.splice(real,1);saveMaster();renderMaster()}};td.appendChild(b);tr.appendChild(td);tb.appendChild(tr)});
if(!list.length)tb.innerHTML='<tr><td colspan="16" class="empty">暂无物料资料</td></tr>';renderMasterInfo()}
function renderMasterInfo(){let bad=validateMaster();$('master-info').innerHTML='当前物料：<b>'+master.length+'</b> 条'+(bad.length?'　<span class="error">发现 '+bad.length+' 个资料问题</span>':'　<span class="ok">资料库状态正常</span>')}
function enrichOrders(){
let missing=[];
orders.forEach(o=>{let m=findMaterial(o['物料编码']);if(m){Object.keys(m).forEach(k=>o[k]=m[k])}else missing.push(o['物料编码']||'(空编码)')});return missing}

function renderOrders(){
let tb=$('data-body');tb.innerHTML='';let missing=[];
orders.forEach((o,i)=>{
let m=findMaterial(o['物料编码']),pkg=m?calcPackageQty(o['物料编码'],o['箱数']):'';
let vals=[o['物料编码'],m?.['物料名称']||'',m?.['大类']||'',m?.['厂家']||'',m?.['温度属性']||'',o['箱数'],pkg,m?.['单箱体积']||'',m?.['单箱净重']||'',m?.['单箱毛重']||''];
let tr=document.createElement('tr');
tr.innerHTML='<td>'+ (i+1)+'</td>'+vals.map((v,j)=>'<td><input '+((j===0||j===5)?'':'readonly')+' value="'+esc(v)+'" data-i="'+i+'" data-j="'+j+'"></td>').join('')+'<td><button class="del" data-del="'+i+'">删除</button></td>';tb.appendChild(tr);
if(!m)missing.push(o['物料编码']||'(空编码)')
});
tb.querySelectorAll('input').forEach(inp=>inp.oninput=()=>{let i=+inp.dataset.i,j=+inp.dataset.j;if(j===0)orders[i]['物料编码']=inp.value;if(j===5)orders[i]['箱数']=inp.value;saveOrder();renderOrders()});
tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{orders.splice(+b.dataset.del,1);saveOrder();renderOrders()});
$('order-no').value=orderNo;
$('order-info').innerHTML=orders.length+' 个订单行'+(missing.length?'　<span class="error">未匹配：'+[...new Set(missing)].join('、')+'</span>':'　<span class="ok">全部物料编码已匹配资料库</span>')
}
function makeContainer(temp,key){let t=CONTAINER_TYPES[key];return{id:'',type:key,typeName:t.name,temp,maxVol:t.maxVol,maxWeight:t.maxWeight,usedVol:0,usedWeight:0,items:[]}}
function canFit(c,it,n){return c.usedVol+it.perVol*n<=c.maxVol+1e-6&&c.usedWeight+it.perWeight*n<=c.maxWeight+1e-6}
function maxFit(c,it){let v=Math.floor((c.maxVol-c.usedVol)/it.perVol),w=it.perWeight>0?Math.floor((c.maxWeight-c.usedWeight)/it.perWeight):Infinity;return Math.max(0,Math.min(v,w))}
function place(c,it,n){c.items.push({...it,boxes:n});c.usedVol+=it.perVol*n;c.usedWeight+=it.perWeight*n}
function runPaigui(raw){
let warnings=[],materials=[];
raw.forEach((r,i)=>{let m=findMaterial(r['物料编码']),confirmed=num(r['箱数']),boxes=calcPackageQty(r['物料编码'],confirmed);
if(!m){warnings.push('第'+(i+1)+'行物料编码「'+(r['物料编码']||'')+'」未在物料资料库中找到');return}
if(boxes<=0){warnings.push('物料「'+m['物料名称']+'」箱数无效');return}
let perVol=num(m['单箱体积']),perNet=num(m['单箱净重']),perWeight=num(m['单箱毛重']);
if(perVol<=0||perWeight<=0){warnings.push('物料「'+m['物料名称']+'」单箱体积或毛重无效');return}
materials.push({code:m['物料编码'],name:m['物料名称'],category:m['大类']||'未分类',factory:m['厂家']||'未知厂家',temp:normalizeTemp(m['温度属性']),confirmed,boxes,conversion:getConversion(m['物料编码']),perVol,perNet,perWeight})});
let containers=[],seq=0,groups={'常温':[],'冷冻':[]};materials.forEach(m=>groups[m.temp].push(m));
['常温','冷冻'].forEach(temp=>{let items=groups[temp];if(!items.length)return;items.sort((a,b)=>a.factory.localeCompare(b.factory,'zh')||a.name.localeCompare(b.name,'zh'));let open=[];
function newC(){let c=makeContainer(temp,LARGE_TYPE[temp]);c.id='柜'+(++seq);containers.push(c);open.push(c);return c}
items.forEach(it=>{let rem=it.boxes,whole=null;
open.forEach(c=>{if(!canFit(c,it,rem))return;if(!whole)whole=c;else{let cs=c.items.some(x=>x.factory===it.factory),ws=whole.items.some(x=>x.factory===it.factory),fc=c.maxVol-c.usedVol,fw=whole.maxVol-whole.usedVol;if(cs&&!ws)whole=c;else if(cs===ws&&fc<fw)whole=c}});
if(whole){place(whole,it,rem);return}
let best=null,bfit=0;open.forEach(c=>{let f=maxFit(c,it);if(f>bfit){best=c;bfit=f}});
if(best){let n=Math.min(rem,bfit);place(best,it,n);rem-=n}
if(rem>0){let c=newC(),fit=maxFit(c,it);if(fit>=rem)place(c,it,rem);else{if(fit>0){place(c,it,fit);rem-=fit}while(rem>0){let cc=newC(),f=maxFit(cc,it);if(f<=0){warnings.push('物料「'+it.name+'」单箱体积或毛重超过柜型上限，无法完整排入');break}let n=Math.min(rem,f);place(cc,it,n);rem-=n}warnings.push('物料「'+it.name+'」被拆分到多个柜')}}});
if(open.length){let last=open[open.length-1],small=CONTAINER_TYPES[SMALL_TYPE[temp]];if(last.usedVol<=small.maxVol+1e-6&&last.usedWeight<=small.maxWeight+1e-6){last.type=small.key;last.typeName=small.name;last.maxVol=small.maxVol;last.maxWeight=small.maxWeight}}});
let total=containers.reduce((a,c)=>{a.vol+=c.usedVol;a.weight+=c.usedWeight;a.boxes+=c.items.reduce((s,x)=>s+x.boxes,0);a.net+=c.items.reduce((s,x)=>s+x.perNet*x.boxes,0);return a},{vol:0,weight:0,boxes:0,net:0});
let combo={};containers.forEach(c=>combo[c.typeName]=(combo[c.typeName]||0)+1);
return{orderNo,containers,total,combo,warnings,materials}}
function buildResultRows(r){let out=[],seq=0;r.containers.forEach(c=>{let names=[...new Set(c.items.map(x=>x.name))],boxes=c.items.reduce((s,x)=>s+x.boxes,0),net=c.items.reduce((s,x)=>s+x.perNet*x.boxes,0),vu=c.usedVol/c.maxVol,wu=c.usedWeight/c.maxWeight;
c.items.forEach(it=>{out.push({type:'item',cells:[++seq,it.category,it.code,it.name,it.factory,it.temp,rnd(it.confirmed,3),rnd(it.boxes,3),rnd(it.perVol,3),rnd(it.perVol*it.boxes,3),rnd(it.perNet,2),rnd(it.perNet*it.boxes,2),rnd(it.perWeight,2),rnd(it.perWeight*it.boxes,2),c.typeName,'','',''],q:c.id})});
let confirmedTotal=c.items.reduce((sum,x)=>sum+x.confirmed,0);out.push({type:'subtotal',cells:['合计',names.length+' 种货物','',c.typeName,'',c.temp,rnd(confirmedTotal,3),rnd(boxes,3),'',rnd(c.usedVol,3),'',rnd(net,2),'',rnd(c.usedWeight,2),c.typeName,(vu*100).toFixed(1)+'%',(wu*100).toFixed(1),''],q:c.id})});
let combo=Object.keys(r.combo).map(k=>k+' × '+r.combo[k]).join(' + ');let confirmedGrand=r.materials.reduce((sum,x)=>sum+x.confirmed,0);out.push({type:'total',cells:['总计','','','柜型组合：'+combo,'','',rnd(confirmedGrand,3),rnd(r.total.boxes,3),'',rnd(r.total.vol,3),'',rnd(r.total.net,2),'',rnd(r.total.weight,2),'','','',''],q:''});return out}
function align(ci){return ci===0?'center':[1,2,3,4,5,14,17].includes(ci)?'left':'right'}
function renderResult(r){currentResult=r;if(!r){$('result-empty').style.display='block';$('result-wrap').style.display='none';return}
$('result-empty').style.display='none';$('result-wrap').style.display='block';
$('result-warnings').innerHTML=r.warnings.length?'<div class="warn-box"><b>提示：</b><ul>'+r.warnings.map(esc).map(x=>'<li>'+x+'</li>').join('')+'</ul></div>':'';
let s='<div class="summary"><div class="stat">柜数<br><b>'+r.containers.length+'</b></div><div class="stat">包装数量<br><b>'+r.total.boxes+'</b></div><div class="stat">总体积<br><b>'+rnd(r.total.vol,3)+' CBM</b></div><div class="stat">总净重<br><b>'+rnd(r.total.net,2)+' KG</b></div><div class="stat">总毛重<br><b>'+rnd(r.total.weight,2)+' KG</b></div></div>';$('result-summary').innerHTML=s;
let rr=buildResultRows(r),h='<table><thead><tr><th colspan="20" class="title-row">订单号：'+esc(r.orderNo||'（未填写）')+'</th></tr><tr class="head-row">'+RESULT_HEADERS.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>';
rr.forEach(x=>{let cls=x.type==='item'?'':' '+(x.type==='subtotal'?'subtotal-row':'total-row');h+='<tr class="'+cls+'">'+x.cells.map((v,i)=>'<td style="text-align:'+align(i)+'">'+esc(v)+'</td>').join('')+'<td class="q-col">'+esc(x.q)+'</td></tr>'});$('result-wrap').innerHTML=h+'</tbody></table>'}
function downloadBlob(name,text,type){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function exportMaster(){let lines=[MASTER_FIELDS.join(',')];master.forEach(m=>lines.push(MASTER_FIELDS.map(f=>'"'+String(m[f]??'').replace(/"/g,'""')+'"').join(',')));downloadBlob('物料资料库.csv','\ufeff'+lines.join('\n'),'text/csv;charset=utf-8')}
const EXPORT_HEADERS_CN=['唛头','商品编码','海关编码','货物名称','货物描述','货物数量','单位','包装数量','包装单位','单件体积','单件净重','单件毛重','总体积','总净重','总毛重','关单','厂家'];
const EXPORT_HEADERS_EN=['','PRODUCT CODE','HS CODE','PRODUCT NAME','DESCRIPTION',"PRODUCT Q'TY",'UNIT','PACKING Q\'TY','PACKING UNIT','','','','','','','',''];
function buildExportData(r){
let out=[],confirmedGrand=0;
r.containers.forEach(c=>{
let confirmed=c.items.reduce((s,x)=>s+x.confirmed,0),boxes=c.items.reduce((s,x)=>s+x.boxes,0),net=c.items.reduce((s,x)=>s+x.perNet*x.boxes,0);
confirmedGrand+=confirmed;
let subText='小计　货物数量:'+rnd(confirmed,3)+'　包装数量:'+rnd(boxes,3)+'　总体积:'+rnd(c.usedVol,3)+' CBM　总净重:'+rnd(net,2)+' KG　总毛重:'+rnd(c.usedWeight,2)+' KG';
out.push({type:'head',cells:['#'+c.id+'　'+c.typeName,'','','','','','','','','','','','','','','','']});
c.items.forEach(it=>{
let m=findMaterial(it.code)||{};
let cn=it.name||'',en=m['货物描述']||'';
out.push({type:'item',cells:[m['唛头']||'',it.code,m['海关编码']||'',cn,en,rnd(it.confirmed,3),m['单位']||'',rnd(it.boxes,3),m['包装单位']||'',rnd(it.perVol,3),rnd(it.perNet,2),rnd(it.perWeight,2),rnd(it.perVol*it.boxes,3),rnd(it.perNet*it.boxes,2),rnd(it.perWeight*it.boxes,2),m['关单']||'',m['厂家']||'']});
});
out.push({type:'sub',cells:[subText,'','','','','','','','','','','','','','','','']});
});
out.push({type:'total',cells:['TOTAL','','','','','',rnd(confirmedGrand,3),'',rnd(r.total.boxes,3),'','','','',rnd(r.total.vol,3),rnd(r.total.net,2),rnd(r.total.weight,2),'']});
return {rows:out};
}
function exportResultCsv(){if(!currentResult)return;let ed=buildExportData(currentResult),lines=[EXPORT_HEADERS_CN.join(',')];
ed.rows.forEach(x=>{
if(x.type==='head'||x.type==='sub'){lines.push(x.cells[0]);return}
if(x.type==='total'){lines.push(x.cells.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));return}
lines.push(x.cells.map(v=>'"'+String(v??'').replace(/\n/g,' ').replace(/"/g,'""')+'"').join(','));
});
lines.push('');
downloadBlob('排柜结果_'+(currentResult.orderNo||'未命名')+'.csv','\ufeff'+lines.join('\n'),'text/csv;charset=utf-8')}
function cellAddr(r,c){return XLSX.utils.encode_cell({r:r,c:c})}
function exportXlsx(){
if(!currentResult){alert('请先完成排柜');return}
if(typeof XLSX==='undefined'){alert('Excel库尚未加载，请刷新页面后重试；也可先使用CSV导出');return}
let ed=buildExportData(currentResult),comboTxt=Object.keys(currentResult.combo).map(k=>k+' × '+currentResult.combo[k]).join(' + ');
let hd2=['唛头','商品编码\nPRODUCT CODE','海关编码\nHS CODE','货物名称\nPRODUCT NAME','货物描述\nDESCRIPTION',"货物数量\nPRODUCT Q'TY",'单位\nUNIT',"包装数量\nPACKING Q'TY",'包装单位\nPACKING UNIT','单件体积','单件净重','单件毛重','总体积','总净重','总毛重','关单','厂家'];let aoa=[['合同号：'+(currentResult.orderNo||'未填写')+'　　柜量+柜型：'+comboTxt],hd2,...ed.rows.map(x=>x.cells)],ws=XLSX.utils.aoa_to_sheet(aoa);
ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:16}}];
const TITLE_FILL='8B0000',GRAY_FILL='D9D9D9',HEAD_YD_FILL='FFF2CC',SUB_FILL='FFFF00';
function setStyle(r,c,style){let a=cellAddr(r,c);if(ws[a])ws[a].s=style}
function border(){return {top:{style:'thin',color:{rgb:'999999'}},bottom:{style:'thin',color:{rgb:'999999'}},left:{style:'thin',color:{rgb:'999999'}},right:{style:'thin',color:{rgb:'999999'}}}}
for(let c=0;c<17;c++)setStyle(0,c,{fill:{patternType:'solid',fgColor:{rgb:TITLE_FILL}},font:{bold:true,color:{rgb:'FFFFFF'}},border:border(),alignment:{horizontal:'center',vertical:'center'}});
for(let c=0;c<17;c++)setStyle(1,c,{fill:{patternType:'solid',fgColor:{rgb:HEAD_YD_FILL}},font:{bold:true},border:border(),alignment:{horizontal:'center',vertical:'center',wrapText:true}});
let r=2;
ed.rows.forEach(x=>{
if(x.type==='head'){
for(let c=0;c<17;c++)setStyle(r,c,{fill:{patternType:'solid',fgColor:{rgb:HEAD_YD_FILL}},font:{bold:true},border:border(),alignment:{horizontal:'left',vertical:'center'}});
ws['!merges'].push({s:{r:r,c:0},e:{r:r,c:16}});
}else if(x.type==='sub'){
for(let c=0;c<17;c++)setStyle(r,c,{fill:{patternType:'solid',fgColor:{rgb:SUB_FILL}},font:{bold:true},border:border(),alignment:{horizontal:'left',vertical:'center'}});
ws['!merges'].push({s:{r:r,c:0},e:{r:r,c:16}});
}else if(x.type==='total'){
for(let c=0;c<17;c++)setStyle(r,c,{fill:{patternType:'solid',fgColor:{rgb:GRAY_FILL}},font:{bold:true},border:border(),alignment:{horizontal:'center',vertical:'center'}});
}else{
for(let c=0;c<17;c++)setStyle(r,c,{border:border(),alignment:{vertical:'center',wrapText:c===3||c===4}});
}
r++;
});
ws['!cols']=[14,12,12,16,18,12,8,12,12,10,10,10,12,12,12,12,14].map(w=>({wch:w}));
ws['!rows']=[{hpt:26},{hpt:44}];
let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'排柜结果');XLSX.writeFile(wb,'排柜结果_'+(currentResult.orderNo||'未命名')+'.xlsx')}
function openPaste(mode){modalMode=mode;$('modal-title').textContent=mode==='master'?'粘贴物料资料库（Excel复制，含表头）':mode==='conversion'?'粘贴转换系数（物料编码 + 转换数量 + 说明）':'粘贴订单（物料编码 + 确认数量）';$('paste-text').value='';$('paste-modal').classList.add('open');$('paste-text').focus()}

function handlePaste(){
let g=csvParse($('paste-text').value);
if(!g.length){alert('没有解析到数据');return}
if(modalMode==='master'){
  let a=mapRows(g,MASTER_FIELDS);
  a.forEach(x=>{
    let c=String(x['物料编码']||'').trim();if(!c)return;
    let old=findMaterial(c),o=old||blankMaster();
    MASTER_FIELDS.forEach(k=>{if(x[k]!==undefined)o[k]=x[k]});
    ['单箱体积','单箱净重','单箱毛重'].forEach(k=>{if(o[k]!==undefined)o[k]=String(o[k]).trim().replace(/,/g,'')});
    o['温度属性']=normalizeTemp(o['温度属性']);
    if(!old)master.push(o)
  });
  saveMaster();renderMaster();
}else if(modalMode==='conversion'){
  let a=mapRows(g,CONVERSION_FIELDS);
  a.forEach(x=>{
    let code=String(x['物料编码']||'').trim();if(!code)return;
    let old=findConversion(code),o=old||blankConversion();
    CONVERSION_FIELDS.forEach(k=>{if(x[k]!==undefined)o[k]=x[k]});
    o['转换数量']=String(o['转换数量']||'1').trim().replace(/,/g,'');
    if(num(o['转换数量'])<=0)o['转换数量']='1';
    if(!old)conversions.push(o)
  });
  saveConversions();renderConversions();renderOrders();
}else{
  let a=mapRows(g,ORDER_FIELDS);
  orders=a.map(x=>({'物料编码':x['物料编码']||'','箱数':x['箱数']||''}));
  saveOrder();renderOrders()
}
$('paste-modal').classList.remove('open')
}
document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function switchTab(n){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===n));document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$('tab-'+n).classList.add('active')}
$('master-add').onclick=()=>{master.push(blankMaster());saveMaster();renderMaster();setTimeout(()=>document.querySelector('#master-body tr:last-child input')?.focus(),0)}
$('master-search').oninput=renderMaster;
$('master-paste').onclick=()=>openPaste('master');$('paste-cancel').onclick=()=>$('paste-modal').classList.remove('open');$('paste-ok').onclick=handlePaste;
$('master-import').onclick=()=>$('master-file').click();$('master-file').onchange=e=>{let f=e.target.files[0];if(!f)return;readCsvFile(f).then(text=>{let a=mapRows(csvParse(text),MASTER_FIELDS);a.forEach(x=>{let c=String(x['物料编码']||'').trim();if(!c)return;let old=findMaterial(c),o=old||blankMaster();MASTER_FIELDS.forEach(k=>{if(x[k]!==undefined)o[k]=x[k]});
['单箱体积','单箱净重','单箱毛重'].forEach(k=>{if(o[k]!==undefined)o[k]=String(o[k]).trim().replace(/,/g,'')});
o['温度属性']=normalizeTemp(o['温度属性']);if(!old)master.push(o)});saveMaster();renderMaster();alert('物料资料导入完成，共处理 '+a.length+' 行。')}).catch(e=>alert('CSV读取失败：'+e.message));e.target.value=''}
$('master-export').onclick=exportMaster;$('master-clear').onclick=()=>{if(confirm('确定清空整个物料资料库？建议先导出备份。')){master=[];saveMaster();renderMaster()}}
$('order-add').onclick=()=>{orders.push(blankOrder());saveOrder();renderOrders()}
$('order-clear').onclick=()=>{orders=[];saveOrder();renderOrders()}
$('order-sample').onclick=()=>{if(master.length===0){master=[
{'物料编码':'M001','物料名称':'冷冻牛肉','大类':'食材','厂家':'A食品厂','温度属性':'冷冻','单箱体积':'.05','单箱净重':'15','单箱毛重':'16.2'},
{'物料编码':'M002','物料名称':'大米','大类':'食材','厂家':'C粮厂','温度属性':'常温','单箱体积':'.06','单箱净重':'20','单箱毛重':'21'},
{'物料编码':'M003','物料名称':'包装纸箱','大类':'包材','厂家':'E包材厂','温度属性':'常温','单箱体积':'.02','单箱净重':'2','单箱毛重':'2.4'}];saveMaster();renderMaster()}
orders=[{'物料编码':'M001','箱数':'160'},{'物料编码':'M002','箱数':'400'},{'物料编码':'M003','箱数':'300'}];orderNo='PO20260922';saveOrder();renderOrders()}
$('order-no').oninput=e=>{orderNo=e.target.value;saveOrder()};$('order-paste').onclick=()=>openPaste('order');
$('order-import').onclick=()=>$('order-file').click();$('order-file').onchange=e=>{let f=e.target.files[0];if(!f)return;readCsvFile(f).then(text=>{orders=mapRows(csvParse(text),ORDER_FIELDS).map(x=>({'物料编码':x['物料编码']||'','箱数':x['箱数']||''}));saveOrder();renderOrders()}).catch(e=>alert('CSV读取失败：'+e.message));e.target.value=''}
$('btn-calc').onclick=()=>{orderNo=$('order-no').value;saveOrder();if(!orders.length){alert('请先添加订单数据');return}let missing=enrichOrders();if(missing.length){alert('以下物料编码未找到资料库资料：\n'+[...new Set(missing)].join('\n'));return}let bad=validateMaster();if(bad.length){alert('物料资料库存在问题，请先修正：\n'+bad.slice(0,10).join('\n'));return}currentResult=runPaigui(orders);renderResult(currentResult);switchTab('result')}
$('btn-back').onclick=()=>switchTab('data');$('btn-export').onclick=exportResultCsv;$('btn-export-xlsx').onclick=exportXlsx;
$('paste-modal').onclick=e=>{if(e.target===$('paste-modal'))$('paste-modal').classList.remove('open')};

$('conv-add').onclick=()=>{conversions.push(blankConversion());saveConversions();renderConversions();setTimeout(()=>document.querySelector('#conv-body tr:last-child input')?.focus(),0)}
$('conv-paste').onclick=()=>openPaste('conversion')
$('conv-import').onclick=()=>$('conv-file').click()
$('conv-file').onchange=e=>{let f=e.target.files[0];if(!f)return;readCsvFile(f).then(text=>{let a=mapRows(csvParse(text),CONVERSION_FIELDS);a.forEach(x=>{let code=String(x['物料编码']||'').trim();if(!code)return;let old=findConversion(code),o=old||blankConversion();CONVERSION_FIELDS.forEach(k=>{if(x[k]!==undefined)o[k]=x[k]});o['转换数量']=String(o['转换数量']||'1').trim().replace(/,/g,'');if(num(o['转换数量'])<=0)o['转换数量']='1';if(!old)conversions.push(o)});saveConversions();renderConversions();renderOrders();alert('转换系数导入完成，共处理 '+a.length+' 行。')}).catch(e=>alert('CSV读取失败：'+e.message));e.target.value=''}
$('conv-export').onclick=exportConversions
$('conv-clear').onclick=()=>{if(confirm('确定清空全部转换系数？')){conversions=[];saveConversions();renderConversions();renderOrders()}}

loadMaster();loadOrder();loadConversions();renderMaster();renderConversions();renderOrders();initSync();
