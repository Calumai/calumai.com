/**
 * LINE 行事曆小幫手（教學版入口）
 *
 * 同一個 Apps Script 專案還要加入 LineCalendar.gs。
 * 使用前請在 Script Properties 設定 LINE_TOKEN。
 */

const LINE_TOKEN_PROPERTY = 'LINE_TOKEN';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🗓️ LINE 行事曆小幫手')
    .addItem('設定 LINE 行事曆', 'setupLineCalendar')
    .addItem('清除 LINE 行事曆授權', 'clearLineCalendarAccess')
    .addItem('檢查目前設定', 'checkCalendarHelperSetup')
    .addItem('顯示 Web App 網址', 'showCalendarHelperWebAppUrl')
    .addToUi();
}

function checkCalendarHelperSetup() {
  const props = PropertiesService.getScriptProperties();
  const hasToken = !!props.getProperty(LINE_TOKEN_PROPERTY);
  const calendarId = String(props.getProperty('LINE_CALENDAR_ID') || '').trim();
  const allowedUsers = String(props.getProperty('LINE_CALENDAR_ALLOWED_USERS') || '[]');
  let count = 0;
  try { count = JSON.parse(allowedUsers).length; } catch (err) {}

  SpreadsheetApp.getUi().alert(
    'LINE Token：' + (hasToken ? '已設定' : '尚未設定') + '\n' +
    'Google 行事曆：' + (calendarId ? '已設定' : '尚未設定') + '\n' +
    '已綁定 LINE 帳號：' + count + ' 個'
  );
}

function showCalendarHelperWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(
    url
      ? '目前 Web App 網址：\n\n' + url + '\n\n請確認結尾是 /exec。'
      : '目前尚未部署 Web App。請到 Apps Script 右上角「部署 → 新增部署」。'
  );
}

function doGet() {
  return ContentService.createTextOutput('LINE 行事曆小幫手運作中');
}

/** 接收 LINE Webhook；LINE 驗證送來 events: [] 時也會正常回傳 200。 */
function doPost(e) {
  const result = { ok: true, handled: 0, sent: 0, failed: 0 };
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const events = Array.isArray(payload.events) ? payload.events : [];

    events.forEach(function (event) {
      if (!event || event.type !== 'message' || !event.message ||
          event.message.type !== 'text' || !event.replyToken) return;

      let reply;
      try {
        reply = buildLineCalendarCommandReply(event);
        if (reply == null) {
          // 私訊一般文字才提示說明；群組的一般對話保持安靜。
          if (String(event && event.source && event.source.type || '') !== 'user') return;
          reply = getLineCalendarHelpText_();
        }
      } catch (err) {
        // 單一事件失敗不可中止同一批中的其他 LINE 事件。
        console.error('Calendar command failed: ' + String(err));
        reply = '行事曆功能暫時無法使用，請稍後再試。';
      }

      result.handled++;
      if (replyToLine(event.replyToken, reply)) result.sent++;
      else result.failed++;
    });
  } catch (err) {
    result.ok = false;
    result.error = String(err);
    console.error('Calendar webhook failed: ' + String(err));
  }
  result.ok = result.ok && result.failed === 0;
  return jsonOutput_(result);
}

function replyToLine(replyToken, text) {
  const token = PropertiesService.getScriptProperties().getProperty(LINE_TOKEN_PROPERTY);
  if (!token || !replyToken) return false;
  try {
    const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: limitLineText(text) }],
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

function limitLineText(value) {
  const text = String(value == null ? '' : value).trim() || '（沒有可回覆的內容）';
  return text.length <= 4900 ? text : text.slice(0, 4870) + '\n…（內容過長，已截短）';
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
