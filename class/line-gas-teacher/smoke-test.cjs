// 在本機模擬 Apps Script 服務，驗證老師版的資料流；不連真實 Google 或 LINE。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8')
  .replace("const TEACHER_SHEET_INPUT = '請貼上學生版試算表的完整網址或 ID';",
    "const TEACHER_SHEET_INPUT = 'https://docs.google.com/spreadsheets/d/123456789012345678901234567890/edit';")
  .replace("const TEACHER_EMAIL_INPUT = '請填老師自己的 Google 帳號 Email';",
    "const TEACHER_EMAIL_INPUT = 'teacher@example.com';");

const headers = {
  '學生': ['LINE使用者ID', '訂閱狀態', '加入時間', '更新時間'],
  '行事曆': ['活動ID', '課程名稱', '開始時間', '地點', '備註', '提醒時間', '啟用'],
  '單詞表': ['單詞ID', '中文', '族語', '例句', '例句翻譯', '音檔網址', '啟用'],
  '每日一句': ['日期', '族語句子', '中文翻譯', '音檔網址', '啟用'],
  '題庫': ['題號', '題目', '選項A', '選項B', '選項C', '正解', '解說', '啟用'],
  '通知': ['通知ID', '發送時間', '內容', '啟用'],
  '發送紀錄': ['來源ID', 'LINE使用者ID', '發送時間', '結果']
};
const propData = new Map([['LINE_ACCESS_TOKEN', 'test-token-not-real']]);
const forms = new Map();
const triggers = [];
const fetches = [];
const logs = [];
let effectiveEmail = 'teacher@example.com';

class MockRange {
  constructor(sheet, row, col, countRow, countCol) {
    Object.assign(this, {sheet, row, col, countRow, countCol});
  }
  getValues() {
    return Array.from({length: this.countRow}, (_, r) =>
      Array.from({length: this.countCol}, (_, c) =>
        this.sheet.rows[this.row + r - 1]?.[this.col + c - 1] ?? ''
      )
    );
  }
  setValues(values) {
    values.forEach((cells, r) => {
      const rowNumber = this.row + r - 1;
      while (this.sheet.rows.length <= rowNumber) this.sheet.rows.push([]);
      cells.forEach((value, c) => { this.sheet.rows[rowNumber][this.col + c - 1] = value; });
    });
    return this;
  }
  setFrozenRows() { return this; }
}
class MockSheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map(row => [...row]); }
  getLastRow() { return this.rows.length; }
  getRange(row, col, countRow = 1, countCol = 1) { return new MockRange(this, row, col, countRow, countCol); }
  getDataRange() { return new MockRange(this, 1, 1, this.rows.length, Math.max(1, ...this.rows.map(row => row.length))); }
  appendRow(values) { this.rows.push([...values]); return this; }
  setFrozenRows() { return this; }
}
class MockSpreadsheet {
  constructor() {
    this.sheets = new Map(Object.entries(headers).map(([name, row]) => [name, new MockSheet(name, [row])]));
  }
  getId() { return '123456789012345678901234567890'; }
  getSpreadsheetTimeZone() { return 'Asia/Taipei'; }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const sheet = new MockSheet(name); this.sheets.set(name, sheet); return sheet; }
}
const spreadsheet = new MockSpreadsheet();

class MockItem {
  constructor(type) { this.type = type; this.title = ''; this.required = false; }
  getTitle() { return this.title; }
  getType() { return this.type; }
  setTitle(title) { this.title = title; return this; }
  setRequired(value) { this.required = value; return this; }
  setIncludesYear(value) { this.includesYear = value; return this; }
  setChoiceValues(values) { this.choices = values; return this; }
  asTextItem() { return this; }
  asParagraphTextItem() { return this; }
  asDateItem() { return this; }
  asDateTimeItem() { return this; }
  asCheckboxItem() { return this; }
}
class MockForm {
  constructor(title, published, id) {
    this.title = title;
    this.published = published;
    this.accepting = false;
    this.id = id;
    this.items = [];
    this.readers = new Set();
    this.collectEmail = false;
    this.destination = null;
  }
  getId() { return this.id; }
  getEditUrl() { return `https://docs.google.com/forms/d/${this.id}/edit`; }
  getPublishedUrl() { return `https://docs.google.com/forms/d/e/${this.id}/viewform`; }
  supportsAdvancedResponderPermissions() { return true; }
  isPublished() { return this.published; }
  isAcceptingResponses() { return this.accepting; }
  collectsEmail() { return this.collectEmail; }
  getPublishedReaders() { return [...this.readers].map(email => ({getEmail: () => email})); }
  getEditors() { return []; }
  addPublishedReader(email) { this.readers.add(email); return this; }
  getDestinationId() { return this.destination; }
  setDestination(_kind, id) { this.destination = id; return this; }
  setDescription() { return this; }
  setCollectEmail(value) { this.collectEmail = value; return this; }
  setAllowResponseEdits() { return this; }
  setPublishingSummary() { return this; }
  setConfirmationMessage() { return this; }
  getItems() { return this.items; }
  addTextItem() { return this.add('TEXT'); }
  addParagraphTextItem() { return this.add('PARAGRAPH_TEXT'); }
  addDateItem() { return this.add('DATE'); }
  addDateTimeItem() { return this.add('DATETIME'); }
  addCheckboxItem() { return this.add('CHECKBOX'); }
  add(type) { const item = new MockItem(type); this.items.push(item); return item; }
}

