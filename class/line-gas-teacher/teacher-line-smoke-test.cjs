// node teacher-line-smoke-test.cjs — local fakes only; never contacts LINE or Google.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const studentCode = fs.readFileSync(path.join(__dirname, '../line-gas-starter/Code.gs'), 'utf8');
const teacherCode = fs.readFileSync(path.join(__dirname, 'TeacherLine.gs'), 'utf8');
const teacher = 'U' + 'a'.repeat(32);
const student = 'U' + 'b'.repeat(32);

function harness(withTeacher = true) {
  class Range {
    constructor(sheet, row, col, height = 1, width = 1) {
      Object.assign(this, {sheet, row, col, height, width});
    }
    getValues() {
      return Array.from({length: this.height}, (_, r) =>
        Array.from({length: this.width}, (_, c) => this.sheet.rows[this.row + r - 1]?.[this.col + c - 1] ?? ''));
    }
    setValues(values) {
      assert.equal(values.length, this.height);
      values.forEach((line, r) => {
        assert.equal(line.length, this.width);
        const index = this.row + r - 1;
        if (!this.sheet.rows[index]) this.sheet.rows[index] = [];
        line.forEach((value, c) => { this.sheet.rows[index][this.col + c - 1] = value; });
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
    getLastRow() { return this.rows.length; }
    getRange(row, col, height, width) { return new Range(this, row, col, height, width); }
    setFrozenRows() { return this; }
    appendRow(row) { this.rows.push([...row]); return this; }
  }
  const sheets = [new Sheet('工作表1')];
  const book = {
    id: 'FAKE_SHEET_ID_123456789012345',
    getId() { return this.id; }, getName() { return '測試試算表'; },
    getSheets() { return sheets; },
    getSheetByName(name) { return sheets.find(sheet => sheet.name === name) || null; },
    insertSheet(name) { const sheet = new Sheet(name); sheets.push(sheet); return sheet; },
    setSpreadsheetTimeZone() {}
  };
  const properties = new Map();
  const values = new Map();
  const calls = [];
  const logs = [];
  let locked = false;
  let uuidNumber = 0;
  const uuid = () => `00000000-0000-4000-8000-${(++uuidNumber).toString(16).padStart(12, '0')}`;
  const dateParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  const utilities = {
    getUuid: uuid,
    parseDate(text, zone, format) {
      assert.equal(zone, 'Asia/Taipei');
      const m = String(text).match(/^(\d{4})\/(\d{2})\/(\d{2})(?: (\d{2}):(\d{2}))?$/);
      if (!m) throw new Error('Invalid date');
      if (format === 'yyyy/MM/dd HH:mm' && m[4] === undefined) throw new Error('Missing time');
      return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0) - 8, +(m[5] || 0)));
    },
    formatDate(date, zone, format) {
      assert.equal(zone, 'Asia/Taipei');
      const p = dateParts(date);
      if (format === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
      if (format === 'yyyy/MM/dd') return `${p.year}/${p.month}/${p.day}`;
      return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
    }
  };
  const cache = {
    get(key) {
      const item = values.get(key);
      if (!item) return null;
      if (item.expires < Date.now()) { values.delete(key); return null; }
      return item.value;
    },
    put(key, value, ttl) { values.set(key, {value, expires: Date.now() + ttl * 1000}); },
    remove(key) { values.delete(key); }
  };
  const context = vm.createContext({
    Date, JSON, Number, String, Map, Set, Object, Array, RegExp, Math,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      openById(id) { assert.equal(id, book.id); return book; }
    },
    PropertiesService: {getScriptProperties: () => ({
      getProperty(key) { return properties.get(key) ?? null; },
      setProperty(key, value) { properties.set(key, value); },
      deleteProperty(key) { properties.delete(key); }
    })},
    CacheService: {getScriptCache: () => cache},
    LockService: {getScriptLock: () => ({
      tryLock() { if (locked) return false; locked = true; return true; },
      releaseLock() { locked = false; }
    })},
    UrlFetchApp: {fetch(url, options) {
      calls.push({url, body: JSON.parse(options.payload || '{}'), options});
      return {getResponseCode: () => 200};
    }},
    HtmlService: {createHtmlOutput: content => ({content})},
    Utilities: utilities,
    Logger: {log: line => logs.push(String(line))},
    console: {error: line => logs.push(String(line))}
  });
  vm.runInContext(studentCode, context, {filename: 'Code.gs'});
  if (withTeacher) vm.runInContext(teacherCode, context, {filename: 'TeacherLine.gs'});
  context.setup();
  properties.set('LINE_ACCESS_TOKEN', 'SECRET_TEST_TOKEN');
  properties.set('TEACHER_LINE_USER_ID', teacher);
  properties.set('TEACHER_PASSCODE', 'nontrivial-passphrase-27');
  let sequence = 0;
  function send(uid, text) {
    const event = {type: 'message', replyToken: 'fake-' + ++sequence,
      source: {type: 'user', userId: uid}, message: {type: 'text', text}};
    const before = calls.length;
    const result = context.doPost({postData: {contents: JSON.stringify({events: [event]})}});
    assert.equal(result.content, 'OK');
    return calls.slice(before).find(call => call.url.endsWith('/reply'))?.body.messages[0].text;
  }
  const sheet = name => book.getSheetByName(name);
  const pushes = () => calls.filter(call => call.url.endsWith('/push'));
  const lastChallenge = () => {
    const item = pushes().at(-1);
    assert.ok(item);
    return item.body.messages[0];
  };
  return {context, properties, values, cache, calls, logs, sheet, pushes, lastChallenge, send};
}

