/** Calumai 族語老師 LINE 教學機器人：20 種操作示例，單一試算表。*/
const TABS = {
  words:['id','中文','族語','例句','音檔URL','單元'],
  lessons:['課程','日期','地點','教材URL','名額'],
  tasks:['任務ID','LINE使用者ID','內容','到期日','狀態'],
  records:['時間','使用者ID','類型','項目','結果','備註'],
  attendance:['時間','使用者ID','課程','狀態'],
  assignments:['時間','使用者ID','課程','作業內容'],
  registrations:['時間','使用者ID','課程','狀態'],
  questions:['題號','題目','選項A','選項B','選項C','正解','解說','單元'],
  sessions:['使用者ID','題號','開始時間'],
  stories:['標題','內容','翻譯'],
  settings:['鍵','值'],
  reminders:['提醒ID','使用者ID','內容','預定時間','狀態']
};
function prop_(key){return PropertiesService.getScriptProperties().getProperty(key)||'';}
/** 第一次使用或換試算表：在 input 貼自己的網址或 ID，然後執行 setSpreadsheetId。 */
function setSpreadsheetId(){
  const input='把你的 Google 試算表網址或 ID 貼在這裡';
  const match=input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const id=(match?match[1]:input).trim();
  if(!/^[A-Za-z0-9_-]{20,}$/.test(id))throw new Error('請先把 input 換成有效的試算表網址或 ID');
  const ss=SpreadsheetApp.openById(id);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',id);
  Logger.log('已連接試算表：'+ss.getName()+' '+ss.getUrl());
}
function book_(){const id=prop_('SPREADSHEET_ID');if(!id)throw new Error('請先執行 setSpreadsheetId 設定試算表 ID');return SpreadsheetApp.openById(id);}
function tab_(name){const s=book_().getSheetByName(name);if(!s)throw new Error('缺少工作表 '+name+'，請先執行 setup');return s;}
function rows_(name){const v=tab_(name).getDataRange().getValues();return v.slice(1).filter(r=>r.some(x=>x!==''));}
function findRow_(name,predicate){const data=tab_(name).getDataRange().getValues();for(let i=1;i<data.length;i++){if(predicate(data[i]))return i+1;}return -1;}
function append_(name,data){const lock=LockService.getScriptLock();lock.waitLock(10000);try{tab_(name).appendRow(data);}finally{lock.releaseLock();}}
function fmtDate_(v){return v instanceof Date?Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy/MM/dd HH:mm'):String(v||'');}
function setup(){const ss=book_();Object.keys(TABS).forEach(n=>{let sh=ss.getSheetByName(n);if(!sh)sh=ss.insertSheet(n);if(sh.getLastRow()===0){sh.appendRow(TABS[n]);sh.setFrozenRows(1);sh.getRange(1,1,1,TABS[n].length).setFontWeight('bold').setBackground('#DFF4E8');}});seed_();Logger.log('初始化成功 '+ss.getUrl());}
function seed_(){if(!rows_('words').length){[['W001','你好','（請填入教師審核的族語）','','','招呼'],['W002','謝謝','（請填入教師審核的族語）','','','招呼']].forEach(r=>append_('words',r));}
 if(!rows_('questions').length){append_('questions',['Q001','示範題：以下哪個選項是 A？','A','B','C','A','此題僅供測試，請改成經老師審核的族語題目','操作練習']);}
 if(!rows_('lessons').length){append_('lessons',['示範課','2026/11/01 13:00','線上','https://example.com/請更換','20']);}
 if(!rows_('stories').length){append_('stories',['示範故事','請貼入經授權的族語故事','請貼入經審核的翻譯']);}}

/** LINE 入口：僅作課堂演示。GAS 無法取得 X-Line-Signature 標頭，不能驗證來源。 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return response_('EMPTY');
    const payload = JSON.parse(e.postData.contents);
    if (!Array.isArray(payload.events)) return response_('INVALID');
    payload.events.forEach(event => {
      if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;
      if (!event.replyToken || !event.source || !event.source.userId) return;
      const uid = event.source.userId;
      let answer;
      try { answer = command_(String(event.message.text || '').trim(), uid); }
      catch (err) { console.error('command error', err); answer = '系統暫時無法處理，請稍後重試。'; }
      reply_(event.replyToken, answer);
    });
    return response_('OK');
  } catch (error) {
    console.error('webhook error', error);
    return response_('ERROR');
  }
}
function doGet() { return response_('Calumai LINE GAS 教學版已部署'); }
function response_(txt) { return ContentService.createTextOutput(txt); }
function reply_(replyToken, content) { return sendLine_('reply', {replyToken, messages:[{type:'text',text:String(content).slice(0,4900)}]}); }
function push_(userId, content) { return sendLine_('push', {to:userId,messages:[{type:'text',text:String(content).slice(0,4900)}]}); }
function sendLine_(endpoint, body) {
  const token = prop_('LINE_ACCESS_TOKEN');
  if(!token) throw new Error('請設定指令碼屬性 LINE_ACCESS_TOKEN');
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/' + endpoint, {
    method:'post', contentType:'application/json',
    headers:{Authorization:'Bearer ' + token}, payload:JSON.stringify(body),
    muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  if(code < 200 || code >= 300) throw new Error('LINE API HTTP ' + code + ': ' + response.getContentText());
  return true;
}

function choose_(list){return list[Math.floor(Math.random()*list.length)];}
function command_(s,uid){const w=rows_('words'),q=rows_('questions'),le=rows_('lessons'),today=new Date();
 // 01 單字查詢
 if(s.startsWith('查單字 ')){const x=s.slice(4).trim();if(!x)return '請輸入要查的單字';const hits=w.filter(r=>String(r[1]).includes(x)||String(r[2]).includes(x));return hits.length?hits.slice(0,5).map(r=>`${r[1]} → ${r[2]}\n例句：${r[3]||'待補'}\n音檔：${r[4]||'待補'}`).join('\n\n'):'查無資料';}
 // 02 每日一句
 if(s==='每日一句'){const x=choose_(w);return x?`${x[1]}：${x[2]}\n${x[3]||''}`:'請先新增單字';}
 // 03 選擇題 & 06 錯題複習 & 08 排行榜 & 11 考前複習
 if(s==='測驗'||s==='錯題複習'||s.startsWith('考前複習')){let pool=q;if(s==='錯題複習'){const wrong=new Set(rows_('records').filter(r=>r[1]===uid&&r[2]==='答題'&&r[4]==='錯誤').map(r=>r[3]));pool=q.filter(r=>wrong.has(r[0]));}else if(s.startsWith('考前複習 ')){const topic=s.slice(5).trim();pool=q.filter(r=>String(r[7]).includes(topic));}
  if(!pool.length)return '目前沒有符合的題目。';const item=choose_(pool);const sessions=tab_('sessions');const pos=findRow_('sessions',r=>r[0]===uid);if(pos>=0)sessions.deleteRow(pos);append_('sessions',[uid,item[0],new Date()]);return `${item[1]}\nA. ${item[2]}\nB. ${item[3]}\nC. ${item[4]}\n請輸入：答 A／答 B／答 C`;}
 if(/^答\s*[ABCabc]$/.test(s)){const ans=s.match(/[ABCabc]/)[0].toUpperCase(),session=rows_('sessions').find(r=>r[0]===uid);if(!session)return '先輸入「測驗」取得題目。';const item=q.find(r=>String(r[0])===String(session[1]));if(!item)return '題目已不存在';const correct=ans===String(item[5]).toUpperCase();append_('records',[new Date(),uid,'答題',item[0],correct?'正確':'錯誤',ans]);const sh=tab_('sessions');const ix=findRow_('sessions',r=>r[0]===uid);if(ix>=0)sh.deleteRow(ix);return `${correct?'答對了！':'再加油！'}\n正解：${item[5]}\n${item[6]||''}`;}
 if(s==='排行榜'){const scores={};rows_('records').filter(r=>r[2]==='答題'&&r[4]==='正確').forEach(r=>scores[r[1]]=(scores[r[1]]||0)+1);return '排行榜（匿名代碼）\n'+(Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id,score],i)=>`${i+1}. ${id.slice(-5)}：${score}題`).join('\n')||'暫無紀錄');}
 // 04 教材 & 05 課程
 if(s.startsWith('教材 ')){const x=s.slice(3).trim();const hit=le.filter(r=>String(r[0]).includes(x));return hit.length?hit.map(r=>`${r[0]}：${r[3]}`).join('\n'):'無符合教材';}
 if(s==='課程'){return le.map(r=>`${r[0]}｜${fmtDate_(r[1])}｜${r[2]}`).join('\n')||'尚無課程';}
 // 07 每日挑戰：當日固定選題（若題庫變動，題目可能改變）
 if(s==='每日挑戰'){if(!q.length)return '尚未建立題庫';const date=Utilities.formatDate(today,Session.getScriptTimeZone(),'yyyyMMdd');const idx=Number(date)%q.length;const item=q[idx];return `今日挑戰：${item[1]}\nA.${item[2]} B.${item[3]} C.${item[4]}\n輸入「測驗」可進入正式計分模式。`;}
 // 09 作業
 if(s.startsWith('交作業 ')){const x=s.slice(4).trim();if(!x)return '格式：交作業 課程|內容';const parts=x.split('|');if(parts.length<2)return '格式：交作業 課程|內容';append_('assignments',[today,uid,parts[0].trim(),parts.slice(1).join('|').trim()]);return '作業內容已登記';}
 // 10 簽到/請假
 if(s.startsWith('簽到 ')||s.startsWith('請假 ')){const state=s.startsWith('簽到 ')?'簽到':'請假';append_('attendance',[today,uid,s.slice(3).trim(),state]);return `${state}已登記`;}
 // 12 故事
 if(s==='故事'){const x=choose_(rows_('stories'));return x?`${x[0]}\n${x[1]}\n翻譯：${x[2]}`:'尚無故事';}
 // 13 教材領取 同教材查詢
 if(s.startsWith('領教材 '))return command_('教材 '+s.slice(4),uid);
 // 14 備課任務
 if(s.startsWith('新增任務 ')){const id='T'+Utilities.formatDate(today,Session.getScriptTimeZone(),'yyyyMMddHHmmss');append_('tasks',[id,uid,s.slice(5).trim(),'','未完成']);return `已新增 ${id}`;}
 if(s==='我的任務'){const list=rows_('tasks').filter(r=>r[1]===uid);return list.map(r=>`${r[0]} ${r[2]}（${r[4]}）`).join('\n')||'尚無任務';}
 if(s.startsWith('完成 ')){const id=s.slice(3).trim();const idx=findRow_('tasks',r=>r[0]===id&&r[1]===uid);if(idx<0)return '找不到你的這項任務';tab_('tasks').getRange(idx,5).setValue('完成');return `${id} 已完成`;}
 // 15 課程報名
 if(s.startsWith('報名 ')){const course=s.slice(3).trim();const lesson=le.find(r=>r[0]===course);if(!lesson)return '找不到該課程';const old=rows_('registrations').some(r=>r[1]===uid&&r[2]===course&&r[3]==='報名');if(old)return '你已報名這門課';const cap=Number(lesson[4]);const count=rows_('registrations').filter(r=>r[2]===course&&r[3]==='報名').length;const state=Number.isFinite(cap)&&cap>0&&count>=cap?'候補':'報名';append_('registrations',[today,uid,course,state]);return `${state}成功：${course}`;}
 // 16 錯題複習: 命令在前段 / 17 闖關計分
 if(s==='我的積分'){const correct=rows_('records').filter(r=>r[1]===uid&&r[2]==='答題'&&r[4]==='正確').length;return `你目前有 ${correct*10} 分（每題10分）`;}
 // 18 個人提醒登記；需手動安裝定時觸發器
 if(s.startsWith('提醒 ')){const match=s.match(/^提醒\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/);if(!match)return '格式：提醒 2026-11-01 18:00 複習族語';const dt=new Date(`${match[1]}T${match[2]}:00+08:00`);if(isNaN(dt.getTime())||dt<=today)return '請輸入未來日期（台灣時間）';append_('reminders',['R'+Date.now(),uid,match[3],dt,'待發送']);return '提醒已登記（需啟用定時觸發器）';}
 // 19 週報查詢：本人資料，避免洩露學生個資
 if(s==='我的週報'){const since=Date.now()-7*86400000;const logs=rows_('records').filter(r=>r[1]===uid&&new Date(r[0]).getTime()>=since&&r[2]==='答題');return `近7天答題 ${logs.length} 題，正確 ${logs.filter(r=>r[4]==='正確').length} 題。`;}
 // 20 共用資料：所有命令讀取同一 Spreadsheet ID；多帳號部署請各自設定 token 和 webhook verifier
 return '族語教學助理指令：\n查單字 你好｜每日一句｜測驗｜錯題複習｜排行榜｜教材 示範課｜課程｜每日挑戰｜交作業 課程|內容｜簽到 課程｜請假 課程｜故事｜領教材 示範課｜新增任務 準備教案｜我的任務｜完成 T編號｜報名 示範課｜我的積分｜提醒 2026-11-01 18:00 複習族語｜我的週報｜考前複習 招呼';
}

/** 不串接 LINE 即可在 Apps Script 執行的自動測試 */
function testLocally(){Logger.log(command_('查單字 你好','TEACHER_DEMO'));Logger.log(command_('課程','TEACHER_DEMO'));Logger.log(command_('每日一句','TEACHER_DEMO'));}
/** 每5分鐘觸發；推播前請確認 LINE 對方已加入好友，且符合發訊規則 */
function sendDueReminders(){const sh=tab_('reminders'),all=sh.getDataRange().getValues().slice(1),now=Date.now();all.forEach((r,i)=>{const due=new Date(r[3]).getTime();if(r[4]==='待發送'&&Number.isFinite(due)&&due<=now){try{push_(r[1],'提醒：'+r[2]);sh.getRange(i+2,5).setValue('已發送');}catch(err){console.error(err);}}});}
function installReminderTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sendDueReminders').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('sendDueReminders').timeBased().everyMinutes(5).create();}
