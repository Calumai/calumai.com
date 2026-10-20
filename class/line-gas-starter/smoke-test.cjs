// Run with: node smoke-test.cjs
// This exercises Code.gs with local fakes. It never calls Google or LINE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function createHarness() {
  class FakeRange {
    constructor(sheet, row, column, height = 1, width = 1) {
      Object.assign(this, {sheet, row, column, height, width});
    }
    getValues() {
      return Array.from({length: this.height}, (_, r) =>
        Array.from({length: this.width}, (_, c) =>
          this.sheet.rows[this.row + r - 1]?.[this.column + c - 1] ?? ''
        )
      );
    }
    setValues(values) {
      assert.equal(values.length, this.height);
      values.forEach((line, r) => {
        assert.equal(line.length, this.width);
        const index = this.row + r - 1;
        if (!this.sheet.rows[index]) this.sheet.rows[index] = [];
        line.forEach((value, c) => { this.sheet.rows[index][this.column + c - 1] = value; });
      });
      return this;
    }
    setValue(value) { return this.setValues([[value]]); }
    setFontWeight() { return this; }
    setBackground() { return this; }
  }

  class FakeSheet {
    constructor(name) { this.name = name; this.rows = []; }
    getName() { return this.name; }
    setName(name) { this.name = name; return this; }
    getLastRow() {
      for (let i = this.rows.length - 1; i >= 0; i--) {
        if (this.rows[i]?.some(value => value !== '' && value !== undefined)) return i + 1;
      }
      return 0;
    }
    getRange(row, column, height, width) { return new FakeRange(this, row, column, height, width); }
    setFrozenRows() { return this; }
    appendRow(row) { this.rows.push([...row]); return this; }
  }

  const sheets = [new FakeSheet('工作表1')];
  const workbook = {
    id: 'TEST_SPREADSHEET_123456789012345', timezone: 'UTC',
    getId() { return this.id; }, getName() { return '學生自己的教學表'; },
    getSheets() { return sheets; }, getSheetByName(name) { return sheets.find(s => s.name === name) || null; },
    insertSheet(name) { const sheet = new FakeSheet(name); sheets.push(sheet); return sheet; },
    setSpreadsheetTimeZone(tz) { this.timezone = tz; }
  };
  const properties = new Map();
  const cacheData = new Map();
  const triggers = [];
  const apiCalls = [];
  const logs = [];
  let failNextPush = 0;
  let locked = false;
  const scriptProperties = {
    getProperty(key) { return properties.get(key) || null; },
    setProperty(key, value) { properties.set(key, value); return this; }
  };
  const cache = {
    get(key) { return cacheData.get(key) ?? null; },
    put(key, value, ttl) { assert.equal(ttl, 21600); cacheData.set(key, value); },
    remove(key) { cacheData.delete(key); }
  };
  const sandbox = {
    Date, JSON, Number, String, Map, Set, Object, Array, RegExp,
    Math: Object.assign(Object.create(Math), {random: () => 0}),
    SpreadsheetApp: {
      getActiveSpreadsheet: () => workbook,
      openById(id) { assert.equal(id, workbook.id); return workbook; }
    },
    PropertiesService: {getScriptProperties: () => scriptProperties},
    CacheService: {getScriptCache: () => cache},
    LockService: {getScriptLock: () => ({
      tryLock() { if (locked) return false; locked = true; return true; },
      releaseLock() { locked = false; }
    })},
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger(handler) {
        const trigger = {handler, getHandlerFunction() { return handler; }};
        return {
          timeBased() { return this; }, everyMinutes(value) { trigger.minutes = value; return this; },
          create() { triggers.push(trigger); return trigger; }
        };
      }
    },
    UrlFetchApp: {
      fetch(url, options) {
        const call = {url, options, body: options.payload ? JSON.parse(options.payload) : null};
        apiCalls.push(call);
        const isPush = url.endsWith('/push');
        const code = isPush && failNextPush > 0 ? 500 : 200;
        if (isPush && failNextPush > 0) failNextPush--;
        return {getResponseCode: () => code};
      }
    },
    HtmlService: {createHtmlOutput: content => ({type: 'HtmlOutput', content})},
    Utilities: {formatDate(date, timeZone, pattern) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(date).map(part => [part.type, part.value]));
      const day = `${parts.year}-${parts.month}-${parts.day}`;
      return pattern === 'yyyy-MM-dd' ? day : `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
    }},
    Session: {getScriptTimeZone: () => 'Asia/Taipei'},
    Logger: {log: message => logs.push(String(message))},
    console: {error: message => logs.push(String(message))}
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, {filename: 'Code.gs'});

  let replyNumber = 0;
  function webhook(type, uid, text, sourceType = 'user') {
    const event = {
      type, replyToken: 'reply-' + (++replyNumber),
      source: {type: sourceType, userId: uid}
    };
    if (type === 'message') event.message = {type: 'text', text};
    const before = apiCalls.length;
    const result = context.doPost({postData: {contents: JSON.stringify({events: [event]})}});
    assert.equal(result.type, 'HtmlOutput');
    assert.equal(result.content, 'OK');
    return apiCalls.slice(before).find(call => call.url.endsWith('/reply'))?.body.messages[0].text;
  }

  return {
    context, workbook, properties, triggers, apiCalls, logs, webhook,
    sheet: name => workbook.getSheetByName(name),
    failNextPush: count => { failNextPush = count; },
    pushes: () => apiCalls.filter(call => call.url.endsWith('/push')),
    lastPush: () => apiCalls.filter(call => call.url.endsWith('/push')).at(-1)
  };
}

function testBasicFlow() {
  const h = createHarness();
  const uid = 'U' + 'a'.repeat(32);
  h.context.setup();
  assert.deepEqual(h.workbook.getSheets().map(s => s.name),
    ['學生', '行事曆', '單詞表', '每日一句', '題庫', '通知', '發送紀錄']);
  assert.equal(h.workbook.timezone, 'Asia/Taipei');
  assert.equal(h.properties.get('SPREADSHEET_ID'), h.workbook.id);
  assert.equal(h.sheet('題庫').getLastRow(), 4); // Header + three neutral samples.
  assert.deepEqual(h.sheet('題庫').rows.slice(1).map(row => row[5]), ['A', 'B', 'C']);
  assert.deepEqual(h.sheet('單詞表').rows[0],
    ['單詞ID', '中文', '族語', '例句', '例句翻譯', '音檔網址', '啟用']);
  assert.deepEqual(h.sheet('每日一句').rows[0],
    ['日期', '族語句子', '中文翻譯', '音檔網址', '啟用']);
  assert.match(h.context.wordListText_(), /沒有啟用的單詞/);
  h.sheet('單詞表').appendRow(['W001', '示範中文', 'sample', 'sample sentence', '示範例句', 'https://example.org/audio.mp3', '是']);
  h.sheet('單詞表').appendRow(['W002', '不啟用', 'hidden', '', '', '', '否']);
  h.context.setup();
  assert.equal(h.sheet('題庫').getLastRow(), 4); // setup never duplicates seed rows.
  assert.equal(h.sheet('單詞表').getLastRow(), 3); // setup preserves teacher-added rows.
  assert.throws(() => h.context.checkSetup(), /LINE_ACCESS_TOKEN/);
  h.properties.set('LINE_ACCESS_TOKEN', 'FAKE_TEST_TOKEN');
  h.context.checkSetup();
  h.context.installTrigger();
  h.context.installTrigger();
  assert.equal(h.triggers.length, 1);
  assert.equal(h.triggers[0].minutes, 15);
  assert.equal(h.context.doPost({postData: {contents: '{"events":[]}'}}).content, 'OK');

  assert.equal(h.webhook('message', uid, '訂閱', 'group'), undefined);
  assert.equal(h.sheet('學生').getLastRow(), 1);
  assert.match(h.webhook('follow', uid), /訂閱/);
  assert.equal(h.sheet('學生').getLastRow(), 1); // Follow alone does not opt in.
  assert.match(h.webhook('message', uid, '訂閱'), /訂閱成功/);
  assert.match(h.webhook('message', uid, '訂閱'), /訂閱成功/);
  assert.equal(h.sheet('學生').getLastRow(), 2);

  assert.match(h.webhook('message', uid, '說明'), /每日一句/);
  assert.match(h.webhook('message', uid, '說明'), /單詞表：查看前 5 筆單詞/);
  const shortWordList = h.webhook('message', uid, '單詞表');
  assert.match(shortWordList, /示範中文 → sample/);
  assert.doesNotMatch(shortWordList, /不啟用/);
  assert.match(shortWordList, /查單詞 蘋果/);
  assert.match(h.webhook('message', uid, '查單詞'), /請在指令後面加上/);
  assert.match(h.webhook('message', uid, '查單詞 W001'), /示範中文 → sample/);
  assert.match(h.webhook('message', uid, '查單字 Sample'), /聽音檔：https:\/\/example.org\/audio.mp3/);
  assert.match(h.webhook('message', uid, '查單詞 範中'), /sample sentence/);
  assert.match(h.webhook('message', uid, '查單詞 hidden'), /找不到/);
  for (let n = 3; n <= 8; n++) {
    h.sheet('單詞表').appendRow(['W00' + n, '中文' + n, 'word' + n, '', '', '', '是']);
  }
  const longWordList = h.webhook('message', uid, '單詞表');
  assert.match(longWordList, /中文6 → word6/);
  assert.doesNotMatch(longWordList, /中文7|中文8/); // First five enabled entries only.
  assert.match(h.webhook('message', uid, '每日一句'), /今天還沒有設定/);
  const today = new Date();
  h.sheet('每日一句').appendRow([new Date(today.getTime() - 86400000), '昨天句子', '昨天翻譯', '', '是']);
  h.sheet('每日一句').appendRow([new Date(today.getTime() + 86400000), '明天句子', '明天翻譯', '', '是']);
  h.sheet('每日一句').appendRow([new Date(today.getTime()), '不啟用句子', '不應顯示', '', '否']);
  h.sheet('每日一句').appendRow([today.toISOString(), '文字日期句子', '不應顯示', '', '是']);
  assert.match(h.webhook('message', uid, '每日一句'), /今天還沒有設定/);
  h.sheet('每日一句').appendRow([new Date(today.getTime()), '今天示範句子', '今天示範翻譯', 'https://example.org/daily.mp3', '是']);
  const daily = h.webhook('message', uid, '每日一句');
  assert.match(daily, /今天示範句子/);
  assert.match(daily, /今天示範翻譯/);
  assert.match(daily, /聽音檔：https:\/\/example.org\/daily.mp3/);
  assert.doesNotMatch(daily, /昨天句子|明天句子|不啟用句子|文字日期句子/);

  const now = Date.now();
  h.sheet('行事曆').appendRow(['C1', '示範課程', new Date(now + 2 * 3600000), '教室 A', '攜帶筆記本', new Date(now - 60000), '是']);
  h.sheet('行事曆').appendRow(['C2', '已開始課程', new Date(now - 1000), '教室 B', '', new Date(now - 3600000), '是']);
  for (let n = 3; n <= 7; n++) {
    h.sheet('行事曆').appendRow(['C' + n, '未來課程' + n, new Date(now + n * 3600000), '', '', '', '是']);
  }
  const calendar = h.webhook('message', uid, '行事曆');
  assert.match(calendar, /示範課程/);
  assert.doesNotMatch(calendar, /已開始課程/);
  assert.match(calendar, /未來課程6/);
  assert.doesNotMatch(calendar, /未來課程7/); // Only the closest five classes.

  assert.match(h.webhook('message', uid, '測驗'), /一天有幾小時/);
  assert.match(h.webhook('message', uid, '答 A'), /答對了/);
  assert.match(h.webhook('message', uid, '答 B'), /目前沒有待回答/);

  h.properties.delete('SPREADSHEET_ID');
  assert.match(h.webhook('message', uid, '行事曆'), /系統暫時無法處理/);
  h.properties.set('SPREADSHEET_ID', h.workbook.id);
  assert.doesNotMatch(h.context.safeError_(new Error('token=FAKE_TEST_TOKEN')), /FAKE_TEST_TOKEN/);

  h.sheet('通知').appendRow(['N1', new Date(now - 60000), '請記得帶課本。', '是']);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 2); // Class reminder + teacher announcement.
  assert.equal(h.sheet('發送紀錄').getLastRow(), 3);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 2); // Same ID + recipient never sends twice.

  h.sheet('通知').appendRow(['N-old', new Date(now - 25 * 3600000), '過期公告', '是']);
  h.sheet('通知').appendRow(['N-text-date', new Date(now - 60000).toISOString(), '文字日期不寄送', '是']);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 2);

  h.sheet('通知').appendRow(['N2', new Date(now - 60000), '可重試的公告', '是']);
  h.failNextPush(1);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 3);
  assert.match(h.sheet('發送紀錄').rows.at(-1)[3], /失敗：LINE API HTTP 500/);
  const logRowCount = h.sheet('發送紀錄').getLastRow();
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 4);
  assert.equal(h.sheet('發送紀錄').getLastRow(), logRowCount);
  assert.equal(h.sheet('發送紀錄').rows.at(-1)[3], '成功');

  h.webhook('unfollow', uid);
  assert.equal(h.sheet('學生').rows[1][1], '否');
  h.sheet('通知').appendRow(['N3', new Date(now - 60000), '取消訂閱後不應收到', '是']);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 4);
  assert.match(h.webhook('message', uid, '取消訂閱'), /取消訂閱/);
  assert.equal(h.sheet('學生').rows[1][1], '否');
  assert.equal(h.apiCalls.some(call => call.options.headers.Authorization !== 'Bearer FAKE_TEST_TOKEN'), false);
  assert.equal(h.logs.some(line => line.includes('FAKE_TEST_TOKEN')), false);
}

function testTwentyMessageCap() {
  const h = createHarness();
  h.context.setup();
  h.properties.set('LINE_ACCESS_TOKEN', 'FAKE_TEST_TOKEN');
  for (let n = 0; n < 25; n++) {
    h.sheet('學生').appendRow(['U' + n.toString(16).padStart(32, '0'), '是', new Date(), new Date()]);
  }
  h.sheet('通知').appendRow(['N-cap', new Date(Date.now() - 60000), '上限測試', '是']);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 20);
  assert.equal(h.logs.some(line => line.includes('已達每次 20 則上限')), true);
  h.context.sendDueNotifications();
  assert.equal(h.pushes().length, 25);
  assert.equal(h.sheet('發送紀錄').getLastRow(), 26);
}

function testUpgradeFromFiveTabs() {
  const h = createHarness();
  h.context.setup();
  h.sheet('學生').appendRow(['U' + 'b'.repeat(32), '是', new Date(), new Date()]);
  const sheets = h.workbook.getSheets();
  for (const name of ['單詞表', '每日一句']) {
    sheets.splice(sheets.findIndex(sheet => sheet.name === name), 1);
  }
  assert.equal(sheets.length, 5);
  h.context.setup();
  assert.equal(sheets.length, 7);
  assert.equal(h.sheet('學生').rows[1][1], '是');
  assert.equal(h.sheet('題庫').getLastRow(), 4);
  assert.equal(h.sheet('單詞表').getLastRow(), 1);
  assert.equal(h.sheet('每日一句').getLastRow(), 1);
}

testBasicFlow();
testTwentyMessageCap();
testUpgradeFromFiveTabs();
console.log('PASS: setup、權杖檢查、trigger、Webhook 訂閱、行事曆、單詞表清單與查詢、每日一句、隨機測驗、去重、失敗重試、20 則上限。');