function fill(h, uid, command, inputs) {
  assert.match(h.send(uid, command), /通行碼/);
  assert.match(h.send(uid, 'nontrivial-passphrase-27'), /通行碼正確/);
  let answer;
  inputs.forEach(input => { answer = h.send(uid, input); });
  assert.match(answer, /確認新增/);
  const challenge = h.lastChallenge();
  assert.match(challenge.text, /不是你本人剛填的資料/);
  return challenge.quickReply.items[0].action.text;
}

function testStudentCodeAlone() {
  const h = harness(false);
  assert.match(h.send(student, '說明'), /測驗/);
  assert.match(h.send(student, '我的ID'), new RegExp(student));
  assert.doesNotMatch(h.send(teacher, '我的ID'), new RegExp(student));
  assert.match(h.send(student, '訂閱'), /訂閱成功/);
  assert.match(h.send(student, '測驗'), /隨機測驗/);
}

function testTeacherSecurityAndClass() {
  const h = harness();
  assert.match(h.send(student, '新增行事曆'), /老師專用/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, '新增行事曆'), /通行碼/);
  assert.match(h.send(teacher, 'bad-passcode'), /不正確/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, 'nontrivial-passphrase-27'), /第 1\/5 步/);
  assert.match(h.send(teacher, '週末課'), /第 2\/5 步/);
  assert.match(h.send(teacher, '2026/02/30 13:00'), /無效/);
  assert.match(h.send(teacher, '2040/11/01 13:00'), /第 3\/5 步/);
  h.send(teacher, '教室 A');
  h.send(teacher, '帶筆記');
  assert.match(h.send(teacher, '2040/11/01 14:00'), /早於課程開始時間/);
  const sessionKey = 'teacherLine:session:' + teacher;
  const nearlyExpired = JSON.parse(h.cache.get(sessionKey));
  nearlyExpired.createdAt = Date.now() - 9 * 60 * 1000;
  h.cache.put(sessionKey, JSON.stringify(nearlyExpired), 600);
  assert.match(h.send(teacher, '略過'), /確認新增/);
  const confirmationSession = JSON.parse(h.cache.get(sessionKey));
  assert.ok(confirmationSession.createdAt > Date.now() - 5000,
    'Confirmation gets a fresh 10-minute lifetime after data collection.');
  assert.equal(confirmationSession.stage, 'confirm');
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  const challenge = h.lastChallenge();
  assert.match(challenge.text, /週末課/);
  assert.match(challenge.text, /請逐項核對/);
  const confirmText = challenge.quickReply.items[0].action.text;
  assert.match(h.send(student, confirmText), /老師專用/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, '確認 ' + '0'.repeat(32)), /確認卡/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, confirmText), /已新增到/);
  assert.equal(h.sheet('行事曆').getLastRow(), 2);
  assert.ok(h.sheet('行事曆').rows[1][2] instanceof Date);
  assert.equal(h.sheet('行事曆').rows[1][6], '是');
  assert.match(h.send(teacher, confirmText), /沒有待確認/);
  assert.equal(h.sheet('行事曆').getLastRow(), 2);
  assert.match(h.send(student, '行事曆'), /週末課/);
  assert.equal(h.logs.some(line => line.includes('nontrivial-passphrase-27') ||
    line.includes(confirmText.slice(3)) || line.includes('SECRET_TEST_TOKEN')), false);
}

