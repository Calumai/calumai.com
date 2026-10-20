/**
 * LINE × GAS 老師課務助理（不使用 AI API）。
 * 這是「老師專用」的獨立 Apps Script 專案，與學生版共用同一份試算表。
 * LINE Webhook 只回傳 Google 表單入口；只有表單提交觸發器能寫入課務資料。
 *
 * 只改下面兩行。LINE 權杖另放在「專案設定 → 指令碼屬性」LINE_ACCESS_TOKEN。
 */
const TEACHER_SHEET_INPUT = '請貼上學生版試算表的完整網址或 ID';
const TEACHER_EMAIL_INPUT = '請填老師自己的 Google 帳號 Email';

const TEACHER_TIME_ZONE = 'Asia/Taipei';
const TEACHER_LOG_HEADERS = ['處理時間', '表單', '回覆ID', '填答帳號', '結果', '說明'];
const TEACHER_REQUIRED_SHEETS = {
  '學生': ['LINE使用者ID', '訂閱狀態', '加入時間', '更新時間'],
  '行事曆': ['活動ID', '課程名稱', '開始時間', '地點', '備註', '提醒時間', '啟用'],
  '單詞表': ['單詞ID', '中文', '族語', '例句', '例句翻譯', '音檔網址', '啟用'],
  '每日一句': ['日期', '族語句子', '中文翻譯', '音檔網址', '啟用'],
  '題庫': ['題號', '題目', '選項A', '選項B', '選項C', '正解', '解說', '啟用'],
  '通知': ['通知ID', '發送時間', '內容', '啟用'],
  '發送紀錄': ['來源ID', 'LINE使用者ID', '發送時間', '結果']
};
const TEACHER_NOTICE_CONFIRM = '我已確認，這則通知會傳給已訂閱的學生';
const TEACHER_FORMS = {
  class: {
    property: 'TEACHER_FORM_CLASS', title: '老師新增課程', sheet: '行事曆',
    fields: [
      ['課程名稱', 'text', true], ['開始時間', 'datetime', true],
      ['地點', 'text', false], ['備註', 'paragraph', false], ['提醒時間', 'datetime', false]
    ]
  },
  word: {
    property: 'TEACHER_FORM_WORD', title: '老師新增單詞', sheet: '單詞表',
    fields: [
      ['中文', 'text', true], ['族語', 'text', true], ['例句', 'paragraph', false],
      ['例句翻譯', 'paragraph', false], ['音檔網址', 'text', false]
    ]
  },
  daily: {
    property: 'TEACHER_FORM_DAILY', title: '老師新增每日一句', sheet: '每日一句',
    fields: [
      ['日期', 'date', true], ['族語句子', 'paragraph', true],
      ['中文翻譯', 'paragraph', true], ['音檔網址', 'text', false]
    ]
  },
  notice: {
    property: 'TEACHER_FORM_NOTICE', title: '老師新增通知', sheet: '通知',
    fields: [
      ['發送時間', 'datetime', true], ['內容', 'paragraph', true],
      [TEACHER_NOTICE_CONFIRM, 'checkbox', true]
    ]
  }
};

/**
 * 第一次執行：檢查學生版的 7 個分頁，建立 4 個「未發布」表單與觸發器。
 * 重跑會沿用既有表單及觸發器，不清空任何資料。
 */
