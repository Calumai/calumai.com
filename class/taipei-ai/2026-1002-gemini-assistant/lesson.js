(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const toast=$('#copy-status');let toastTimer;
  function say(text){toast.textContent=text;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);}
  async function copy(text){try{await navigator.clipboard.writeText(text);say('已複製。貼到 Gemini 前，把【括號】改成自己的資料。');}catch{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.top='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();say(ok?'已複製。請核對內容再貼到 Gemini。':'複製未成功，請選取提示詞後按 Ctrl＋C。');}}
  $$('[data-copy]').forEach(b=>b.addEventListener('click',()=>copy(document.getElementById(b.dataset.copy).textContent.trim())));
  const cards=$$('.prompt-card');let category='all';
  function filter(){const word=$('#prompt-search').value.trim().toLowerCase();let count=0;cards.forEach(c=>{const show=(category==='all'||c.dataset.category===category)&&c.dataset.search.toLowerCase().includes(word);c.hidden=!show;if(show)count++;});$('#prompt-count').textContent=`顯示 ${count} / ${cards.length} 段` ;$('#no-prompts').hidden=count>0;}
  $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;$$('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter();}));$('#prompt-search').addEventListener('input',filter);
  function reveal(id){const target=document.getElementById(id);if(!target)return;if(target.classList.contains('prompt-card')){category='all';$('#prompt-search').value='';$$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));filter();}const details=target.querySelector('details');if(details)details.open=true;}
  $$('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>reveal(a.getAttribute('href').slice(1))));window.addEventListener('hashchange',()=>reveal(location.hash.slice(1)));reveal(location.hash.slice(1));
  $('#builder').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget.elements;const text=[`請協助我做族語教學草稿。`,`學生對象：${f.audience.value.trim()}`,`主題：${f.topic.value.trim()}`,`課程時間：${f.duration.value.trim()}`,`希望得到：${f.result.value}`,``, `【老師已核對的教材】`,f.material.value.trim(),``, `請先整理你讀到的資料與缺漏，得到我確認後再製作。保留族語原文、方言別、拼寫、大小寫、空格與符號。不要自行翻譯、新增族語或編造文化資訊。`,`學生版與答案版分開，教學流程時間需加總；資料不足就列出缺漏，不用湊題目。`,`使用臺灣繁體中文，這次只提供草稿，不寄出、不公開、不修改既有檔案或設定排程。`].join('\n');$('#builder-text').textContent=text;$('#builder-result').hidden=false;});
  const dialog=$('#image-dialog');let lastImageButton=null;
  $$('[data-image]').forEach(b=>b.addEventListener('click',()=>{lastImageButton=b;$('#image-full').src=b.dataset.image;$('#image-full').alt=b.dataset.caption;$('#image-caption').textContent=b.dataset.caption;dialog.showModal();}));$('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{if(lastImageButton)lastImageButton.focus();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  const checks=$$('.checklist input');checks.forEach(c=>c.addEventListener('change',()=>{$('#check-count').textContent=`${checks.filter(x=>x.checked).length} / ${checks.length} 項完成`;}));
  let printState=[];
  window.addEventListener('beforeprint',()=>{printState=$$('details').map(d=>[d,d.open]);$$('details').forEach(d=>d.open=true);cards.forEach(c=>c.hidden=false);});
  window.addEventListener('afterprint',()=>{printState.forEach(([d,open])=>d.open=open);filter();});
  $('[data-print]').addEventListener('click',()=>window.print());
})();