function testAllCategoriesAndCancel() {
  const h = harness();
  const wordConfirm = fill(h, teacher, '新增單詞',
    [' =IMPORTXML("https://example.org")', ' @evil', '略過', '略過', '略過']);
  assert.equal(h.sheet('單詞表').getLastRow(), 1);
  assert.match(h.send(teacher, wordConfirm), /已新增到/);
  assert.equal(h.sheet('單詞表').rows[1][1], "'=IMPORTXML(\"https://example.org\")");
  assert.equal(h.sheet('單詞表').rows[1][2], "'@evil");
  assert.equal(h.sheet('單詞表').rows[1][6], '是');
  h.cache.remove('teacherLine:pushCooldown:' + teacher);

  const daily1 = fill(h, teacher, '新增每日一句',
    ['2040/11/02', '族語第一句', '中文第一句', '略過']);
  h.send(teacher, daily1);
  assert.equal(h.sheet('每日一句').getLastRow(), 2);
  assert.ok(h.sheet('每日一句').rows[1][0] instanceof Date);
  h.sheet('每日一句').rows[1][0] = '2040/11/2'; // Older hand-entered date also updates, not duplicates.
  h.cache.remove('teacherLine:pushCooldown:' + teacher);
  const daily2 = fill(h, teacher, '新增每日一句',
    ['2040/11/02', '族語改寫', '中文改寫', '略過']);
  assert.match(h.send(teacher, daily2), /已更新原試算表/);
  assert.equal(h.sheet('每日一句').getLastRow(), 2);
  assert.equal(h.sheet('每日一句').rows[1][1], '族語改寫');
  h.cache.remove('teacherLine:pushCooldown:' + teacher);

  assert.match(h.send(teacher, '新增測驗題'), /通行碼/);
  h.send(teacher, 'nontrivial-passphrase-27');
  ['哪個是水果？', '書', '香蕉', '石頭'].forEach(input => h.send(teacher, input));
  assert.match(h.send(teacher, 'D'), /只能填 A、B 或 C/);
  h.send(teacher, 'B');
  assert.match(h.send(teacher, '香蕉是水果'), /確認新增/);
  const quiz = h.lastChallenge().quickReply.items[0].action.text;
  h.send(teacher, quiz);
  assert.equal(h.sheet('題庫').getLastRow(), 5); // setup seeds 3 questions.
  assert.equal(h.sheet('題庫').rows[4][5], 'B');
  assert.equal(h.sheet('題庫').rows[4][7], '是');
  h.cache.remove('teacherLine:pushCooldown:' + teacher);

  const pushBeforeNotice = h.pushes().length;
  const notice = fill(h, teacher, '新增通知', ['2040/11/02 12:00', '明天要記得帶書']);
  assert.equal(h.pushes().length, pushBeforeNotice + 1); // Only confirmation push.
  assert.equal(h.sheet('通知').getLastRow(), 1);
  h.send(teacher, notice);
  assert.equal(h.sheet('通知').getLastRow(), 2);
  assert.ok(h.sheet('通知').rows[1][1] instanceof Date);
  assert.equal(h.pushes().length, pushBeforeNotice + 1); // No immediate student push.
  h.cache.remove('teacherLine:pushCooldown:' + teacher);

  const canceled = fill(h, teacher, '新增課表',
    ['要取消的課', '2040/12/01 10:00', '略過', '略過', '略過']);
  assert.match(h.send(teacher, '取消'), /沒有改動/);
  assert.match(h.send(teacher, canceled), /沒有待確認/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, '新增課程'), /通行碼/);
  assert.match(h.send(teacher, canceled), /不正確/); // Old nonce cannot authenticate new session.
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  assert.match(h.send(teacher, '取消'), /沒有改動/);

  h.cache.remove('teacherLine:pushCooldown:' + teacher);
  const oldConfirmation = fill(h, teacher, '新增課表',
    ['舊課', '2040/12/01 10:00', '略過', '略過', '略過']);
  const activeBefore = h.cache.get('teacherLine:session:' + teacher);
  assert.match(h.send(teacher, '新增課表'), /尚未完成/); // Forged start cannot replace active confirmation.
  assert.equal(h.cache.get('teacherLine:session:' + teacher), activeBefore);
  assert.match(h.send(teacher, oldConfirmation), /已新增到/);
  assert.equal(h.sheet('行事曆').getLastRow(), 2);
}

