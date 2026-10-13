/** 不串接 LINE 即可在 Apps Script 執行的自動測試 */
function testLocally(){Logger.log(command_('查單字 你好','TEACHER_DEMO'));Logger.log(command_('課程','TEACHER_DEMO'));Logger.log(command_('每日一句','TEACHER_DEMO'));}
/** 每5分鐘觸發；推播前請確認 LINE 對方已加入好友，且符合發訊規則 */
function sendDueReminders(){const sh=tab_('reminders'),all=sh.getDataRange().getValues().slice(1),now=Date.now();all.forEach((r,i)=>{const due=new Date(r[3]).getTime();if(r[4]==='待發送'&&Number.isFinite(due)&&due<=now){try{push_(r[1],'提醒：'+r[2]);sh.getRange(i+2,5).setValue('已發送');}catch(err){console.error(err);}}});}
function installReminderTrigger(){ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sendDueReminders').forEach(t=>ScriptApp.deleteTrigger(t));ScriptApp.newTrigger('sendDueReminders').timeBased().everyMinutes(5).create();}
