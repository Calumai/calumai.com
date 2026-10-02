const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname,'lesson.json'),'utf8'));
const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const md = fs.readFileSync(path.join(__dirname,'gemini-spark-handout.md'),'utf8');
assert.equal(data.timeline.reduce((s,t)=>s+t.minutes,0),180);
assert.equal(data.chapters.reduce((s,c)=>s+c.minutes,0),170);
assert.equal(data.chapters.length,11);
assert.equal(data.prompts.length,44);
assert(data.screenshots.length>=12);
assert.equal(data.checklist.length,12);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(ids.includes(match[1]),`Missing anchor ${match[1]}`);
for (const c of data.chapters) {
  for (const key of ['recall','exercise','troubles','done']) assert(c[key],`${c.id}: missing ${key}`);
  for (const s of c.steps || []) for (const key of ['actions','see','different','done']) assert(s[key],`${c.id}: incomplete step`);
  for (const id of c.promptIds || []) assert(data.prompts.some(p=>p.id===id),`Missing prompt ${id}`);
  for (const id of c.sources || []) assert(data.sources.some(s=>s.id===id),`Missing source ${id}`);
}
for (const p of data.prompts) {
  assert(html.includes(`id="text-${p.id}"`));
  assert(md.includes(`### ${p.id}｜${p.title}`));
  for (const key of ['need','use','body','follow','check']) assert(p[key],`${p.id}: missing ${key}`);
}
for (const s of data.screenshots) {
  assert(fs.statSync(path.join(__dirname,'screenshots',s.file)).size > 10000);
  assert(html.includes(`screenshots/${s.file}`));
  assert(data.sources.some(source=>source.id===s.source));
}
assert(fs.statSync(path.join(__dirname,'gemini-spark-handout-pack.zip')).size > 100000);
assert(html.includes('id="spark-demo"'));
assert(html.includes('id="demo-prompt-text"'));
assert(html.includes('id="demo-revision-text"'));
assert(fs.statSync(path.join(__dirname,data.liveDemo.file)).size > 10000);
if(data.liveDemo.revisionFile)assert(fs.statSync(path.join(__dirname,data.liveDemo.revisionFile)).size > 10000);
assert(!html.includes('docs.google.com/document/d/'),'Private demonstration document URL published');
for(const term of ['許可權','物件','GitHub Spark','學生姓名：','API Key']) assert(!html.includes(term),`Unexpected content: ${term}`);
assert(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(html),'Personal email in handout');
assert(!/外部 AI API/.test(html),'Unrequested AI integration');
console.log(`PASS: timing, all chapter/step fields, 44 prompt pairs, links/IDs, ${data.screenshots.length} real screenshot files, actual DOCX, ZIP and privacy terms.`);