const app = {
  Date,
  console,
  Session: {
    getScriptTimeZone: () => 'Asia/Taipei',
    getEffectiveUser: () => ({getEmail: () => effectiveEmail})
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => propData.get(key) || null,
      setProperty: (key, value) => { propData.set(key, value); }
    })
  },
  SpreadsheetApp: {openById: id => {
    assert.equal(id, spreadsheet.getId());
    return spreadsheet;
  }},
  FormApp: {
    ItemType: {TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', DATE: 'DATE', DATETIME: 'DATETIME', CHECKBOX: 'CHECKBOX'},
    DestinationType: {SPREADSHEET: 'SPREADSHEET'},
    create: (title, published) => {
      assert.equal(published, false, '新建表單必須未發布');
      const form = new MockForm(title, published, `FORM_${forms.size + 1}`);
      forms.set(form.id, form);
      return form;
    },
    openById: id => {
      const form = forms.get(id);
      if (!form) throw new Error('找不到表單');
      return form;
    }
  },
  ScriptApp: {
    getProjectTriggers: () => triggers,
    newTrigger: name => ({
      forForm(form) { this.form = form; return this; },
      onFormSubmit() { return this; },
      create() {
        triggers.push({
          getHandlerFunction: () => name,
          getTriggerSourceId: () => this.form.getId()
        });
      }
    })
  },
  LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
  UrlFetchApp: {fetch: (url, options) => {
    fetches.push({url, options});
    return {getResponseCode: () => 200};
  }},
  HtmlService: {createHtmlOutput: text => ({text})},
  Utilities: {formatDate: date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('/')},
  Logger: {log: text => logs.push(text)}
};
vm.createContext(app);
vm.runInContext(code, app, {filename: 'Code.gs'});