function testGuessAndPasscodeRateLimit() {
  const h = harness();
  assert.match(h.send(teacher, '確認 ' + 'f'.repeat(32)), /沒有待確認/);
  assert.match(h.send(teacher, '新增課表'), /通行碼/);
  assert.match(h.send(teacher, 'nontrivial-passphrase-27'), /第 1\/5 步/);
  h.send(teacher, '過去的課');
  assert.match(h.send(teacher, '2020/01/01 10:00'), /未來/);
  assert.match(h.send(teacher, '取消'), /沒有改動/);
  assert.match(h.send(teacher, '新增課表'), /通行碼/);
  for (let i = 0; i < 4; i++) assert.match(h.send(teacher, 'wrong-' + i), /不正確/);
  assert.match(h.send(teacher, 'wrong-final'), /次數過多/);
  assert.match(h.send(teacher, '新增課表'), /10 分鐘後/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
  h.properties.delete('TEACHER_LINE_AUTH_FAILURES');
  h.properties.set('TEACHER_PASSCODE', '1234');
  assert.match(h.send(teacher, '新增課表'), /1234 不能當正式通行碼/);
  assert.equal(h.sheet('行事曆').getLastRow(), 1);
}

function testSessionExpiry() {
  const h = harness();
  h.send(teacher, '新增單詞');
  h.send(teacher, 'nontrivial-passphrase-27');
  const key = 'teacherLine:session:' + teacher;
  const pending = JSON.parse(h.cache.get(key));
  pending.createdAt = Date.now() - 11 * 60 * 1000;
  h.cache.put(key, JSON.stringify(pending), 600);
  assert.match(h.send(teacher, '測試中文'), /已逾時/);
  assert.equal(h.sheet('單詞表').getLastRow(), 1);
  assert.equal(h.pushes().length, 0);
}

testStudentCodeAlone();
testTeacherSecurityAndClass();
testAllCategoriesAndCancel();
testGuessAndPasscodeRateLimit();
testSessionExpiry();
console.log('PASS: 原學生指令、老師本人通行碼、五種 LINE 逐步新增、一次性推送確認、UID 阻擋、無效日期、取消與重放、公式逸出、通知不立即群發。');