function setupTeacher() {
  if (Session.getScriptTimeZone() !== TEACHER_TIME_ZONE) {
    throw new Error('請先到「專案設定 → 時區」選擇 Asia/Taipei，再執行 setupTeacher。');
  }
  const id = spreadsheetIdFromInput_(TEACHER_SHEET_INPUT);
  const email = teacherEmailFromInput_(TEACHER_EMAIL_INPUT);
  const executor = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!executor || executor !== email) {
    throw new Error('TEACHER_EMAIL_INPUT 必須和目前執行 Apps Script 的 Google 帳號相同，請確認登入帳號與 Email。');
  }
  const props = teacherProperties_();
  const oldId = props.getProperty('TEACHER_SPREADSHEET_ID');
  const oldEmail = props.getProperty('TEACHER_EMAIL');
  if (oldId && oldId !== id) throw new Error('這個專案已連到另一份試算表。請另建老師版 Apps Script 專案，避免舊表單寫錯地方。');
  if (oldEmail && oldEmail !== email) throw new Error('這個專案已設定另一位老師。請另建專案，避免舊表單權限寫錯。');
  const ss = SpreadsheetApp.openById(id);
  checkStudentSheets_(ss);
  props.setProperty('TEACHER_SPREADSHEET_ID', id);
  props.setProperty('TEACHER_EMAIL', email);
  ensureTeacherLog_(ss);

  Object.keys(TEACHER_FORMS).forEach(kind => {
    const spec = TEACHER_FORMS[kind];
    let form;
    const formId = props.getProperty(spec.property);
    if (formId) {
      form = FormApp.openById(formId);
    } else {
      // Google 官方支援第二個參數 false：表單先保持未發布。
      form = FormApp.create(spec.title, false);
      props.setProperty(spec.property, form.getId());
    }
    configureTeacherForm_(form, spec, ss, email);
    const exists = ScriptApp.getProjectTriggers().some(trigger =>
      trigger.getHandlerFunction() === 'teacherFormSubmit' &&
      trigger.getTriggerSourceId() === form.getId()
    );
    if (!exists) ScriptApp.newTrigger('teacherFormSubmit').forForm(form).onFormSubmit().create();
    Logger.log(spec.title + '（編輯）' + form.getEditUrl());
  });
  Logger.log('setupTeacher 完成。請逐一確認四份表單「一般存取權：受限」與「收集 Email：已驗證」，只讓老師填寫；全部發布後再執行 enableTeacherLinks。');
}

/**
 * 老師親自檢查四份表單的「受限／已驗證 Email」設定並發布之後才執行。
 * FormApp 無法完整讀取 Google 表單畫面上的「一般存取權」及 Email 模式；
 * 因此這一步也代表老師已完成畫面上的權限確認。
 */
function enableTeacherLinks() {
  const ss = teacherBook_();
  checkStudentSheets_(ss);
  const email = teacherEmail_();
  Object.keys(TEACHER_FORMS).forEach(kind => checkTeacherForm_(kind, ss, email));
  teacherProperties_().setProperty('TEACHER_LINKS_ENABLED', 'yes');
  Logger.log('四份表單已通過程式可檢查的條件。老師完成存取權目視確認後，LINE 已可顯示表單連結。');
}

/** 設好 LINE_ACCESS_TOKEN 後執行，檢查表單、共用試算表及老師 LINE 權杖。 */
function checkTeacherSetup() {
  if (Session.getScriptTimeZone() !== TEACHER_TIME_ZONE) throw new Error('指令碼時區必須是 Asia/Taipei。');
  const ss = teacherBook_();
  checkStudentSheets_(ss);
  const email = teacherEmail_();
  if (teacherProperties_().getProperty('TEACHER_LINKS_ENABLED') !== 'yes') {
    throw new Error('請先檢查、發布四份老師表單，再執行 enableTeacherLinks。');
  }
  Object.keys(TEACHER_FORMS).forEach(kind => checkTeacherForm_(kind, ss, email));
  const result = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', {
    method: 'get',
    headers: {Authorization: 'Bearer ' + teacherToken_()},
    muteHttpExceptions: true
  });
  if (result.getResponseCode() !== 200) {
    throw new Error('老師 LINE 權杖無效（HTTP ' + result.getResponseCode() + '）。請檢查指令碼屬性 LINE_ACCESS_TOKEN。');
  }
  Logger.log('checkTeacherSetup 完成：同一份試算表、四份表單、LINE 權杖皆通過檢查。');
}

