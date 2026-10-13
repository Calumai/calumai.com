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
