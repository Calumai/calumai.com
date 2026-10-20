/**
 * LINE × GAS 入門範例：課程行事曆、學生通知、隨機測驗、單詞表、每日一句。
 * 從「自己的 Google 試算表 → 擴充功能 → Apps Script」建立綁定專案。
 * 第一次先執行 setup；LINE Channel access token 只放在指令碼屬性 LINE_ACCESS_TOKEN。
 *
 * 課堂示範提醒：Apps Script Web App 無法取得 X-Line-Signature 標頭，因此無法驗證
 * LINE Webhook 來源。不要在 doPost 裡加入群發、管理或讀取私人資料的指令。
 */
const TIME_ZONE = 'Asia/Taipei';
const MAX_PUSH_PER_RUN = 20;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const QUIZ_TTL_SECONDS = 6 * 60 * 60;
const COLUMNS = {
  '學生': ['LINE使用者ID', '訂閱狀態', '加入時間', '更新時間'],
  '行事曆': ['活動ID', '課程名稱', '開始時間', '地點', '備註', '提醒時間', '啟用'],
  '單詞表': ['單詞ID', '中文', '族語', '例句', '例句翻譯', '音檔網址', '啟用'],
  '每日一句': ['日期', '族語句子', '中文翻譯', '音檔網址', '啟用'],
  '題庫': ['題號', '題目', '選項A', '選項B', '選項C', '正解', '解說', '啟用'],
  '通知': ['通知ID', '發送時間', '內容', '啟用'],
  '發送紀錄': ['來源ID', 'LINE使用者ID', '發送時間', '結果']
};

/** 只需第一次執行；重跑不會清空學生填好的資料。 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('請先從「自己的試算表 → 擴充功能 → Apps Script」開啟程式。');
  const first = ss.getSheets()[0];
  if (ss.getSheets().length === 1 && first.getLastRow() === 0 && !ss.getSheetByName('學生')) {
    first.setName('學生');
  }
  ss.setSpreadsheetTimeZone(TIME_ZONE);
  Object.keys(COLUMNS).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = COLUMNS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dff4e8');
    } else {
      const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
      if (headers.some((header, index) => actual[index] !== header)) {
        throw new Error('「' + name + '」欄名與範例不符，請確認沒有貼到舊版工作表。');
      }
    }
  });
  const questions = ss.getSheetByName('題庫');
  if (questions.getLastRow() === 1) {
    [
      ['Q001', '一天有幾小時？', '24', '12', '36', 'A', '一天有 24 小時。', '是'],
      ['Q002', '下列哪個是水果？', '書本', '蘋果', '鉛筆', 'B', '蘋果是水果。', '是'],
      ['Q003', '2 加 3 等於多少？', '4', '6', '5', 'C', '2 加 3 等於 5。', '是']
    ].forEach(row => questions.appendRow(row));
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('setup 完成：已連接「' + ss.getName() + '」，確認 7 張教學分頁。');
}

/** 設好 LINE_ACCESS_TOKEN 後執行，確認工作表與權杖有效。 */
function checkSetup() {
  const ss = book_();
  Object.keys(COLUMNS).forEach(name => {
    if (!ss.getSheetByName(name)) throw new Error('缺少「' + name + '」分頁，請先執行 setup。');
  });
  if (Session.getScriptTimeZone() !== TIME_ZONE) {
    throw new Error('請到左側「專案設定」把指令碼時區改成 Asia/Taipei。');
  }
  const token = token_();
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
    method: 'get', headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('LINE 權杖檢查失敗（HTTP ' + response.getResponseCode() + '），請檢查指令碼屬性 LINE_ACCESS_TOKEN。');
  }
  Logger.log('checkSetup 完成：工作表、時區與 LINE 權杖都可使用。');
}

/** 安裝每 15 分鐘檢查一次的觸發器；重跑不會重複安裝。 */
function installTrigger() {
  book_();
  token_();
  const exists = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === 'sendDueNotifications'
  );
  if (!exists) ScriptApp.newTrigger('sendDueNotifications').timeBased().everyMinutes(15).create();
  Logger.log(exists ? '觸發器已存在，不需重複建立。' : '已建立每 15 分鐘執行的通知觸發器。');
}

