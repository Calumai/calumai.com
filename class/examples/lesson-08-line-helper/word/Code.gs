/**
 * LINE 單詞小幫手（教學版）
 *
 * 使用前：
 * 1. 在 Script Properties 設定 LINE_TOKEN。
 * 2. 回到綁定的 Google Sheet，重新整理後執行
 *    「📖 LINE 單詞小幫手 → 初始化／檢查單詞列表」。
 * 3. 部署成 Web App，將 /exec 網址填入 LINE Webhook。
 */

const WORD_SHEET_NAME = '單詞列表';
const WORD_SHEET_ID_PROPERTY = 'WORD_SHEET_ID';
const LINE_TOKEN_PROPERTY = 'LINE_TOKEN';
const WORD_HEADERS = ['啟用', '序號', '編號', '中文', '族語', '備註', '級別', '類別'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📖 LINE 單詞小幫手')
    .addItem('初始化／檢查單詞列表', 'setupWordHelper')
    .addItem('顯示 Web App 網址', 'showWordHelperWebAppUrl')
    .addToUi();
}

/** 從試算表選單執行，記住試算表 ID 並檢查欄位。 */
function setupWordHelper() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ui.alert('⚠️ 請從 Google 試算表的「擴充功能 → Apps Script」建立這份程式。');
    return;
  }

  let sheet = ss.getSheetByName(WORD_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(WORD_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, WORD_HEADERS.length).setValues([WORD_HEADERS]);
    sheet.setFrozenRows(1);
  }

  const headerError = getWordHeaderError_(sheet);
  if (headerError) {
    ui.alert('⚠️ 第 1 列欄位不正確：\n\n' + headerError + '\n\n程式沒有覆蓋原資料，請先手動修正。');
    return;
  }

  // 避免 01-01 被試算表當成日期或數字。
  sheet.getRange('C:C').setNumberFormat('@');
  PropertiesService.getScriptProperties().setProperty(WORD_SHEET_ID_PROPERTY, ss.getId());

  const count = getWordEntries_().length;
  ui.alert(
    '✅ 單詞小幫手已連結這份試算表。\n\n' +
    '工作表：' + WORD_SHEET_NAME + '\n' +
    '目前可查詢：' + count + ' 筆\n\n' +
    '新增詞條後不必重新部署。'
  );
}

function showWordHelperWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(
    url
      ? '目前 Web App 網址：\n\n' + url + '\n\n請確認結尾是 /exec。'
      : '目前尚未部署 Web App。請到 Apps Script 右上角「部署 → 新增部署」。'
  );
}

/** 瀏覽器健康檢查；LINE 實際使用 doPost。 */
function doGet() {
  return ContentService.createTextOutput('LINE 單詞小幫手運作中');
}

/** 接收 LINE Webhook；即使 LINE 驗證送來 events: [] 也回傳 200。 */
function doPost(e) {
  const result = { ok: true, handled: 0, sent: 0, failed: 0 };
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const events = Array.isArray(payload.events) ? payload.events : [];

    events.forEach(function (event) {
      if (!event || event.type !== 'message' || !event.message ||
          event.message.type !== 'text' || !event.replyToken) return;

      const query = extractWordQuery_(event);
      if (!query) return;

      result.handled++;
      let text;
      try {
        text = buildWordReply_(query);
      } catch (err) {
        console.error('Word lookup failed: ' + String(err));
        text = '單詞查詢暫時無法使用，請老師檢查試算表設定。';
      }

      if (replyToLine_(event.replyToken, text)) result.sent++;
      else result.failed++;
    });
  } catch (err) {
    result.ok = false;
    result.error = String(err);
  }
  result.ok = result.ok && result.failed === 0;
  return jsonOutput_(result);
}

function extractWordQuery_(event) {
  const text = String(event && event.message && event.message.text || '').trim();
  if (!text) return '';

  const command = text.match(/^(?:查詞|單詞)\s*[:：]?\s*(.+)$/i);
  if (command) return String(command[1] || '').trim();

  // 私訊可直接打單詞；群組必須使用「查詞」，避免機器人回覆每句對話。
  return String(event && event.source && event.source.type || '') === 'user' ? text : '';
}

