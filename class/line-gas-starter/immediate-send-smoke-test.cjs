// Run with: node immediate-send-smoke-test.cjs
// Local fakes only: no real Google Sheet, Apps Script project, or LINE request.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const main = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const addon = fs.readFileSync(path.join(__dirname, 'ImmediateSend.gs'), 'utf8');

function harness() {
  class Range {
    constructor(sheet, row, col, height = 1, width = 1) {
      Object.assign(this, {sheet, row, col, height, width});
    }
    getRow() { return this.row; }
    getNumRows() { return this.height; }
    getValues() {
      return Array.from({length: this.height}, (_, r) =>
        Array.from({length: this.width}, (_, c) =>
          this.sheet.rows[this.row + r - 1]?.[this.col + c - 1] ?? ''));
    }
    setValues(data) {
      assert.equal(data.length, this.height);
      data.forEach((values, r) => {
        assert.equal(values.length, this.width);
        const i = this.row + r - 1;
        if (!this.sheet.rows[i]) this.sheet.rows[i] = [];
        values.forEach((value, c) => { this.sheet.rows[i][this.col + c - 1] = value; });
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
    appendRow(values) { this.rows.push([...values]); return this; }
    setFrozenRows() { return this; }
  }
  const sheets = [new Sheet('工作表1')];
  let active = sheets[0];
  let selection = null;
  const workbook = {
    getId: () => 'TEST_SHEET_ID', getName: () => '測試試算表',
    getSheets: () => sheets,
    getSheetByName: name => sheets.find(sheet => sheet.name === name) || null,
    insertSheet(name) { const sheet = new Sheet(name); sheets.push(sheet); return sheet; },
    getActiveSheet: () => active, getActiveRange: () => selection,
    setSpreadsheetTimeZone() {}
  };
  const properties = new Map();
  const alerts = [];
  const pushes = [];
  const menu = [];
  const logs = [];
  let answer = 'YES';
  let onConfirm = null;
  let failNext = 0;
  let locked = false;
  const ui = {
    ButtonSet: {OK: 'OK', YES_NO: 'YES_NO'}, Button: {YES: 'YES', NO: 'NO'},
    createMenu(label) {
      menu.push({label});
      return {addItem(text, fn) { menu.push({text, fn}); return this; }, addToUi() { return this; }};
    },
    alert(title, message, buttons) {
      alerts.push({title, message, buttons});
      if (buttons === 'YES_NO') {
        if (onConfirm) onConfirm();
        return answer;
      }
      return 'OK';
    }
  };
  const sandbox = {
    Date, JSON, Number, String, Map, Set, Object, Array, RegExp, Math,
    SpreadsheetApp: {getActiveSpreadsheet: () => workbook, getUi: () => ui,
      openById(id) { assert.equal(id, workbook.getId()); return workbook; }},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty(key, value) { properties.set(key, value); }
    })},
    LockService: {getScriptLock: () => ({
      tryLock() { if (locked) return false; locked = true; return true; },
      releaseLock() { locked = false; }
    })},
    UrlFetchApp: {fetch(url, options) {
      assert.equal(url, 'https://api.line.me/v2/bot/message/push');
      pushes.push({url, options, body: JSON.parse(options.payload)});
      const status = failNext-- > 0 ? 500 : 200;
      return {getResponseCode: () => status};
    }},
    Logger: {log: text => logs.push(String(text))},
    Utilities: {formatDate: () => '2026/10/20 12:00'},
    console: {error: text => logs.push(String(text))}
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(main, context, {filename: 'Code.gs'});
  vm.runInContext(addon, context, {filename: 'ImmediateSend.gs'});
  context.setup();
  properties.set('LINE_ACCESS_TOKEN', 'FAKE_TEST_TOKEN');
  active = workbook.getSheetByName('通知');
  selection = active.getRange(2, 1, 1, 1);
  return {
    context, workbook, properties, alerts, pushes, menu, logs,
    sheet: name => workbook.getSheetByName(name),
    run() { alerts.length = 0; context.sendSelectedNoticeNow(); return alerts; },
    choose: value => { answer = value; },
    select: (name, row = 2, count = 1) => {
      active = workbook.getSheetByName(name);
      selection = active.getRange(row, 1, count, 1);
    },
    onConfirm: fn => { onConfirm = fn; },
    failNext: count => { failNext = count; },
    setLocked: value => { locked = value; }
  };
}

const uid = number => 'U' + number.toString(16).padStart(32, '0');
function addNotice(h, id = 'N001', text = '今天上課請帶筆記本。') {
  h.sheet('通知').appendRow([id, '', text, '是']);
}
function addStudent(h, number, enabled = '是') {
  h.sheet('學生').appendRow([uid(number), enabled, new Date(), new Date()]);
}
function message(h, title) {
  return h.alerts.find(alert => alert.title === title)?.message || '';
}

function basicFlow() {
  const h = harness();
  h.context.onOpen();
  assert.deepEqual(h.menu, [
    {label: 'LINE 通知'}, {text: '立即發送選取的通知', fn: 'sendSelectedNoticeNow'}
  ]);
  addNotice(h);
  addStudent(h, 1);
  addStudent(h, 2);
  addStudent(h, 1); // Duplicate student rows still mean one recipient.
  addStudent(h, 3, '否');
  h.sheet('學生').appendRow(['not-a-line-id', '是', '', '']);
  h.choose('NO');
  h.run();
  assert.match(message(h, '確認立即發送'), /有效訂閱者：2 人/);
  assert.equal(h.pushes.length, 0);
  assert.equal(h.sheet('通知').rows[1][1], '');
  h.choose('YES');
  h.run();
  assert.equal(h.pushes.length, 2);
  assert.equal(h.pushes[0].options.headers.Authorization, 'Bearer FAKE_TEST_TOKEN');
  assert.equal(h.pushes[0].body.messages[0].text, '今天上課請帶筆記本。');
  assert.ok(h.sheet('通知').rows[1][1] instanceof Date);
  assert.deepEqual(h.sheet('發送紀錄').rows.slice(1).map(row => row[0]), ['通知:N001', '通知:N001']);
  assert.deepEqual(h.sheet('發送紀錄').rows.slice(1).map(row => row[3]), ['成功', '成功']);
  assert.match(message(h, '立即發送結果'), /LINE API 已接受：2 人/);
  h.run();
  assert.equal(h.pushes.length, 2);
  assert.match(message(h, '這筆通知已完成'), /不會重複發送/);
  h.context.sendDueNotifications();
  assert.equal(h.pushes.length, 2); // Original scheduler sees the same success keys.
  assert.equal(h.logs.some(log => log.includes('FAKE_TEST_TOKEN')), false);
}

function retryAndCap() {
  const h = harness();
  addNotice(h, 'N-CAP', '限額測試');
  for (let i = 0; i < 25; i++) addStudent(h, i);
  h.failNext(1);
  h.run();
  assert.equal(h.pushes.length, 20);
  assert.match(message(h, '立即發送結果'), /失敗：1 人/);
  assert.match(message(h, '立即發送結果'), /仍待處理：6 人/);
  assert.equal(h.sheet('發送紀錄').rows.length, 21);
  assert.match(h.sheet('發送紀錄').rows[1][3], /失敗：LINE API HTTP 500/);
  h.run();
  assert.equal(h.pushes.length, 26); // Retry one failure + five recipients after cap.
  assert.equal(h.sheet('發送紀錄').rows.length, 26); // Reuses failed log row.
  assert.ok(h.sheet('發送紀錄').rows.slice(1).every(row => row[3] === '成功'));
  assert.match(message(h, '立即發送結果'), /仍待處理：0 人/);
}

function failedRecipientsDoNotBlockNewRecipients() {
  const h = harness();
  addNotice(h, 'N-RETRY', '重試排序');
  h.sheet('通知').rows[1][3] = true; // Same checkbox value accepted by the original scheduler.
  for (let i = 0; i < 25; i++) addStudent(h, i);
  h.failNext(20);
  h.run();
  assert.equal(h.pushes.length, 20);
  h.run();
  assert.equal(h.pushes.length, 40);
  assert.deepEqual(h.pushes.slice(20, 25).map(push => push.body.to),
    [uid(20), uid(21), uid(22), uid(23), uid(24)]);
  assert.equal(h.sheet('發送紀錄').rows.slice(1).filter(row => row[3] === '成功').length, 20);
}

function validationAndRaces() {
  const h = harness();
  addNotice(h);
  addStudent(h, 1);
  h.select('題庫');
  h.run();
  assert.match(message(h, '無法立即發送'), /請先到「通知」分頁/);
  h.select('通知', 2, 2);
  h.run();
  assert.match(message(h, '無法立即發送'), /一次只能選一列/);
  h.select('通知');
  h.sheet('通知').appendRow(['N001', '', '重複', '是']);
  h.run();
  assert.match(message(h, '無法立即發送'), /重複/);
  h.sheet('通知').rows.pop();
  h.onConfirm(() => { h.sheet('通知').rows[1][2] = '被改過的內容'; });
  h.run();
  assert.match(message(h, '無法立即發送'), /內容已更改/);
  assert.equal(h.pushes.length, 0);
  assert.equal(h.sheet('通知').rows[1][1], '');
  h.onConfirm(() => { addStudent(h, 2); });
  h.run();
  assert.match(message(h, '無法立即發送'), /訂閱名單已更改/);
  assert.equal(h.pushes.length, 0);
  h.onConfirm(null);
  h.setLocked(true);
  h.run();
  assert.match(message(h, '無法立即發送'), /另一個通知工作正在執行/);
  h.setLocked(false);
  h.properties.delete('LINE_ACCESS_TOKEN');
  h.run();
  assert.match(message(h, '無法立即發送'), /LINE_ACCESS_TOKEN/);
  assert.equal(h.sheet('通知').rows[1][1], '');
  assert.equal(h.pushes.length, 0);
}

basicFlow();
retryAndCap();
failedRecipientsDoNotBlockNewRecipients();
validationAndRaces();
console.log('PASS: menu/button entry, preview/cancel, shared scheduler dedup, retry, 20-attempt cap, sheet validation, stale preview, lock, and missing token.');