/** LINE Webhook：只處理一對一對話，不提供任何群發或管理指令。 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return ok_();
    const body = JSON.parse(e.postData.contents);
    if (!Array.isArray(body.events)) return ok_();
    body.events.forEach(event => {
      try {
        const source = event.source || {};
        if (source.type !== 'user' || !/^U[0-9a-f]{32}$/i.test(String(source.userId || ''))) return;
        const uid = source.userId;
        if (event.type === 'unfollow') {
          setSubscription_(uid, false);
          return;
        }
        if (!event.replyToken) return;
        if (event.type === 'follow') {
          reply_(event.replyToken, '歡迎！傳「訂閱」即可接收課程通知；傳「說明」看指令。');
          return;
        }
        if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;
        let answer;
        try {
          answer = command_(String(event.message.text || '').trim(), uid);
        } catch (error) {
          console.error('指令處理失敗：' + safeError_(error));
          answer = '系統暫時無法處理，請稍後再試。';
        }
        reply_(event.replyToken, answer);
      } catch (error) {
        console.error('Webhook 單筆事件處理失敗：' + safeError_(error));
      }
    });
  } catch (error) {
    console.error('Webhook 格式錯誤：' + safeError_(error));
  }
  return ok_();
}

function doGet() {
  return HtmlService.createHtmlOutput('LINE × GAS 教學版已部署。');
}

/** 老師可手動執行，也會由觸發器執行。每次最多嘗試 20 則。 */
function sendDueNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('已有通知工作執行中，本次略過。');
    return;
  }
  try {
    const now = new Date();
    const jobs = dueJobs_(now);
    const students = rows_('學生')
      .filter(item => isEnabled_(item.values[1]))
      .map(item => String(item.values[0] || '').trim())
      .filter(uid => /^U[0-9a-f]{32}$/i.test(uid));
    const logSheet = sheet_('發送紀錄');
    const previous = new Map();
    const successes = new Set();
    rows_('發送紀錄').forEach(item => {
      const key = String(item.values[0]) + '\t' + String(item.values[1]);
      previous.set(key, item.rowNumber);
      if (item.values[3] === '成功') successes.add(key);
    });
    let attempts = 0;
    let sent = 0;
    let reachedLimit = false;
    outer: for (const job of jobs) {
      for (const uid of students) {
        const key = job.id + '\t' + uid;
        if (successes.has(key)) continue;
        if (attempts >= MAX_PUSH_PER_RUN) {
          reachedLimit = true;
          break outer;
        }
        attempts++;
        let result = '成功';
        try {
          push_(uid, job.text);
          sent++;
          successes.add(key);
        } catch (error) {
          result = '失敗：' + safeError_(error);
        }
        const entry = [job.id, uid, new Date(), result];
        if (previous.has(key)) {
          logSheet.getRange(previous.get(key), 1, 1, entry.length).setValues([entry]);
        } else {
          logSheet.appendRow(entry);
          previous.set(key, logSheet.getLastRow());
        }
      }
    }
    Logger.log('本次嘗試 ' + attempts + ' 則，成功 ' + sent + ' 則。');
    if (reachedLimit) Logger.log('已達每次 20 則上限；其餘下次再處理。課程開始後不補發提醒。');
  } finally {
    lock.releaseLock();
  }
}

function command_(text, uid) {
  if (text === '說明' || text === 'help' || text === '') {
    return '可用指令：\n訂閱／取消訂閱：接收或停止課程通知\n行事曆：查看最近 5 堂課\n單詞表：查看前 5 筆單詞\n查單詞 蘋果：查詢單詞（也可輸入族語或單詞ID）\n每日一句：查看老師為今天設定的句子\n測驗：隨機抽 1 題\n答 A、答 B、答 C：回答目前題目';
  }
  if (text === '訂閱') return setSubscription_(uid, true);
  if (text === '取消訂閱') return setSubscription_(uid, false);
  if (text === '行事曆') return calendarText_();
  if (text === '單詞表') return wordListText_();
  if (text === '查單詞' || text === '查單字') return '請在指令後面加上想查的中文、族語或單詞ID，例如「查單詞 蘋果」。';
  const wordQuery = text.match(/^查單[詞字]\s+(.+)$/);
  if (wordQuery) return wordText_(wordQuery[1]);
  if (text === '每日一句') return dailySentenceText_();
  if (text === '測驗') return startQuiz_(uid);
  const answer = text.match(/^(?:答\s*)?([ABC])$/i);
  if (answer) return answerQuiz_(uid, answer[1].toUpperCase());
  return '我還不認得這個指令。傳「說明」可以查看可用指令。';
}

