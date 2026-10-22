// Rebuild the editable PowerPoint decks and SVG/PNG infographics from content.js.
// Run with the bundled Node.js runtime used by this Codex workspace.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PptxGenJS = require('pptxgenjs');
const sharp = require('sharp');
const root = __dirname;
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), sandbox);
const lessons = sandbox.window.AMIS_MATERIALS;
const C = { green:'174438', cream:'FBFAF5', orange:'D56B3F', gold:'EDC475', ink:'17352D', line:'DCE1D5', muted:'586B61', white:'FFFFFF', pale:'E3EDE1' };
const xml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const filename = key => key === 'classroom' ? 'classroom' : 'identity';

function addText(slide, text, x, y, w, h, size, color=C.ink, bold=false, extra={}) {
  slide.addText(text, { x,y,w,h, fontFace:'Microsoft JhengHei', fontSize:size, color, bold,
    margin:0, valign:'mid', breakLine:false, ...extra });
}
function rect(slide, x,y,w,h,color,radius=false) {
  slide.addShape(radius ? 'roundRect' : 'rect', {x,y,w,h,rectRadius:.13,line:{color},fill:{color}});
}
function footer(slide, lesson, page, count) {
  addText(slide, `${lesson.source} · PDF 印刷第 ${page} 頁`, .55, 6.9, 10, .22, 10, 'C6D7CD');
  addText(slide, `${count}`, 12.2, 6.9, .5, .22, 10, 'C6D7CD', true, {align:'right'});
}
function questionSlide(pptx, lesson, q, n, showAnswer) {
  const slide = pptx.addSlide(); slide.background = {color:C.green};
  rect(slide,.55,.45,2.4,.42,C.gold,true);
  addText(slide,`${showAnswer ? '答案揭曉' : '第 '+String(n).padStart(2,'0')+' 關'} · ${q.type}`,.75,.51,2.1,.25,12,C.ink,true);
  addText(slide,q.scene,.65,1.15,11.5,.45,21,C.gold,true);
  addText(slide,q.prompt,.65,1.7,12.05,1.65,q.prompt.length>55?29:q.prompt.length>33?35:44,C.white,true,{valign:'mid',breakLine:false});
  addText(slide,'這句南勢阿美語在教材中的意思是？',.65,3.47,12,.3,16,'D5E5DB');
  q.choices.forEach((choice,i)=>{
    const x=.65+i*4.2; const correct=showAnswer&&i===q.answer;
    rect(slide,x,4.05,3.92,1.38,correct?C.gold:C.cream,true);
    addText(slide,`${String.fromCharCode(65+i)}　${choice}`,x+.25,4.3,3.45,.87,choice.length>15?18:22,C.ink,true,{breakLine:false});
  });
  if(showAnswer) addText(slide,`正解 ${String.fromCharCode(65+q.answer)} · ${q.choices[q.answer]}`, .65,5.75,12,.44,23,C.gold,true);
  else addText(slide,'先口答或舉牌，再翻到下一張揭曉。',.65,5.75,12,.42,16,'D5E5DB');
  footer(slide,lesson,q.page,`${n} / ${lesson.questions.length}`);
}
async function buildDeck(key, lesson) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author='CalumAi'; pptx.subject=lesson.source;
  pptx.title=lesson.title; pptx.lang='zh-TW';
  let slide=pptx.addSlide(); slide.background={color:C.cream};
  rect(slide,.7,.7,2.25,.45,C.green,true);
  addText(slide,'南勢阿美語 · 課堂搶答',.9,.78,1.95,.25,12,C.white,true);
  addText(slide,lesson.shortTitle,.75,1.6,11.8,1.1,54,C.ink,true);
  addText(slide,'看題目，先猜；翻一頁，再揭曉。',.77,3.1,11.8,.55,26,C.orange,true);
  addText(slide,lesson.description,.77,4.15,11.65,.65,20,C.muted);
  addText(slide,'8 題 · 投影、口答、舉牌都可用',.77,6.27,11.8,.3,15,C.green,true);
  slide=pptx.addSlide(); slide.background={color:C.green};
  addText(slide,'怎麼玩',.7,.95,11,1,48,C.white,true);
  ['① 先看南勢阿美語詞句。','② 學生口答或舉 A／B／C 牌。','③ 翻下一頁，核對正解與 PDF 頁碼。'].forEach((t,i)=>addText(slide,t,.8,2.35+i*.9,11.7,.65,25,C.cream,true));
  addText(slide,'本簡報由教材中的少量詞句編成遊戲題卡；正式授課前請族語教師核對。',.8,6.3,11.7,.36,13,'D5E5DB');
  lesson.questions.forEach((q,i)=>{questionSlide(pptx,lesson,q,i+1,false);questionSlide(pptx,lesson,q,i+1,true);});
  slide=pptx.addSlide(); slide.background={color:C.cream};
  addText(slide,'闖關完成！',.75,1.55,11.6,1.15,55,C.ink,true);
  addText(slide,'回到資訊圖表，再把今天遇到的詞語說一遍。',.78,3.1,11.6,.75,27,C.orange,true);
  addText(slide,`資料來源：${lesson.source}\n教材標示族語 E 樂園設計製作／財團法人原住民族語言研究發展基金會 © 版權所有。`,.78,5.7,11.7,.8,12,C.muted);
  await pptx.writeFile({fileName:path.join(root,`${filename(key)}-game.pptx`)});
}
function buildSvg(key, lesson) {
  const yPositions=[340,540,740], xPositions=[95,820];
  const cards=lesson.infographicWords.map((item,i)=>{
    const x=xPositions[i%2],y=yPositions[Math.floor(i/2)];
    const fs=item.word.length>25?28:item.word.length>18?34:43;
    return `<g><rect x="${x}" y="${y}" width="685" height="164" rx="18" fill="${i%2?'#F4EEE4':'#EFF3E9'}" stroke="#DCE1D5" stroke-width="2"/><circle cx="${x+58}" cy="${y+82}" r="30" fill="#174438"/><text x="${x+58}" y="${y+91}" class="num" text-anchor="middle">${String(i+1).padStart(2,'0')}</text><text x="${x+108}" y="${y+73}" class="word" font-size="${fs}">${xml(item.word)}</text><text x="${x+108}" y="${y+124}" class="meaning">${xml(item.meaning)} <tspan class="page">· PDF 第 ${item.page} 頁</tspan></text></g>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${xml(lesson.infographicTitle)}"><style>text{font-family:'Microsoft JhengHei','Noto Sans TC',sans-serif}.kicker{font-size:25px;font-weight:700;letter-spacing:3px;fill:#D56B3F}.title{font-size:69px;font-weight:900;fill:#17352D}.sub{font-size:29px;fill:#586B61}.word{font-weight:850;fill:#17352D}.meaning{font-size:27px;font-weight:700;fill:#D56B3F}.page{font-size:19px;font-weight:500;fill:#586B61}.num{font-size:22px;font-weight:900;fill:#fff}.footer{font-size:19px;fill:#586B61}</style><rect width="1600" height="1000" fill="#FBFAF5"/><rect x="0" y="0" width="1600" height="20" fill="#174438"/><text x="95" y="100" class="kicker">南勢阿美語 · ${xml(lesson.shortTitle)}</text><text x="95" y="196" class="title">${xml(lesson.infographicTitle)}</text><text x="95" y="255" class="sub">${xml(lesson.infographicSubtitle)}</text>${cards}<line x1="95" y1="928" x2="1505" y2="928" stroke="#DCE1D5" stroke-width="2"/><text x="95" y="967" class="footer">來源：${xml(lesson.source)} · 詞語與中文對照取自 PDF 印刷第 5 頁</text></svg>`;
  fs.writeFileSync(path.join(root,`${filename(key)}-infographic.svg`),svg,'utf8');
  return svg;
}
(async()=>{
  for(const [key,lesson] of Object.entries(lessons)) {
    await buildDeck(key,lesson);
    const svg=buildSvg(key,lesson);
    await sharp(Buffer.from(svg)).png().toFile(path.join(root,`${filename(key)}-infographic.png`));
    console.log(key,`${lesson.questions.length*2+3} slides`,`${lesson.infographicWords.length} terms`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