/**
 * LINE 只顯示表單入口，不從 webhook 修改課務資料。
 * GAS Web App 無法讀取 X-Line-Signature 標頭，所以不能驗證 webhook 來源。
 * 真正的新增權限由 Google 表單的登入限制與「已驗證」教師 Email 決定。
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return teacherOk_();
    const payload = JSON.parse(e.postData.contents);
    if (!Array.isArray(payload.events)) return teacherOk_();
    payload.events.forEach(event => {
      try {
        if (!event.source || event.source.type !== 'user') return;
        if (!event.replyToken || event.type !== 'message' || !event.message || event.message.type !== 'text') return;
        const answer = teacherCommand_(String(event.message.text || '').trim());
        teacherReply_(event.replyToken, answer);
      } catch (error) {
        console.error('老師 LINE 回覆失敗：' + teacherSafeError_(error));
      }
    });
  } catch (error) {
    console.error('老師 LINE Webhook 格式錯誤：' + teacherSafeError_(error));
  }
  return teacherOk_();
}

function doGet() {
  return HtmlService.createHtmlOutput('老師課務助理已部署；新增課務請從 LINE 開啟教師表單。');
}

function teacherCommand_(text) {
  const commands = {
    '新增課程': 'class', '新增課表': 'class',
    '新增單詞': 'word', '新增每日一句': 'daily', '新增通知': 'notice'
  };
  if (!text || text === '說明' || text === '選單' || text.toLowerCase() === 'help') {
    return '老師課務助理可用指令：\n新增課程／新增課表\n新增單詞\n新增每日一句\n新增通知\n點開連結後，請用老師的 Google 帳號登入並送出表單。';
  }
  const kind = commands[text];
  if (!kind) return '我不認得這個指令。傳「說明」查看可用功能。';
  if (teacherProperties_().getProperty('TEACHER_LINKS_ENABLED') !== 'yes') {
    return '教師表單尚未啟用。請先在 Apps Script 執行 setupTeacher，檢查並發布四份受限表單，再執行 enableTeacherLinks。';
  }
  const spec = TEACHER_FORMS[kind];
  const formId = teacherProperties_().getProperty(spec.property);
  if (!formId) return '還沒找到教師表單。請先執行 setupTeacher。';
  let form;
  try {
    form = checkTeacherForm_(kind, teacherBook_(), teacherEmail_());
  } catch (error) {
    return '這份表單目前不可使用。請到 Apps Script 執行 checkTeacherSetup。';
  }
  return spec.title + '：\n' + form.getPublishedUrl() + '\n請用老師 Google 帳號登入填寫；送出後到試算表「老師表單紀錄」查看處理結果。';
}

/** 必須由「表單」提交觸發器呼叫；不要在編輯器直接按執行。 */
function teacherFormSubmit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('課務資料忙碌，請稍後查看執行紀錄並重試。');
  let formId = '';
  let responseId = '';
  let email = '';
  try {
    if (!e || !e.source || !e.response || !e.source.getId || !e.response.getId) {
      throw new Error('只接受 Google 表單提交觸發器事件。');
    }
    formId = String(e.source.getId());
    responseId = String(e.response.getId() || '');
    email = String(e.response.getRespondentEmail() || '').trim().toLowerCase();
    if (!responseId) throw new Error('這筆表單回覆沒有 ID，無法防止重複寫入。');
    const kind = Object.keys(TEACHER_FORMS).find(key =>
      teacherProperties_().getProperty(TEACHER_FORMS[key].property) === formId
    );
    if (!kind) throw new Error('不是本專案建立的教師表單。');
    checkTeacherForm_(kind, teacherBook_(), teacherEmail_());
    if (!email || email !== teacherEmail_()) throw new Error('填答者不是設定的老師 Google 帳號，拒絕寫入。');
    const prior = findTeacherLog_(formId, responseId);
    if (prior && prior.values[4] === '成功') return;
    const answers = {};
    e.response.getItemResponses().forEach(item => {
      answers[item.getItem().getTitle()] = item.getResponse();
    });
    writeTeacherAnswer_(kind, responseId, answers);
    upsertTeacherLog_(formId, responseId, email, '成功', TEACHER_FORMS[kind].sheet + ' 已更新');
  } catch (error) {
    if (formId && responseId) {
      try { upsertTeacherLog_(formId, responseId, email, '拒絕／失敗', teacherSafeError_(error)); }
      catch (logError) { console.error('記錄失敗：' + teacherSafeError_(logError)); }
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function writeTeacherAnswer_(kind, responseId, answers) {
  const ss = teacherBook_();
  checkStudentSheets_(ss);
  if (kind === 'class') {
    const title = requiredTeacherText_(answers['課程名稱'], '課程名稱', 100);
    const start = teacherDate_(answers['開始時間'], '開始時間', true);
    const reminder = optionalTeacherDate_(answers['提醒時間'], '提醒時間');
    if (start <= new Date()) throw new Error('課程開始時間必須在未來。');
    if (reminder && (reminder <= new Date() || reminder >= start)) {
      throw new Error('提醒時間必須在未來，且早於課程開始時間。');
    }
    const row = [teacherRowId_('課', responseId), title, start,
      teacherText_(answers['地點'], 200), teacherText_(answers['備註'], 1000), reminder || '', '是'];
    appendTeacherUnique_(ss.getSheetByName('行事曆'), row);
  } else if (kind === 'word') {
    const row = [teacherRowId_('詞', responseId),
      requiredTeacherText_(answers['中文'], '中文', 200),
      requiredTeacherText_(answers['族語'], '族語', 200),
      teacherText_(answers['例句'], 1000), teacherText_(answers['例句翻譯'], 1000),
      teacherUrl_(answers['音檔網址']), '是'];
    appendTeacherUnique_(ss.getSheetByName('單詞表'), row);
  } else if (kind === 'daily') {
    const date = teacherDate_(answers['日期'], '日期', false);
    const row = [date,
      requiredTeacherText_(answers['族語句子'], '族語句子', 1000),
      requiredTeacherText_(answers['中文翻譯'], '中文翻譯', 1000),
      teacherUrl_(answers['音檔網址']), '是'];
    upsertTeacherDaily_(ss.getSheetByName('每日一句'), row);
  } else if (kind === 'notice') {
    const confirm = answers[TEACHER_NOTICE_CONFIRM];
    if (!Array.isArray(confirm) || confirm.indexOf(TEACHER_NOTICE_CONFIRM) === -1) {
      throw new Error('未勾選「確認發送給已訂閱學生」，拒絕建立通知。');
    }
    const due = teacherDate_(answers['發送時間'], '發送時間', true);
    if (due <= new Date()) throw new Error('通知發送時間必須在未來。');
    const row = [teacherRowId_('通', responseId), due,
      requiredTeacherText_(answers['內容'], '內容', 2000), '是'];
    appendTeacherUnique_(ss.getSheetByName('通知'), row);
  } else {
    throw new Error('不支援的教師表單。');
  }
}

function configureTeacherForm_(form, spec, ss, email) {
  if (!form.supportsAdvancedResponderPermissions()) {
    throw new Error('這個 Google 帳號的表單不支援受限填答者權限，請不要發布。');
  }
  form.setDescription('僅供老師登入填寫；表單回覆將同步到原本的學生教學試算表。');
  if (!form.collectsEmail()) form.setCollectEmail(true);
  form.setAllowResponseEdits(false);
  form.setPublishingSummary(false);
  form.setConfirmationMessage('表單已收到。請到試算表的「老師表單紀錄」確認是否寫入成功。');
  form.addPublishedReader(email);
  let destination = null;
  try {
    destination = form.getDestinationId();
  } catch (error) {
    // 新表單可能以例外表示「尚未設定」，只處理已確認的無目標訊息。
    if (String(error && error.message || error).trim() !== '這個表單目前沒有回覆目標。') throw error;
  }
  if (destination && destination !== ss.getId()) throw new Error(spec.title + ' 已連到另一份試算表，請停止操作。');
  if (!destination) form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  spec.fields.forEach(field => ensureTeacherQuestion_(form, field));
}

function ensureTeacherQuestion_(form, field) {
  const [title, type, required] = field;
  const existing = form.getItems().find(item => item.getTitle() === title);
  const itemType = {text: 'TEXT', paragraph: 'PARAGRAPH_TEXT', date: 'DATE', datetime: 'DATETIME', checkbox: 'CHECKBOX'}[type];
  if (existing && existing.getType() !== FormApp.ItemType[itemType]) {
    throw new Error('表單題目「' + title + '」類型已改變，請勿直接修改自動建立的題目。');
  }
  const item = existing ? existing[{
    text: 'asTextItem', paragraph: 'asParagraphTextItem', date: 'asDateItem',
    datetime: 'asDateTimeItem', checkbox: 'asCheckboxItem'
  }[type]]() : ({
    text: () => form.addTextItem(), paragraph: () => form.addParagraphTextItem(),
    date: () => form.addDateItem(), datetime: () => form.addDateTimeItem(),
    checkbox: () => form.addCheckboxItem()
  }[type])();
  item.setTitle(title).setRequired(required);
  if (type === 'date' || type === 'datetime') item.setIncludesYear(true);
  if (type === 'checkbox') item.setChoiceValues([TEACHER_NOTICE_CONFIRM]);
}

function checkTeacherForm_(kind, ss, email) {
  const spec = TEACHER_FORMS[kind];
  const id = teacherProperties_().getProperty(spec.property);
  if (!id) throw new Error('缺少「' + spec.title + '」表單，請先執行 setupTeacher。');
  const form = FormApp.openById(id);
  if (!form.supportsAdvancedResponderPermissions() || !form.isPublished()) {
    throw new Error('「' + spec.title + '」尚未發布或不支援受限填答。');
  }
  if (!form.isAcceptingResponses()) throw new Error('「' + spec.title + '」已停止收取回覆。');
  if (!form.collectsEmail()) throw new Error('「' + spec.title + '」沒有收集 Email。請設為「已驗證」。');
  if (form.getDestinationId() !== ss.getId()) throw new Error('「' + spec.title + '」回覆目的地不是學生版試算表。');
  const readers = form.getPublishedReaders().map(user => user.getEmail().toLowerCase());
  const editors = form.getEditors().map(user => user.getEmail().toLowerCase());
  const currentOwner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (readers.indexOf(email) === -1 && editors.indexOf(email) === -1 && currentOwner !== email) {
    throw new Error('「' + spec.title + '」尚未將老師 Google 帳號列為填答者。');
  }
  return form;
}

function spreadsheetIdFromInput_(input) {
  const raw = String(input || '').trim();
  const found = raw.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const id = found ? found[1] : raw;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error('請先把 TEACHER_SHEET_INPUT 換成學生版試算表的完整網址或 ID。');
  }
  return id;
}

function teacherEmailFromInput_(input) {
  const email = String(input || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('請先把 TEACHER_EMAIL_INPUT 換成老師自己的 Google 帳號 Email。');
  }
  return email;
}

function teacherProperties_() { return PropertiesService.getScriptProperties(); }

function teacherBook_() {
  const id = teacherProperties_().getProperty('TEACHER_SPREADSHEET_ID');
  if (!id) throw new Error('尚未連接試算表，請先執行 setupTeacher。');
  return SpreadsheetApp.openById(id);
}

function teacherEmail_() {
  const email = teacherProperties_().getProperty('TEACHER_EMAIL');
  if (!email) throw new Error('尚未設定老師 Google 帳號，請先執行 setupTeacher。');
  return email;
}

function teacherToken_() {
  const token = teacherProperties_().getProperty('LINE_ACCESS_TOKEN');
  if (!token) throw new Error('請先在「專案設定 → 指令碼屬性」新增 LINE_ACCESS_TOKEN。');
  return token;
}

function checkStudentSheets_(ss) {
  if (ss.getSpreadsheetTimeZone() !== TEACHER_TIME_ZONE) {
    throw new Error('學生版試算表時區必須是 Asia/Taipei；請先到「檔案 → 設定」檢查。');
  }
  Object.keys(TEACHER_REQUIRED_SHEETS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('缺少學生版「' + name + '」分頁；請先在學生版執行 setup。');
    const expected = TEACHER_REQUIRED_SHEETS[name];
    const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
    if (expected.some((header, index) => actual[index] !== header)) {
      throw new Error('「' + name + '」欄名與學生入門版不同；請確認貼的是同一份試算表。');
    }
  });
}