function setSubscription_(uid, enabled) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('學生資料忙碌，請稍後再試。');
  try {
    const sheet = sheet_('學生');
    const found = rows_('學生').find(item => item.values[0] === uid);
    const now = new Date();
    if (found) {
      sheet.getRange(found.rowNumber, 2).setValue(enabled ? '是' : '否');
      sheet.getRange(found.rowNumber, 4).setValue(now);
    } else if (enabled) {
      sheet.appendRow([uid, '是', now, now]);
    }
    return enabled ? '訂閱成功！有課程通知時會傳給你。' : '已取消訂閱，不會再收到課程通知。';
  } finally {
    lock.releaseLock();
  }
}

function calendarText_() {
  const now = new Date();
  const events = rows_('行事曆')
    .map(item => item.values)
    .filter(row => isEnabled_(row[6]) && validDate_(row[2]) && row[2] > now && String(row[1]).trim())
    .sort((a, b) => a[2] - b[2])
    .slice(0, 5);
  if (!events.length) return '目前沒有即將開始的課程。老師可在試算表的「行事曆」分頁新增。';
  return '最近課程：\n' + events.map(row => {
    const place = String(row[3] || '').trim();
    const note = String(row[4] || '').trim();
    return '・' + formatDate_(row[2]) + '｜' + row[1] +
      (place ? '｜' + place : '') + (note ? '\n  ' + note : '');
  }).join('\n');
}

/** 先顯示少量單詞，避免長列表在 LINE 裡難以閱讀。 */
function wordListText_() {
  const words = rows_('單詞表').map(item => item.values).filter(row =>
    isEnabled_(row[6]) && String(row[1] || '').trim() && String(row[2] || '').trim()
  ).slice(0, 5);
  if (!words.length) return '單詞表目前沒有啟用的單詞。請老師先在試算表新增。';
  return '單詞表（前 5 筆）：\n' +
    words.map(row => '・' + row[1] + ' → ' + row[2]).join('\n') +
    '\n想找其他單詞？傳「查單詞 蘋果」。';
}

/** 老師在「單詞表」填資料後，學生用中文、族語或單詞ID查詢。 */
function wordText_(input) {
  const query = String(input || '').trim().toLocaleLowerCase();
  if (!query) return '請輸入想查的中文、族語或單詞ID，例如「查單詞 蘋果」。';
  const words = rows_('單詞表').map(item => item.values).filter(row =>
    isEnabled_(row[6]) && String(row[1] || '').trim() && String(row[2] || '').trim()
  );
  const searchFields = row => [row[0], row[1], row[2]].map(value =>
    String(value || '').trim().toLocaleLowerCase()
  );
  const match = words.find(row => searchFields(row).includes(query)) ||
    words.find(row => searchFields(row).some(value => value.includes(query)));
  if (!match) return '找不到「' + String(input).trim().slice(0, 80) + '」。請試試其他中文、族語或單詞ID。';
  const example = String(match[3] || '').trim();
  const translation = String(match[4] || '').trim();
  const audio = audioUrl_(match[5]);
  return '單詞｜' + match[1] + ' → ' + match[2] +
    (example ? '\n例句：' + example : '') +
    (translation ? '\n例句翻譯：' + translation : '') +
    (audio ? '\n聽音檔：' + audio : '');
}

/** 只顯示老師設定給台北「今天」的句子；沒有資料時不借用其他日期。 */
function dailySentenceText_() {
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const row = rows_('每日一句').map(item => item.values).find(values =>
    isEnabled_(values[4]) && validDate_(values[0]) &&
    Utilities.formatDate(values[0], TIME_ZONE, 'yyyy-MM-dd') === today &&
    String(values[1] || '').trim()
  );
  if (!row) return '老師今天還沒有設定「每日一句」，請稍後再看看。';
  const translation = String(row[2] || '').trim();
  const audio = audioUrl_(row[3]);
  return '每日一句｜' + today + '\n' + row[1] +
    (translation ? '\n中文：' + translation : '') +
    (audio ? '\n聽音檔：' + audio : '');
}

function audioUrl_(value) {
  const url = String(value || '').trim();
  return /^https:\/\/[^\s]+$/i.test(url) ? url : '';
}

