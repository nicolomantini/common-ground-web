const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
const source=fs.readFileSync('js/analytics.js','utf8');
function run(choice,host='common-ground.space',blocked=false){
 const scripts=[],handlers={},banners=[];const context={location:{hostname:host,reload(){}},localStorage:{getItem(){if(blocked)throw Error();return choice;},setItem(){}},document:{cookie:'',head:{appendChild(el){scripts.push(el)}},body:{appendChild(el){banners.push(el)}},createElement(){return {remove(){}}},getElementById(id){return {addEventListener(name,fn){handlers[id]=fn;}}}},Date};context.window=context;vm.runInNewContext(source,context);return {context,scripts,handlers,banners};
}
test('does not load Google before consent or after declining',()=>{assert.equal(run(null).scripts.length,0);assert.equal(run('declined').scripts.length,0);});
test('loads correct stream only after acceptance',()=>{const r=run(null);r.handlers['consent-accept']();assert.equal(r.scripts.length,1);assert.match(r.scripts[0].src,/G-DXM902HMZF/);assert.equal(r.context.dataLayer[0][2].ad_storage,'denied');});
test('honours stored consent but excludes local previews',()=>{assert.equal(run('accepted').scripts.length,1);assert.equal(run('accepted','127.0.0.1').scripts.length,0);});
test('blocked storage does not break consent banner',()=>{const r=run(null,'common-ground.space',true);assert.equal(r.banners.length,1);assert.equal(r.scripts.length,0);});
