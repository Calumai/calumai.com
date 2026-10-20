// Run with: node teacher-forms-smoke-test.cjs
// Uses local fakes only; it never creates a real form or calls LINE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const studentCode = fs.readFileSync(path.join(__dirname, '..', 'line-gas-starter', 'Code.gs'), 'utf8');
const teacherCode = fs.readFileSync(path.join(__dirname, 'TeacherForms.gs'), 'utf8');
assert.doesNotMatch(teacherCode, /function\s+(?:doPost|doGet|teacherReply_|teacherOk_|teacherCommandIfAllowed_|teacherCommand_)\s*\(/);
assert.doesNotMatch(teacherCode, /TEACHER_SHEET_INPUT|TEACHER_EMAIL_INPUT|TEACHER_SPREADSHEET_ID/);

class Range {
  constructor(sheet, row, col, height = 1, width = 1) {
    Object.assign(this, {sheet, row, col, height, width});
  }
  getValues() {
    return Array.from({length: this.height}, (_, r) =>
      Array.from({length: this.width}, (_, c) =>
        this.sheet.rows[this.row + r - 1]?.[this.col + c - 1] ?? ''));
  }
  setValues(data) {
    data.forEach((row, r) => {
      const index = this.row + r - 1;
      if (!this.sheet.rows[index]) this.sheet.rows[index] = [];
      row.forEach((value, c) => { this.sheet.rows[index][this.col + c - 1] = value; });
    });
    return this;
  }
  setValue(value) { return this.setValues([[value]]); }
  setFontWeight() { return this; }
  setBackground() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  getName() { return this.name; }
  setName(name) { this.name = name; return this; }
  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i]?.some(value => value !== '' && value !== undefined)) return i + 1;
    }
    return 0;
  }
  getRange(row, col, height, width) { return new Range(this, row, col, height, width); }
  getDataRange() {
    return new Range(this, 1, 1, this.getLastRow(), Math.max(1, ...this.rows.map(row => row.length)));
  }
  appendRow(row) { this.rows.push([...row]); return this; }
  setFrozenRows() { return this; }
}
class Item {
  constructor(type) { this.type = type; this.title = ''; }
  getTitle() { return this.title; }
  getType() { return this.type; }
  setTitle(value) { this.title = value; return this; }
  setRequired() { return this; }
  setIncludesYear() { return this; }
  setChoiceValues() { return this; }
  asTextItem() { return this; }
  asParagraphTextItem() { return this; }
  asDateItem() { return this; }
  asDateTimeItem() { return this; }
  asCheckboxItem() { return this; }
}
let failNextDestinationSet = false;
class Form {
  constructor(title, id) {
    this.title = title; this.id = id; this.items = []; this.published = false;
    this.accepting = false; this.email = false; this.readers = new Set(); this.destination = '';
  }
  getId() { return this.id; }
  getEditUrl() { return `https://docs.google.com/forms/d/${this.id}/edit`; }
  getPublishedUrl() { return `https://docs.google.com/forms/d/e/${this.id}/viewform`; }
  supportsAdvancedResponderPermissions() { return true; }
  isPublished() { return this.published; }
  isAcceptingResponses() { return this.accepting; }
  collectsEmail() { return this.email; }
  getPublishedReaders() { return [...this.readers].map(email => ({getEmail: () => email})); }
  getEditors() { return []; }
  addPublishedReader(email) { this.readers.add(email); return this; }
  getDestinationId() {
    if (this.destinationReadError) throw this.destinationReadError;
    if (!this.destination) throw new Error('這個表單目前沒有回覆目標。');
    return this.destination;
  }
  setDestination(_type, id) {
    if (failNextDestinationSet) {
      failNextDestinationSet = false;
      throw new Error('模擬第一次設定回覆目標中斷');
    }
    this.destination = id;
    return this;
  }
  setDescription() { return this; }
  setCollectEmail(value) { this.email = value; return this; }
  setAllowResponseEdits() { return this; }
  setPublishingSummary() { return this; }
  setConfirmationMessage() { return this; }
  getItems() { return this.items; }
  addTextItem() { return this.add('TEXT'); }
  addParagraphTextItem() { return this.add('PARAGRAPH_TEXT'); }
  addDateItem() { return this.add('DATE'); }
  addDateTimeItem() { return this.add('DATETIME'); }
  addCheckboxItem() { return this.add('CHECKBOX'); }
  add(type) { const item = new Item(type); this.items.push(item); return item; }
}