function startQuiz_(uid) {
  const questions = rows_('題庫').map(item => item.values).filter(row =>
    isEnabled_(row[7]) && String(row[0]).trim() && String(row[1]).trim() &&
    [row[2], row[3], row[4]].every(value => String(value).trim()) &&
    /^[ABC]$/.test(String(row[5]).trim().toUpperCase())
  );
  if (!questions.length) return '題庫目前沒有啟用的題目，請老師先填入題目。';
  const row = questions[Math.floor(Math.random() * questions.length)];
  const session = {
    id: String(row[0]), correct: String(row[5]).trim().toUpperCase(),
    explanation: String(row[6] || '').trim()
  };
  CacheService.getScriptCache().put('quiz:' + uid, JSON.stringify(session), QUIZ_TTL_SECONDS);
  return '隨機測驗｜' + row[1] + '\nA. ' + row[2] + '\nB. ' + row[3] +
    '\nC. ' + row[4] + '\n請回覆「答 A」「答 B」或「答 C」。';
}

function answerQuiz_(uid, choice) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get('quiz:' + uid);
  if (!raw) return '目前沒有待回答的題目，或題目已過期。請傳「測驗」重新抽題。';
  cache.remove('quiz:' + uid);
  const session = JSON.parse(raw);
  return (choice === session.correct ? '答對了！' : '再練習一下！') +
    '\n正確答案：' + session.correct +
    (session.explanation ? '\n解說：' + session.explanation : '') +
    '\n傳「測驗」可再抽一題。';
}

function dueJobs_(now) {
  const jobs = [];
  rows_('行事曆').forEach(item => {
    const row = item.values;
    const id = String(row[0] || '').trim();
    const title = String(row[1] || '').trim();
    const start = row[2];
    const reminder = row[5];
    if (!id || !title || !isEnabled_(row[6]) || !validDate_(start) || !validDate_(reminder)) return;
    if (start <= now || reminder >= start || reminder > now || now - reminder > ONE_DAY_MS) return;
    const place = String(row[3] || '').trim();
    jobs.push({id: '行事曆:' + id, due: reminder, priority: 0,
      text: '課程提醒｜' + title + '\n時間：' + formatDate_(start) +
        (place ? '\n地點：' + place : '')});
  });
  rows_('通知').forEach(item => {
    const row = item.values;
    const id = String(row[0] || '').trim();
    const due = row[1];
    const content = String(row[2] || '').trim();
    if (!id || !content || !isEnabled_(row[3]) || !validDate_(due)) return;
    if (due > now || now - due > ONE_DAY_MS) return;
    jobs.push({id: '通知:' + id, due, priority: 1, text: content});
  });
  return jobs.sort((a, b) => a.priority - b.priority || a.due - b.due);
}

function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('尚未連接試算表，請先執行 setup。');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  const sheet = book_().getSheetByName(name);
  if (!sheet) throw new Error('缺少「' + name + '」分頁，請先執行 setup。');
  return sheet;
}

function rows_(name) {
  const sheet = sheet_(name);
  const count = sheet.getLastRow() - 1;
  if (count <= 0) return [];
  return sheet.getRange(2, 1, count, COLUMNS[name].length).getValues()
    .map((values, index) => ({rowNumber: index + 2, values}));
}

function token_() {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN');
  if (!token) throw new Error('請到「專案設定 → 指令碼屬性」新增 LINE_ACCESS_TOKEN。');
  return token;
}

function sendLine_(kind, data) {
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/' + kind, {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + token_()},
    payload: JSON.stringify(data), muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('LINE API HTTP ' + code);
}

function reply_(replyToken, text) {
  sendLine_('reply', {replyToken, messages: [{type: 'text', text: String(text).slice(0, 4900)}]});
}

function push_(uid, text) {
  sendLine_('push', {to: uid, messages: [{type: 'text', text: String(text).slice(0, 4900)}]});
}

function ok_() { return HtmlService.createHtmlOutput('OK'); }
function validDate_(value) { return value instanceof Date && !Number.isNaN(value.getTime()); }
function isEnabled_(value) {
  return value === true || ['是', 'true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());
}
function formatDate_(value) { return Utilities.formatDate(value, TIME_ZONE, 'yyyy/MM/dd HH:mm'); }
function safeError_(error) {
  // 不將 LINE 回應內文或 Authorization bearer token 寫進紀錄。
  const message = error && error.message ? String(error.message) : '未知錯誤';
  const token = PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN');
  return (token ? message.split(token).join('[已遮蔽]') : message).slice(0, 120);
}