function buildWordReply_(query) {
  const entries = getWordEntries_();
  const normalized = normalizeWord_(query);
  const isHelp = ['說明', '指令', 'help', '?', '？'].indexOf(normalized) >= 0;

  if (isHelp) {
    return 'LINE 單詞小幫手\n' +
      '可輸入：\n' +
      '• 族語，例如 kingal\n' +
      '• 中文，例如 一\n' +
      '• 編號，例如 01-01\n\n' +
      '目前可查詢 ' + entries.length + ' 筆。\n' +
      '群組中請輸入「查詞 kingal」。';
  }

  const matches = entries.filter(function (entry) {
    const searchableTruku = entry.truku !== '無此詞彙';
    return normalized === normalizeWord_(entry.code) ||
      normalized === normalizeWord_(entry.chinese) ||
      (searchableTruku && normalized === normalizeWord_(entry.truku));
  });

  if (!matches.length) {
    return '找不到「' + cleanLineText_(query, 80) + '」。\n' +
      '請輸入完整的族語、中文或編號；輸入「說明」可看用法。';
  }

  const blocks = matches.map(function (entry, index) {
    const lines = [];
    const truku = entry.truku === '無此詞彙' ? '無此詞彙（原詞表標示）' : entry.truku;
    if (matches.length > 1) lines.push((index + 1) + '. 族語：' + truku);
    else lines.push('族語：' + truku);
    lines.push('中文：' + entry.chinese);
    lines.push('編號：' + entry.code);
    if (entry.category) lines.push('類別：' + entry.category);
    if (entry.level) lines.push('級別：' + entry.level);
    if (entry.note) lines.push('備註：' + entry.note);
    return lines.join('\n');
  });
  return limitLineText_(blocks.join('\n\n'));
}

function getWordEntries_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = String(props.getProperty(WORD_SHEET_ID_PROPERTY) || '').trim();
  if (!spreadsheetId) throw new Error('尚未初始化；請先從試算表選單執行初始化。');

  // Web App 執行時沒有「目前開啟的試算表」，所以必須用儲存的 ID 開啟。
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName(WORD_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const headerError = getWordHeaderError_(sheet);
  if (headerError) throw new Error(headerError);

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, WORD_HEADERS.length).getDisplayValues();
  return rows.map(function (row) {
    return {
      active: isEnabled_(row[0]),
      serial: String(row[1] || '').trim(),
      code: String(row[2] || '').trim(),
      chinese: String(row[3] || '').trim(),
      truku: String(row[4] || '').trim(),
      note: String(row[5] || '').trim(),
      level: String(row[6] || '').trim(),
      category: String(row[7] || '').trim(),
    };
  }).filter(function (entry) {
    return entry.active && entry.code && entry.chinese && entry.truku;
  });
}

function getWordHeaderError_(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return '找不到欄位標題。';
  const actual = sheet.getRange(1, 1, 1, WORD_HEADERS.length).getDisplayValues()[0];
  const errors = [];
  WORD_HEADERS.forEach(function (expected, index) {
    if (String(actual[index] || '').trim() !== expected) {
      errors.push(String.fromCharCode(65 + index) + ' 欄應為「' + expected + '」');
    }
  });
  return errors.join('、');
}

function isEnabled_(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return ['是', 'true', '1', 'y', 'yes', 'v', '✓', '啟用', 'on'].indexOf(text) >= 0;
}

function normalizeWord_(value) {
  let text = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  try { text = text.normalize('NFC'); } catch (err) {}
  return text.toLowerCase();
}

function replyToLine_(replyToken, text) {
  const token = PropertiesService.getScriptProperties().getProperty(LINE_TOKEN_PROPERTY);
  if (!token || !replyToken) return false;
  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: limitLineText_(text) }],
      }),
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    if (status !== 200) console.error('LINE reply failed. HTTP ' + status);
    return status === 200;
  } catch (err) {
    console.error('LINE reply failed: ' + String(err));
    return false;
  }
}

function cleanLineText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength || 120);
}

function limitLineText_(value) {
  const text = String(value == null ? '' : value).trim() || '（沒有可回覆的內容）';
  return text.length <= 4900 ? text : text.slice(0, 4870) + '\n…（內容過長，已截短）';
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