const sheets = [new Sheet('工作表1')];
const spreadsheet = {
  id: '123456789012345678901234567890', timezone: 'Asia/Taipei',
  getId() { return this.id; }, getName() { return '學生版試算表'; },
  getSheets: () => sheets,
  getSheetByName: name => sheets.find(sheet => sheet.name === name) || null,
  insertSheet(name) { const sheet = new Sheet(name); sheets.push(sheet); return sheet; },
  setSpreadsheetTimeZone(tz) { this.timezone = tz; },
  getSpreadsheetTimeZone() { return this.timezone; }
};
const props = new Map([['LINE_ACCESS_TOKEN', 'FAKE_TEST_TOKEN']]);
const forms = new Map();
const triggers = [];
const fetches = [];
const logs = [];
let pushResponseCode = 200;
let email = 'teacher@example.com';
const teacherUid = 'U' + 'a'.repeat(32);
const otherUid = 'U' + 'b'.repeat(32);
const context = vm.createContext({
  Date, JSON, Number, String, Map, Set, Object, Array, RegExp, Math,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => spreadsheet,
    openById(id) { assert.equal(id, spreadsheet.id); return spreadsheet; }
  },
  Session: {
    getScriptTimeZone: () => 'Asia/Taipei',
    getEffectiveUser: () => ({getEmail: () => email})
  },
  PropertiesService: {getScriptProperties: () => ({
    getProperty: key => props.get(key) || null,
    setProperty(key, value) { props.set(key, value); }
  })},
  FormApp: {
    ItemType: {TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', DATE: 'DATE', DATETIME: 'DATETIME', CHECKBOX: 'CHECKBOX'},
    DestinationType: {SPREADSHEET: 'SPREADSHEET'},
    create(title, published) {
      assert.equal(published, false);
      const form = new Form(title, 'FORM_' + (forms.size + 1));
      forms.set(form.id, form);
      return form;
    },
    openById(id) { assert.ok(forms.has(id)); return forms.get(id); }
  },
  ScriptApp: {
    getProjectTriggers: () => triggers,
    newTrigger(handler) {
      return {
        forForm(form) { this.form = form; return this; }, onFormSubmit() { return this; },
        create() {
          triggers.push({
            getHandlerFunction: () => handler,
            getTriggerSourceId: () => this.form.getId()
          });
        }
      };
    }
  },
  LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
  UrlFetchApp: {fetch(url, options) {
    fetches.push({url, options});
    return {getResponseCode: () => url.endsWith('/message/push') ? pushResponseCode : 200};
  }},
  Utilities: {formatDate: date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('/')},
  Logger: {log: text => logs.push(String(text))},
  console: {error: text => logs.push(String(text))}
});
vm.runInContext(studentCode, context, {filename: 'student Code.gs'});
vm.runInContext(teacherCode, context, {filename: 'TeacherForms.gs'});
context.setup();
assert.equal(props.get('SPREADSHEET_ID'), spreadsheet.id);
assert.equal(typeof context.teacherCommandIfAllowed_, 'undefined', '新增模組不得要求修改原 command_');
assert.match(context.command_('新增通知', teacherUid), /我還不認得/);
assert.throws(() => context.sendTeacherMenu(), /TEACHER_LINE_USER_ID/);
failNextDestinationSet = true;
assert.throws(() => context.setupTeacher(), /第一次設定回覆目標中斷/);
assert.equal(forms.size, 1, '中斷時已建立的表單仍應保留');
assert.equal(props.get('TEACHER_FORM_CLASS'), 'FORM_1', '中斷時表單 ID 已記錄，重跑可沿用');
context.setupTeacher();
context.setupTeacher();
assert.equal(forms.size, 4);
assert.equal(triggers.length, 4);
assert.ok(logs.some(line => line.includes('FORM_1/viewform')), '未設定教師 UID 也要記錄可供發布後使用的表單網址');
assert.ok(logs.some(line => line.includes('不要複製其他學生的 ID')),
  '應指引老師辨認自己的 ID，不從學生名單猜測');
const reusedForm = forms.get('FORM_1');
assert.equal(reusedForm.getDestinationId(), spreadsheet.id, '重跑應設定原表單的回覆目標');
reusedForm.destinationReadError = new Error('讀取表單被拒絕');
assert.throws(() => context.setupTeacher(), /讀取表單被拒絕/,
  '非「沒有回覆目標」的例外不得被當成空目標');
