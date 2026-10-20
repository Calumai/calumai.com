/**
 * 加到「已完成 setup 的同一個學生版 Apps Script 專案」的新檔案。
 * 不必修改原本 Code.gs。選取「通知」的一列後，從選單或繪圖按鈕執行。
 * 「成功」只表示 LINE API 接受請求，不保證學生已讀或實際送達。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('LINE 通知')
    .addItem('立即發送選取的通知', 'sendSelectedNoticeNow')
    .addToUi();
}

/** 可在試算表繪圖／圖片的「指派指令碼」填入 sendSelectedNoticeNow。 */
function sendSelectedNoticeNow() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('請從已綁定的 Google 試算表執行。');
    const configuredId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (configuredId && configuredId !== spreadsheet.getId()) {
      throw new Error('目前試算表與原本 setup 連接的試算表不同，請回到原本的試算表。');
    }
    const noticeSheet = immediateSheet_(spreadsheet, '通知', ['通知ID', '發送時間', '內容', '啟用']);
    const studentsSheet = immediateSheet_(spreadsheet, '學生', ['LINE使用者ID', '訂閱狀態', '加入時間', '更新時間']);
    const logSheet = immediateSheet_(spreadsheet, '發送紀錄', ['來源ID', 'LINE使用者ID', '發送時間', '結果']);
    const selected = spreadsheet.getActiveRange();
    if (spreadsheet.getActiveSheet().getName() !== '通知' || !selected ||
        selected.getNumRows() !== 1 || selected.getRow() < 2) {
      throw new Error('請先到「通知」分頁，點選第 2 列起的一個資料列；一次只能選一列。');
    }
    const rowNumber = selected.getRow();
    const preview = immediateNotice_(noticeSheet, rowNumber);
    const recipients = immediateRecipients_(studentsSheet);
    if (!recipients.length) throw new Error('目前沒有「學生」分頁中訂閱狀態為「是」的有效 LINE 使用者ID。');
    const successful = immediateSuccessful_(logSheet, preview.id);
    const pending = recipients.filter(uid => !successful.has(uid));
    if (!pending.length) {
      ui.alert('這筆通知已完成', '有效訂閱者 ' + recipients.length + ' 人都已有成功紀錄，不會重複發送。', ui.ButtonSet.OK);
      return;
    }
    const answer = ui.alert('確認立即發送',
      '通知ID：' + preview.id + '\n內容：\n' + preview.text +
      '\n\n有效訂閱者：' + recipients.length + ' 人' +
      '\n已有成功紀錄：' + (recipients.length - pending.length) + ' 人' +
      '\n這次最多嘗試：' + Math.min(20, pending.length) + ' 人' +
      (pending.length > 20 ? '\n剩餘的人可再按一次；若已安裝原排程，也會接續處理。' : '') +
      '\n\n確定要發送嗎？', ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    // 與既有 sendDueNotifications() 使用同一把 ScriptLock；確認後重新讀資料。
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error('另一個通知工作正在執行，請稍後再按一次。');
    let resultTitle;
    let resultMessage;
    try {
      const current = immediateNotice_(noticeSheet, rowNumber);
      if (current.id !== preview.id || current.text !== preview.text) {
        throw new Error('確認期間這列的通知ID或內容已更改，請重新預覽後再發送。');
      }
      const token = PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN');
      if (!token) throw new Error('請先到「專案設定 → 指令碼屬性」設定 LINE_ACCESS_TOKEN。');
      const currentRecipients = immediateRecipients_(studentsSheet);
      if (currentRecipients.length !== recipients.length ||
          currentRecipients.some(uid => !recipients.includes(uid))) {
        throw new Error('確認期間有效訂閱名單已更改，請重新預覽人數後再發送。');
      }
      const sent = immediateSuccessful_(logSheet, current.id);
      const previousRows = immediateLogRows_(logSheet, current.id);
      const remaining = currentRecipients.filter(uid => !sent.has(uid));
      if (!remaining.length) {
        resultTitle = '這筆通知已完成';
        resultMessage = '目前所有有效訂閱者都有成功紀錄，不會重複發送。';
      } else {
        noticeSheet.getRange(rowNumber, 2).setValue(new Date());
        let accepted = 0;
        let failed = 0;
        // 先處理還沒有紀錄的人，避免持續失敗的帳號占滿每次 20 次的額度。
        const neverTried = remaining.filter(uid => !previousRows.has('通知:' + current.id + '\t' + uid));
        const retry = remaining.filter(uid => previousRows.has('通知:' + current.id + '\t' + uid));
        const batch = neverTried.concat(retry).slice(0, 20);
        batch.forEach(uid => {
          let result = '成功';
          try {
            const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
              method: 'post', contentType: 'application/json',
              headers: {Authorization: 'Bearer ' + token},
              payload: JSON.stringify({to: uid, messages: [{type: 'text', text: current.text}]}),
              muteHttpExceptions: true
            });
            const status = response.getResponseCode();
            if (status < 200 || status >= 300) throw new Error('LINE API HTTP ' + status);
            accepted++;
          } catch (error) {
            failed++;
            result = '失敗：' + immediateSafeError_(error, token);
          }
          // 沿用原排程的「通知:<id> + 使用者ID」去重鍵，失敗列可由下次覆寫重試。
          const key = '通知:' + current.id + '\t' + uid;
          const entry = ['通知:' + current.id, uid, new Date(), result];
          if (previousRows.has(key)) {
            logSheet.getRange(previousRows.get(key), 1, 1, 4).setValues([entry]);
          } else {
            logSheet.appendRow(entry);
            previousRows.set(key, logSheet.getLastRow());
          }
        });
        const waiting = remaining.length - accepted;
        resultTitle = '立即發送結果';
        resultMessage = 'LINE API 已接受：' + accepted + ' 人' +
          '\n失敗：' + failed + ' 人' +
          '\n先前已成功而略過：' + (currentRecipients.length - remaining.length) + ' 人' +
          '\n仍待處理：' + waiting + ' 人' +
          (remaining.length > 20 ? '\n本次已達 20 次推送嘗試上限。' : '') +
          '\n可再次執行，續送尚無成功紀錄的人。\n「成功」不代表已讀或保證送達。';
        Logger.log('立即發送通知 ' + current.id + '：接受 ' + accepted + '，失敗 ' + failed + '，待處理 ' + waiting);
      }
    } finally {
      lock.releaseLock();
    }
    ui.alert(resultTitle, resultMessage, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('無法立即發送', immediateSafeError_(error), ui.ButtonSet.OK);
  }
}

function immediateSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('缺少「' + name + '」分頁，請先執行原本 Code.gs 的 setup。');
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some((header, index) => actual[index] !== header)) {
    throw new Error('「' + name + '」欄名不符合原本七分頁範例，請先檢查第 1 列。');
  }
  return sheet;
}

function immediateNotice_(sheet, rowNumber) {
  if (rowNumber > sheet.getLastRow()) throw new Error('選到空白列，請改選已有資料的通知列。');
  const row = sheet.getRange(rowNumber, 1, 1, 4).getValues()[0];
  const id = String(row[0] || '').trim();
  const text = String(row[2] || '').trim();
  if (!id || !text || !immediateEnabled_(row[3])) {
    throw new Error('這列需要 A 欄通知ID、C 欄內容，且 D 欄「啟用」填「是」或勾選核取方塊。');
  }
  if (text.length > 4900) throw new Error('通知內容超過 4900 字，請縮短後再發送。');
  const count = sheet.getLastRow() - 1;
  const ids = sheet.getRange(2, 1, count, 1).getValues()
    .filter(values => String(values[0] || '').trim() === id);
  if (ids.length !== 1) throw new Error('通知ID「' + id + '」重複；請先給每列不同的 ID。');
  return {id, text};
}

function immediateRecipients_(sheet) {
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return [];
  const rows = sheet.getRange(2, 1, count, 2).getValues();
  const unique = new Set();
  rows.forEach(row => {
    const uid = String(row[0] || '').trim();
    const enabled = immediateEnabled_(row[1]);
    if (enabled && /^U[0-9a-f]{32}$/i.test(uid)) unique.add(uid);
  });
  return Array.from(unique);
}

function immediateEnabled_(value) {
  return value === true || ['是', 'true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());
}

function immediateLogRows_(sheet, id) {
  const count = sheet.getLastRow() - 1;
  const previous = new Map();
  if (count <= 0) return previous;
  sheet.getRange(2, 1, count, 4).getValues().forEach((row, index) => {
    if (row[0] === '通知:' + id) previous.set(String(row[0]) + '\t' + String(row[1]), index + 2);
  });
  return previous;
}

function immediateSuccessful_(sheet, id) {
  const count = sheet.getLastRow() - 1;
  const successful = new Set();
  if (count <= 0) return successful;
  sheet.getRange(2, 1, count, 4).getValues().forEach(row => {
    if (row[0] === '通知:' + id && row[3] === '成功') successful.add(String(row[1]));
  });
  return successful;
}

function immediateSafeError_(error, knownToken) {
  let message = error && error.message ? String(error.message) : '未知錯誤';
  const token = knownToken || PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN');
  if (token) message = message.split(token).join('[已遮蔽]');
  return message.slice(0, 180);
}