function ensureTeacherLog_(ss) {
  let sheet = ss.getSheetByName('老師表單紀錄');
  if (!sheet) sheet = ss.insertSheet('老師表單紀錄');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TEACHER_LOG_HEADERS.length).setValues([TEACHER_LOG_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const actual = sheet.getRange(1, 1, 1, TEACHER_LOG_HEADERS.length).getValues()[0];
    if (TEACHER_LOG_HEADERS.some((header, index) => actual[index] !== header)) {
      throw new Error('「老師表單紀錄」欄名不符；請勿修改紀錄欄名。');
    }
  }
}

function findTeacherLog_(formId, responseId) {
  const sheet = teacherBook_().getSheetByName('老師表單紀錄');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === formId && rows[i][2] === responseId) return {rowNumber: i + 1, values: rows[i]};
  }
  return null;
}

function upsertTeacherLog_(formId, responseId, email, status, detail) {
  const sheet = teacherBook_().getSheetByName('老師表單紀錄');
  const row = [new Date(), formId, responseId, email, status, detail];
  const prior = findTeacherLog_(formId, responseId);
  if (prior) sheet.getRange(prior.rowNumber, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function appendTeacherUnique_(sheet, row) {
  const id = row[0];
  if (sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    if (ids.some(values => values[0] === id)) return;
  }
  sheet.appendRow(row);
}

function upsertTeacherDaily_(sheet, row) {
  const wanted = Utilities.formatDate(row[0], TEACHER_TIME_ZONE, 'yyyy/MM/dd');
  if (sheet.getLastRow() > 1) {
    const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      const value = dates[i][0];
      const key = value instanceof Date ? Utilities.formatDate(value, TEACHER_TIME_ZONE, 'yyyy/MM/dd') : String(value).trim();
      if (key === wanted) {
        sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }
  sheet.appendRow(row);
}

function teacherRowId_(prefix, responseId) {
  const safe = String(responseId).replace(/[^A-Za-z0-9_-]/g, '');
  if (!safe) throw new Error('表單回覆 ID 無效。');
  return '老師' + prefix + '-' + safe;
}

function teacherText_(value, limit) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > limit) throw new Error('文字超過 ' + limit + ' 字，請縮短後重新填寫。');
  // 避免試算表把表單文字當作公式執行。
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function requiredTeacherText_(value, title, limit) {
  const text = teacherText_(value, limit);
  if (!text) throw new Error('「' + title + '」不可空白。');
  return text;
}

function teacherUrl_(value) {
  const text = teacherText_(value, 500);
  if (text && !/^https:\/\/[^\s]+$/i.test(text)) throw new Error('音檔網址請填 https:// 開頭的完整網址。');
  return text;
}

function optionalTeacherDate_(value, title) {
  if (value == null || value === '') return null;
  return teacherDate_(value, title, true);
}

function teacherDate_(value, title, requireTime) {
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
  const text = String(value == null ? '' : value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!match) throw new Error('「' + title + '」日期格式錯誤，請在表單重新選日期與時間。');
  if (requireTime && match[4] === undefined) throw new Error('「' + title + '」必須包含日期與時間。');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4] || 0), minute = Number(match[5] || 0);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute) {
    throw new Error('「' + title + '」日期或時間無效。');
  }
  return date;
}

function teacherReply_(replyToken, text) {
  const result = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + teacherToken_()},
    payload: JSON.stringify({replyToken, messages: [{type: 'text', text: String(text).slice(0, 4900)}]}),
    muteHttpExceptions: true
  });
  if (result.getResponseCode() < 200 || result.getResponseCode() >= 300) {
    throw new Error('LINE 回覆失敗（HTTP ' + result.getResponseCode() + '）。');
  }
}

// ContentService 會轉址到 googleusercontent，LINE Verify 可能把 302 判為失敗。
function teacherOk_() { return HtmlService.createHtmlOutput('OK'); }

function teacherSafeError_(error) {
  return String(error && error.message ? error.message : error).slice(0, 300);
}