reusedForm.destinationReadError = null;
assert.equal(sheets.length, 8); // 7 student tabs + teacher form processing log.
assert.equal(props.has('TEACHER_SPREADSHEET_ID'), false);
assert.equal(props.has('TEACHER_EMAIL'), false);
assert.throws(() => context.enableTeacherLinks(), /尚未發布/);
for (const form of forms.values()) {
  assert.equal(form.destination, spreadsheet.id);
  assert.equal(form.email, true);
  assert.equal(form.readers.has('teacher@example.com'), true);
  form.published = true;
  form.accepting = true;
}
context.enableTeacherLinks();
assert.throws(() => context.checkTeacherSetup(), /TEACHER_LINE_USER_ID/,
  '正式檢查須確認老師已設定自己的 LINE ID');
spreadsheet.getSheetByName('學生').appendRow([otherUid, '是', new Date(), new Date()]);
assert.throws(() => context.sendTeacherMenu(), /TEACHER_LINE_USER_ID/,
  '即使學生分頁有 ID，也不能把學生當老師收件人');
props.set('TEACHER_LINE_USER_ID', 'bad-user-id');
assert.throws(() => context.checkTeacherSetup(), /TEACHER_LINE_USER_ID/);
assert.throws(() => context.sendTeacherMenu(), /TEACHER_LINE_USER_ID/);
props.set('TEACHER_LINE_USER_ID', teacherUid);
context.checkTeacherSetup();
context.sendTeacherMenu();
const pushed = fetches.filter(call => call.url.endsWith('/message/push'));
assert.equal(pushed.length, 1);
assert.equal(pushed[0].options.headers.Authorization, 'Bearer FAKE_TEST_TOKEN');
const pushedBody = JSON.parse(pushed[0].options.payload);
assert.equal(pushedBody.to, teacherUid);
assert.match(pushedBody.messages[0].text, /FORM_1\/viewform/);
assert.match(pushedBody.messages[0].text, /FORM_4\/viewform/);
pushResponseCode = 403;
assert.throws(() => context.sendTeacherMenu(), /HTTP 403/);
pushResponseCode = 200;
assert.match(context.command_('新增通知', teacherUid), /我還不認得/,
  '不修改原 Code.gs 時，直接在 LINE 輸入教師指令仍不會回傳表單');
assert.match(context.command_('每日一句', teacherUid), /還沒有設定/);
assert.equal(fetches.filter(call => call.url.endsWith('/bot/info')).length, 1);

function event(form, id, responder, answers) {
  return {source: form, response: {
    getId: () => id, getRespondentEmail: () => responder,
    getItemResponses: () => Object.entries(answers).map(([title, value]) => ({
      getItem: () => ({getTitle: () => title}), getResponse: () => value
    }))
  }};
}
const wordForm = forms.get('FORM_2');
assert.throws(() => context.teacherFormSubmit(event(wordForm, 'bad-1', 'outsider@example.com', {
  '中文': '太陽', '族語': '教師審核詞'
})), /不是設定的老師/);
assert.equal(spreadsheet.getSheetByName('單詞表').getLastRow(), 1);
const wordEvent = event(wordForm, 'good-1', 'teacher@example.com', {
  '中文': '太陽', '族語': '教師審核詞', '例句': '=1+2'
});
context.teacherFormSubmit(wordEvent);
context.teacherFormSubmit(wordEvent);
assert.equal(spreadsheet.getSheetByName('單詞表').getLastRow(), 2);
assert.equal(spreadsheet.getSheetByName('單詞表').rows[1][3], "'=1+2");
const dailySheet = spreadsheet.getSheetByName('每日一句');
dailySheet.appendRow(['2030-05-08', '舊句子', '舊翻譯', '', '是']);
context.teacherFormSubmit(event(forms.get('FORM_3'), 'daily-1', 'teacher@example.com', {
  '日期': new Date(2030, 4, 8), '族語句子': '新句子', '中文翻譯': '新翻譯'
}));
assert.equal(dailySheet.getLastRow(), 2, '既有 yyyy-MM-dd 文字日期應更新同一天，不新增重複列');
assert.equal(dailySheet.rows[1][1], '新句子');
assert.equal(fetches.filter(call => call.url.includes('/message/reply')).length, 0,
  '教師模組不應新增第二個 LINE Webhook');

console.log('PASS: add-only teacher module, no-destination recovery, idempotent setup, missing UID safety, explicit LINE menu push, restricted forms, and duplicate form submissions.');