function event(form, id, email, values) {
  return {
    source: form,
    response: {
      getId: () => id,
      getRespondentEmail: () => email,
      getItemResponses: () => Object.entries(values).map(([title, value]) => ({
        getItem: () => ({getTitle: () => title}), getResponse: () => value
      }))
    }
  };
}
function sheet(name) { return spreadsheet.getSheetByName(name); }
function expectThrow(fn, pattern) { assert.throws(fn, pattern); }
function future(days) { return new Date(Date.now() + days * 24 * 60 * 60 * 1000); }
function isoLocal(date, includeTime) {
  const datePart = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
  return includeTime ? `${datePart} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : datePart;
}

assert.match(app.teacherCommand_('新增課程'), /尚未啟用/);
effectiveEmail = 'wrong-account@example.com';
expectThrow(() => app.setupTeacher(), /必須和目前執行 Apps Script 的 Google 帳號相同/);
assert.equal(forms.size, 0, '老師 Email 不符時不得建立表單');
effectiveEmail = 'teacher@example.com';
app.setupTeacher();
app.setupTeacher();
assert.equal(forms.size, 4, '重跑 setup 不應建立第二批表單');
assert.equal(triggers.length, 4, '重跑 setup 不應建立重複觸發器');
for (const form of forms.values()) {
  assert.equal(form.published, false);
  assert.equal(form.destination, spreadsheet.getId());
  assert.equal(form.collectEmail, true);
  for (const item of form.items.filter(item => item.type === 'DATE' || item.type === 'DATETIME')) {
    assert.equal(item.includesYear, true, '日期題型必須包含年份');
  }
}
assert.equal(spreadsheet.sheets.size, 8, '7 個既有分頁加老師處理紀錄');
expectThrow(() => app.enableTeacherLinks(), /尚未發布/);

const [classForm, wordForm, dailyForm, noticeForm] = [...forms.values()];
for (const form of forms.values()) { form.published = true; form.accepting = true; }
effectiveEmail = 'operator@example.com';
classForm.readers.clear();
expectThrow(() => app.enableTeacherLinks(), /老師 Google 帳號/);
classForm.readers.add('teacher@example.com');
dailyForm.accepting = false;
expectThrow(() => app.enableTeacherLinks(), /已停止收取回覆/);
dailyForm.accepting = true;
wordForm.collectEmail = false;
expectThrow(() => app.enableTeacherLinks(), /沒有收集 Email/);
wordForm.collectEmail = true;
app.enableTeacherLinks();
assert.match(app.teacherCommand_('新增課程'), /FORM_1\/viewform/);
assert.match(app.teacherCommand_('新增課表'), /FORM_1\/viewform/);
assert.match(app.teacherCommand_('新增通知'), /FORM_4\/viewform/);
dailyForm.accepting = false;
assert.match(app.teacherCommand_('新增每日一句'), /不可使用/, '已關閉收件的表單不能再傳連結');
dailyForm.accepting = true;
const originalDestination = noticeForm.destination;
noticeForm.destination = 'wrong-spreadsheet-id';
assert.match(app.teacherCommand_('新增通知'), /不可使用/, '表單目的地後來改變時不能再傳連結');
expectThrow(() => app.teacherFormSubmit(event(noticeForm, 'response-wrong-destination', 'teacher@example.com', {
  '發送時間': future(2), '內容': '不該排程',
  '我已確認，這則通知會傳給已訂閱的學生': ['我已確認，這則通知會傳給已訂閱的學生']
})), /回覆目的地不是學生版試算表/);
assert.equal(sheet('通知').rows.length, 1, '表單目的地異常時不能排程通知');
noticeForm.destination = originalDestination;
app.checkTeacherSetup();
assert.ok(fetches.some(call => call.url.endsWith('/bot/info')));

const start = future(4);
const reminder = future(3);
const classEvent = event(classForm, 'response-class-01', 'teacher@example.com', {
  '課程名稱': '族語課', '開始時間': start, '地點': '教室 1', '備註': '攜帶筆記', '提醒時間': reminder
});
app.teacherFormSubmit(classEvent);
app.teacherFormSubmit(classEvent);
assert.equal(sheet('行事曆').rows.length, 2);
assert.ok(sheet('行事曆').rows[1][2] instanceof Date);
assert.ok(sheet('行事曆').rows[1][5] instanceof Date);
assert.equal(sheet('行事曆').rows[1][6], '是');
app.teacherFormSubmit(event(classForm, 'response-class-iso', 'teacher@example.com', {
  '課程名稱': '文字日期課程', '開始時間': isoLocal(future(6), true),
  '提醒時間': isoLocal(future(5), true)
}));
assert.equal(sheet('行事曆').rows.length, 3);
assert.ok(sheet('行事曆').rows[2][2] instanceof Date, 'YYYY-MM-DD HH:mm 應轉成試算表日期');
expectThrow(() => app.teacherFormSubmit(event(classForm, 'response-class-date-only', 'teacher@example.com', {
  '課程名稱': '缺少時間', '開始時間': isoLocal(future(7), false)
})), /必須包含日期與時間/);
expectThrow(() => app.teacherFormSubmit(event(classForm, 'response-reminder-date-only', 'teacher@example.com', {
  '課程名稱': '缺少提醒時間', '開始時間': isoLocal(future(7), true),
  '提醒時間': isoLocal(future(6), false)
})), /必須包含日期與時間/);
assert.equal(sheet('行事曆').rows.length, 3, '缺少時間不能寫入課表');

expectThrow(() => app.teacherFormSubmit(event(wordForm, 'response-word-bad', 'stranger@example.com', {
  '中文': '太陽', '族語': 'test'
})), /不是設定的老師/);
assert.equal(sheet('單詞表').rows.length, 1);
assert.ok(sheet('老師表單紀錄').rows.some(row => row[2] === 'response-word-bad' && row[4] === '拒絕／失敗'));
expectThrow(() => app.teacherFormSubmit(event({getId: () => 'FORM_UNKNOWN'}, 'response-unknown', 'teacher@example.com', {
  '課程名稱': '不該寫入', '開始時間': future(2)
})), /不是本專案建立/);
assert.equal(sheet('行事曆').rows.length, 3, '不明表單來源不能寫正式分頁');

app.teacherFormSubmit(event(wordForm, 'response-word-01', 'teacher@example.com', {
  '中文': '太陽', '族語': '教師審核族語詞', '例句': '=1+2', '例句翻譯': '天氣很好', '音檔網址': 'https://example.com/audio.mp3'
}));
assert.equal(sheet('單詞表').rows[1][1], '太陽');
assert.equal(sheet('單詞表').rows[1][3], "'=1+2", '不能把表單內容當試算表公式執行');

const dailyDate = future(5);
app.teacherFormSubmit(event(dailyForm, 'response-daily-01', 'teacher@example.com', {
  '日期': dailyDate, '族語句子': '第一句', '中文翻譯': '第一句翻譯', '音檔網址': ''
}));
app.teacherFormSubmit(event(dailyForm, 'response-daily-02', 'teacher@example.com', {
  '日期': dailyDate, '族語句子': '更新的一句', '中文翻譯': '新的翻譯', '音檔網址': ''
}));
assert.equal(sheet('每日一句').rows.length, 2, '同一天應更新，而不是新增兩列');
assert.equal(sheet('每日一句').rows[1][1], '更新的一句');
app.teacherFormSubmit(event(dailyForm, 'response-daily-iso', 'teacher@example.com', {
  '日期': isoLocal(future(6), false), '族語句子': '文字日期的一句', '中文翻譯': '文字日期翻譯'
}));
assert.equal(sheet('每日一句').rows.length, 3, 'YYYY-MM-DD 可用於每日一句');
assert.ok(sheet('每日一句').rows[2][0] instanceof Date);

const noticeTime = future(2);
expectThrow(() => app.teacherFormSubmit(event(noticeForm, 'response-notice-bad', 'teacher@example.com', {
  '發送時間': noticeTime, '內容': '下週上課'
})), /未勾選/);
assert.equal(sheet('通知').rows.length, 1);
const noticeEvent = event(noticeForm, 'response-notice-01', 'teacher@example.com', {
  '發送時間': noticeTime, '內容': '下週上課',
  '我已確認，這則通知會傳給已訂閱的學生': ['我已確認，這則通知會傳給已訂閱的學生']
});
app.teacherFormSubmit(noticeEvent);
app.teacherFormSubmit(noticeEvent);
assert.equal(sheet('通知').rows.length, 2);
assert.ok(sheet('通知').rows[1][1] instanceof Date);
assert.equal(sheet('通知').rows[1][3], '是');
app.teacherFormSubmit(event(noticeForm, 'response-notice-iso', 'teacher@example.com', {
  '發送時間': isoLocal(future(3), true), '內容': '文字日期通知',
  '我已確認，這則通知會傳給已訂閱的學生': ['我已確認，這則通知會傳給已訂閱的學生']
}));
assert.ok(sheet('通知').rows[2][1] instanceof Date);
expectThrow(() => app.teacherFormSubmit(event(noticeForm, 'response-notice-date-only', 'teacher@example.com', {
  '發送時間': isoLocal(future(3), false), '內容': '缺時間通知',
  '我已確認，這則通知會傳給已訂閱的學生': ['我已確認，這則通知會傳給已訂閱的學生']
})), /必須包含日期與時間/);
assert.equal(sheet('通知').rows.length, 3);

const before = ['行事曆', '單詞表', '每日一句', '通知'].map(name => sheet(name).rows.length);
const beforeReplies = fetches.filter(call => call.url.endsWith('/message/reply')).length;
const sharedChatResult = app.doPost({postData: {contents: JSON.stringify({events: [
  {type: 'message', replyToken: 'group-reply', source: {type: 'group', groupId: 'G-test'},
    message: {type: 'text', text: '新增通知'}},
  {type: 'message', replyToken: 'room-reply', source: {type: 'room', roomId: 'R-test'},
    message: {type: 'text', text: '新增課程'}}
]})}});
assert.equal(sharedChatResult.text, 'OK');
assert.equal(fetches.filter(call => call.url.endsWith('/message/reply')).length, beforeReplies,
  '群組或聊天室訊息不能取得教師表單連結');
const result = app.doPost({postData: {contents: JSON.stringify({events: [{
  type: 'message', replyToken: 'reply-test', source: {type: 'user', userId: 'U-test'},
  message: {type: 'text', text: '新增通知'}
}]})}});
assert.equal(result.text, 'OK');
assert.ok(fetches.some(call => call.url.endsWith('/message/reply')));
assert.deepEqual(['行事曆', '單詞表', '每日一句', '通知'].map(name => sheet(name).rows.length), before,
  'LINE webhook 絕不可直接寫課務資料');

console.log('老師版模擬測試通過：安全啟用、重複 setup、身分拒絕、四種寫入、重複提交與 LINE 唯讀入口。');
