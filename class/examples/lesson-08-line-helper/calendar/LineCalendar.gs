/**
 * LINE 私訊新增 Google Calendar 行程
 *
 * 安全設計：
 * 1. 行事曆使用獨立白名單，不沿用雲端搜尋權限。
 * 2. 只接受 LINE 私訊。
 * 3. 新增指令只建立 10 分鐘草稿；使用者須再回覆隨機碼才真正寫入。
 * 4. 以 webhookEventId／message.id 去重，避免 LINE 重送造成重複事件。
 */

const PROP_LINE_CALENDAR_ID = 'LINE_CALENDAR_ID';
const PROP_LINE_CALENDAR_TIME_ZONE = 'LINE_CALENDAR_TIME_ZONE';
const PROP_LINE_CALENDAR_ALLOWED_USERS = 'LINE_CALENDAR_ALLOWED_USERS';
const PROP_LINE_CALENDAR_BIND_PIN = 'LINE_CALENDAR_BIND_PIN';
const PROP_LINE_CALENDAR_BIND_EXPIRES = 'LINE_CALENDAR_BIND_EXPIRES_AT';
const PROP_LINE_CALENDAR_PENDING = 'LINE_CALENDAR_PENDING_EVENTS';
const PROP_LINE_CALENDAR_PROCESSED = 'LINE_CALENDAR_PROCESSED_EVENTS';

const LINE_CALENDAR_BIND_TTL_MS = 10 * 60 * 1000;
const LINE_CALENDAR_DRAFT_TTL_MS = 10 * 60 * 1000;
const LINE_CALENDAR_DEFAULT_DURATION_MINUTES = 60;
const LINE_CALENDAR_MAX_PENDING = 20;
const LINE_CALENDAR_MAX_PROCESSED = 80;
const LINE_CALENDAR_PROCESSED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 從 Google Sheet 選單執行。第一次留空會使用 Google 主要行事曆；也可貼上其他 Calendar ID。
 */
function setupLineCalendar() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const currentId = String(props.getProperty(PROP_LINE_CALENDAR_ID) || '').trim();

  const result = ui.prompt(
    '設定 LINE 行事曆',
    '留空白＝' + (currentId ? '沿用目前設定；輸入「主要」可改用 Google 主要行事曆' : '使用你的 Google 主要行事曆') + '。\n' +
      '若要使用另一個你擁有的行事曆，請貼上該行事曆的 Calendar ID。',
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return;

  const input = String(result.getResponseText() || '').trim();
  let calendar = null;
  try {
    if (!input && currentId) calendar = CalendarApp.getCalendarById(currentId);
    else if (!input || input === '主要') calendar = CalendarApp.getDefaultCalendar();
    else calendar = CalendarApp.getCalendarById(input);
  } catch (err) {
    calendar = null;
  }

  if (!calendar) {
    ui.alert('⚠️ 找不到這個行事曆。請確認 Calendar ID 正確，而且目前 Google 帳號有權限。');
    return;
  }
  try {
    if (typeof calendar.isOwnedByMe === 'function' && !calendar.isOwnedByMe()) {
      ui.alert('⚠️ 為避免誤寫入別人的行事曆，請選擇你自己擁有的行事曆。');
      return;
    }
  } catch (err) {}

  const calendarId = String(calendar.getId() || '').trim();
  const calendarName = String(calendar.getName() || '主要行事曆');
  const timeZone = getCalendarTimeZoneSafe_(calendar);
  if (!calendarId) {
    ui.alert('⚠️ 無法取得 Google 行事曆 ID，請改用主要行事曆再試。');
    return;
  }

  const calendarChanged = !!currentId && currentId !== calendarId;
  if (calendarChanged) {
    props.deleteProperty(PROP_LINE_CALENDAR_ALLOWED_USERS);
    props.deleteProperty(PROP_LINE_CALENDAR_PENDING);
    props.deleteProperty(PROP_LINE_CALENDAR_PROCESSED);
  }

  const pin = Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  props.setProperties({
    LINE_CALENDAR_ID: calendarId,
    LINE_CALENDAR_TIME_ZONE: timeZone,
    LINE_CALENDAR_BIND_PIN: pin,
    LINE_CALENDAR_BIND_EXPIRES_AT: String(Date.now() + LINE_CALENDAR_BIND_TTL_MS),
  }, false);

  const allowedCount = getLineCalendarAllowedUserIds_().length;
  ui.alert(
    '✅ LINE 行事曆已設定\n\n' +
    '寫入行事曆：' + calendarName + '\n' +
    '時區：' + timeZone + '\n' +
    '目前已授權 LINE 帳號：' + allowedCount + ' 個\n' +
    (calendarChanged ? '（因行事曆已更換，舊授權已撤銷。）\n' : '') + '\n' +
    '請在 10 分鐘內私訊官方帳號：\n綁定行事曆 ' + pin
  );
}

/** 撤銷所有 LINE 行事曆權限與未確認草稿，不會刪除已建立的行程。 */
function clearLineCalendarAccess() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '清除 LINE 行事曆授權',
    '確定要撤銷所有已綁定 LINE 帳號並清除待確認草稿嗎？\n已建立的 Google 行事曆活動不會被刪除。',
    ui.ButtonSet.YES_NO
  );
  if (result !== ui.Button.YES) return;

  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROP_LINE_CALENDAR_ALLOWED_USERS);
  props.deleteProperty(PROP_LINE_CALENDAR_BIND_PIN);
  props.deleteProperty(PROP_LINE_CALENDAR_BIND_EXPIRES);
  props.deleteProperty(PROP_LINE_CALENDAR_PENDING);
  props.deleteProperty(PROP_LINE_CALENDAR_PROCESSED);
  ui.alert('✅ 已撤銷所有 LINE 行事曆權限；既有行程沒有變更。');
}

/** 回傳 null 代表不是行事曆指令，讓 Code.gs 繼續分流。 */
function buildLineCalendarCommandReply(event) {
  const text = String(event && event.message && event.message.text || '').trim();
  if (!text) return null;

  const bindMatch = text.match(/^(?:綁定行事曆|行事曆綁定)\s*(.*)$/i);
  const createMatch = text.match(/^(?:新增行事曆|新增行程|新增日曆)\s*(.*)$/i);
  // 「約」後必須有空白，避免「約定」或人名等一般查詢誤觸行事曆。
  const legacyCreateMatch = createMatch ? null : text.match(/^約\s+(.+)$/i);
  const confirmMatch = text.match(/^(?:確認行事曆|確認行程)\s*(.*)$/i);
  const isWeekly = text === '查詢本週行程';
  const isHelp = /^(?:行事曆說明|行事曆指令)$/i.test(text);
  if (!bindMatch && !createMatch && !legacyCreateMatch && !confirmMatch && !isWeekly && !isHelp) return null;

  const sourceType = String(event && event.source && event.source.type || '');
  if (sourceType !== 'user') return '為避免誤建行程，LINE 行事曆只開放私人聊天使用。';

  const userId = String(event && event.source && event.source.userId || '').trim();
  if (!userId) return '無法辨識這個 LINE 帳號，請稍後再試。';

  if (bindMatch) {
    const pin = String(bindMatch[1] || '').trim();
    if (!pin) return '請輸入：綁定行事曆 你的綁定碼';
    return bindLineCalendarUser_(userId, pin);
  }

  if (!isLineCalendarUserAllowed_(userId)) {
    return '這個 LINE 帳號尚未授權新增行事曆。\n' +
      '請先回到 Google Sheet，執行「🗓️ LINE 行事曆小幫手 → 設定 LINE 行事曆」，再用一次性綁定碼完成綁定。';
  }

  if (isHelp) return getLineCalendarHelpText_();

  if (isWeekly) return buildLineWeeklyEventsReply_(event);

  if (confirmMatch) {
    const code = String(confirmMatch[1] || '').trim().toUpperCase();
    if (!code) return '請輸入：確認行事曆 確認碼';
    return confirmLineCalendarDraft_(event, userId, code);
  }

  let commandBody = String((createMatch && createMatch[1]) || (legacyCreateMatch && legacyCreateMatch[1]) || '').trim();
  if (!commandBody) return getLineCalendarHelpText_();
  if (legacyCreateMatch) commandBody = normalizeLegacyLineCalendarCommand_(commandBody);
  const eventTimestamp = Number(event && event.timestamp);
  const referenceTime = isFinite(eventTimestamp) && eventTimestamp > 0 ? new Date(eventTimestamp) : new Date();
  const parsed = parseLineCalendarCommand_(commandBody, referenceTime);
  if (!parsed.ok) return '無法建立行事曆草稿：' + parsed.error + '\n\n' + getLineCalendarHelpText_();
  return createLineCalendarDraft_(event, userId, parsed);
}

function getLineCalendarHelpText_() {
  return 'LINE 新增行事曆\n' +
    '快速全天格式：\n約 明天 族語課程\n\n' +
    '1. 指定時間：\n新增行事曆 明天 14:00-16:00 族語課程\n\n' +
    '2. 只有開始時間（預設 60 分鐘）：\n新增行事曆 明天 14:00 教師會議\n\n' +
    '3. 全天行程：\n新增行事曆 後天 全天 繳交成果\n\n' +
    '查看未來 7 天：查詢本週行程\n\n' +
    '系統會先回覆摘要與確認碼；再次輸入「確認行事曆 確認碼」才會真正建立到 Google 行事曆。';
}

function normalizeLegacyLineCalendarCommand_(body) {
  const match = String(body || '').trim().match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) return String(body || '').trim();

  const dateToken = match[1];
  const rest = String(match[2] || '').trim();
  const restParts = rest.match(/^(\S+)\s+([\s\S]+)$/);
  if (restParts && (restParts[1] === '全天' || parseLineCalendarTimeRange_(restParts[1]).ok)) {
    return dateToken + ' ' + rest;
  }
  if (parseLineCalendarTimeRange_(rest).ok) return dateToken + ' ' + rest;
  return dateToken + ' 全天 ' + rest;
}

function buildLineWeeklyEventsReply_(event) {
  try {
    const props = PropertiesService.getScriptProperties();
    const calendarId = String(props.getProperty(PROP_LINE_CALENDAR_ID) || '').trim();
    const calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : null;
    if (!calendar) return '找不到已設定的 Google 行事曆，請回到試算表重新設定。';

    const eventTimestamp = Number(event && event.timestamp);
    const start = isFinite(eventTimestamp) && eventTimestamp > 0 ? new Date(eventTimestamp) : new Date();
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const timeZone = getCalendarTimeZoneSafe_(calendar);
    const events = calendar.getEvents(start, end).sort(function (a, b) {
      return a.getStartTime().getTime() - b.getStartTime().getTime();
    });

    if (!events.length) return 'Google 行事曆未來 7 天沒有行程。';
    const lines = ['Google 行事曆未來 7 天：'];
    const shown = events.slice(0, 10);
    shown.forEach(function (calendarEvent) {
      const startTime = calendarEvent.getStartTime();
      const dateText = Utilities.formatDate(startTime, timeZone, 'MM/dd');
      let timeText = '全天';
      if (!calendarEvent.isAllDayEvent()) {
        timeText = Utilities.formatDate(startTime, timeZone, 'HH:mm') + '-' +
          Utilities.formatDate(calendarEvent.getEndTime(), timeZone, 'HH:mm');
      }
      lines.push('• ' + dateText + '（' + timeText + '）' + cleanLineCalendarText_(calendarEvent.getTitle(), 100));
    });
    if (events.length > shown.length) lines.push('…另有 ' + (events.length - shown.length) + ' 筆未顯示。');
    const reply = lines.join('\n');
    return typeof limitLineText === 'function' ? limitLineText(reply) : reply.slice(0, 4900);
  } catch (err) {
    console.error('LINE weekly calendar lookup failed: ' + String(err));
    return 'Google 行事曆暫時無法查詢，請確認 Apps Script 已取得 Calendar 權限。';
  }
}

function bindLineCalendarUser_(userId, submittedPin) {
  let lock = null;
  try {
    if (typeof LockService !== 'undefined') {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(3000)) {
        lock = null;
        return '目前有人正在綁定，請幾秒後再試。';
      }
    }

    const props = PropertiesService.getScriptProperties();
    const calendarId = String(props.getProperty(PROP_LINE_CALENDAR_ID) || '').trim();
    const expectedPin = String(props.getProperty(PROP_LINE_CALENDAR_BIND_PIN) || '').trim();
    const expiresAt = Number(props.getProperty(PROP_LINE_CALENDAR_BIND_EXPIRES) || 0);
    if (!calendarId || !expectedPin || !expiresAt) {
      return '目前沒有可用的行事曆綁定碼。請先回到 Google Sheet 執行「設定 LINE 行事曆」。';
    }
    if (Date.now() > expiresAt) {
      props.deleteProperty(PROP_LINE_CALENDAR_BIND_PIN);
      props.deleteProperty(PROP_LINE_CALENDAR_BIND_EXPIRES);
      return '行事曆綁定碼已過期，請回到 Google Sheet 重新產生。';
    }
    if (String(submittedPin || '').trim().toUpperCase() !== expectedPin.toUpperCase()) {
      return '行事曆綁定碼不正確，請確認後再試。';
    }

    const users = getLineCalendarAllowedUserIds_();
    if (users.indexOf(userId) === -1) users.push(userId);
    props.setProperty(PROP_LINE_CALENDAR_ALLOWED_USERS, JSON.stringify(users));
    props.deleteProperty(PROP_LINE_CALENDAR_BIND_PIN);
    props.deleteProperty(PROP_LINE_CALENDAR_BIND_EXPIRES);
    return '✅ LINE 行事曆綁定完成。\n輸入「行事曆說明」可查看新增格式。';
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getLineCalendarAllowedUserIds_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PROP_LINE_CALENDAR_ALLOWED_USERS) || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function (id) { return String(id || '').trim(); }).filter(function (id) { return !!id; });
  } catch (err) { return []; }
}

function isLineCalendarUserAllowed_(userId) {
  return getLineCalendarAllowedUserIds_().indexOf(String(userId || '')) !== -1;
}

/** 將使用者文字解析成不含 Date 物件、可安全存入 Script Properties 的資料。 */
function parseLineCalendarCommand_(body, now) {
  const match = String(body || '').trim().match(/^(\S+)\s+(\S+)\s+([\s\S]+)$/);
  if (!match) return { ok: false, error: '格式不足，請依照範例輸入日期、時間與標題。' };

  const timeZone = getLineCalendarTimeZone_();
  const dateResult = resolveLineCalendarDate_(match[1], now || new Date(), timeZone);
  if (!dateResult.ok) return dateResult;

  const title = cleanLineCalendarText_(match[3], 120);
  if (!title) return { ok: false, error: '行程標題不可空白。' };

  if (match[2] === '全天') {
    return { ok: true, allDay: true, dateText: dateResult.dateText, title: title, timeZone: timeZone };
  }

  const timeResult = parseLineCalendarTimeRange_(match[2]);
  if (!timeResult.ok) return timeResult;
  return {
    ok: true,
    allDay: false,
    dateText: dateResult.dateText,
    startMinutes: timeResult.startMinutes,
    endMinutes: timeResult.endMinutes,
    title: title,
    timeZone: timeZone,
  };
}

function resolveLineCalendarDate_(token, now, timeZone) {
  const text = String(token || '').trim();
  const relativeDays = { '今天': 0, '明天': 1, '後天': 2 };
  let dateText = '';

  if (Object.prototype.hasOwnProperty.call(relativeDays, text)) {
    try {
      const todayText = Utilities.formatDate(now, timeZone, 'yyyy/MM/dd');
      const todayNoon = Utilities.parseDate(todayText + ' 12:00', timeZone, 'yyyy/MM/dd HH:mm');
      dateText = Utilities.formatDate(
        new Date(todayNoon.getTime() + relativeDays[text] * 24 * 60 * 60 * 1000),
        timeZone,
        'yyyy/MM/dd'
      );
    } catch (err) {
      return { ok: false, error: '無法判斷今天的日期，請改用 YYYY/MM/DD。' };
    }
  } else {
    const absolute = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!absolute) return { ok: false, error: '日期請輸入 YYYY/MM/DD，或使用今天、明天、後天。' };
    const year = Number(absolute[1]);
    const month = Number(absolute[2]);
    const day = Number(absolute[3]);
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > daysInLineCalendarMonth_(year, month)) {
      return { ok: false, error: '日期不存在，請重新確認。' };
    }
    dateText = year + '/' + padLineCalendarNumber_(month) + '/' + padLineCalendarNumber_(day);
  }

  return { ok: true, dateText: dateText };
}

function daysInLineCalendarMonth_(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseLineCalendarTimeRange_(token) {
  const text = String(token || '').trim();
  const range = text.match(/^(.+?)(?:-|－|–|—|~|～|到)(.+)$/);
  const start = parseLineCalendarClock_(range ? range[1] : text, '');
  if (!start.ok) return start;

  let endMinutes = start.minutes + LINE_CALENDAR_DEFAULT_DURATION_MINUTES;
  if (range) {
    const end = parseLineCalendarClock_(range[2], start.period);
    if (!end.ok) return end;
    endMinutes = end.minutes;
  }

  if (endMinutes <= start.minutes || endMinutes > 24 * 60) {
    return { ok: false, error: '結束時間必須晚於開始時間，而且需在同一天內。' };
  }
  return { ok: true, startMinutes: start.minutes, endMinutes: endMinutes };
}

function parseLineCalendarClock_(token, defaultPeriod) {
  const text = String(token || '').trim();
  const match = text.match(/^(上午|下午)?(\d{1,2})(?::(\d{1,2})|[點時](?:(\d{1,2})分?)?)$/);
  if (!match) return { ok: false, error: '時間請輸入 14:30、下午3點或 14:30-16:00。' };

  const period = match[1] || defaultPeriod || '';
  let hour = Number(match[2]);
  const minute = Number(match[3] != null ? match[3] : (match[4] || 0));
  if (minute < 0 || minute > 59) return { ok: false, error: '分鐘必須介於 00～59。' };

  if (period) {
    if (hour < 1 || hour > 12) return { ok: false, error: '上午／下午時間請使用 1～12 點。' };
    if (period === '下午' && hour < 12) hour += 12;
    if (period === '上午' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return { ok: false, error: '小時必須介於 00～23。' };
  }

  return { ok: true, minutes: hour * 60 + minute, period: period };
}

function createLineCalendarDraft_(event, userId, parsed) {
  let lock = null;
  try {
    if (typeof LockService !== 'undefined') {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(5000)) {
        lock = null;
        return '目前正在處理另一筆行事曆，請幾秒後再試。';
      }
    }

    const props = PropertiesService.getScriptProperties();
    const now = Date.now();
    const requestId = getLineCalendarWebhookKey_(event);
    if (!requestId) return '這筆 LINE 訊息缺少事件編號，為避免重複建立，請重新傳送一次新增指令。';
    if (isLineCalendarWebhookProcessed_(requestId)) {
      return '這筆新增指令已經完成，不會再次產生行事曆草稿。';
    }
    const calendarId = String(props.getProperty(PROP_LINE_CALENDAR_ID) || '').trim();
    if (!calendarId) return '尚未設定可寫入的 Google 行事曆，請先回到試算表執行「設定 LINE 行事曆」。';
    let pending = getLineCalendarPending_().filter(function (item) { return Number(item.expiresAt) > now; });

    const repeated = requestId ? pending.filter(function (item) {
      return item.userId === userId && item.requestId === requestId;
    })[0] : null;
    if (repeated) return formatLineCalendarDraftReply_(repeated);

    const code = Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    const draft = {
      userId: userId,
      code: code,
      requestId: requestId,
      calendarId: calendarId,
      expiresAt: now + LINE_CALENDAR_DRAFT_TTL_MS,
      allDay: parsed.allDay,
      dateText: parsed.dateText,
      startMinutes: parsed.startMinutes == null ? null : parsed.startMinutes,
      endMinutes: parsed.endMinutes == null ? null : parsed.endMinutes,
      title: parsed.title,
      timeZone: parsed.timeZone,
    };
    pending.push(draft);
    if (pending.length > LINE_CALENDAR_MAX_PENDING) pending = pending.slice(-LINE_CALENDAR_MAX_PENDING);
    props.setProperty(PROP_LINE_CALENDAR_PENDING, JSON.stringify(pending));
    return formatLineCalendarDraftReply_(draft);
  } finally {
    if (lock) lock.releaseLock();
  }
}

function confirmLineCalendarDraft_(event, userId, code) {
  let lock = null;
  try {
    if (typeof LockService !== 'undefined') {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(5000)) {
        lock = null;
        return '目前正在處理另一筆行事曆，請幾秒後再試。';
      }
    }

    const props = PropertiesService.getScriptProperties();
    const eventKey = getLineCalendarWebhookKey_(event);
    if (!eventKey) return '這筆 LINE 訊息缺少事件編號，為避免重複建立，請重新傳送確認指令。';
    if (eventKey && isLineCalendarWebhookProcessed_(eventKey)) {
      return '這筆確認已處理過，不會重複建立行程。';
    }

    const now = Date.now();
    let pending = getLineCalendarPending_();
    const validPending = pending.filter(function (item) { return Number(item.expiresAt) > now; });
    const draft = validPending.filter(function (item) {
      return item.userId === userId && String(item.code || '').toUpperCase() === code;
    })[0];
    if (!draft) {
      props.setProperty(PROP_LINE_CALENDAR_PENDING, JSON.stringify(validPending));
      return '找不到這組確認碼，可能已過期或已經使用。請重新輸入新增行事曆指令。';
    }

    const calendarId = String(props.getProperty(PROP_LINE_CALENDAR_ID) || '').trim();
    if (String(draft.calendarId || '') !== calendarId) {
      pending = validPending.filter(function (item) { return item !== draft; });
      props.setProperty(PROP_LINE_CALENDAR_PENDING, JSON.stringify(pending));
      return '行事曆設定已經變更，這筆舊草稿已失效；請重新輸入新增指令。';
    }
    const calendar = calendarId ? CalendarApp.getCalendarById(calendarId) : null;
    if (!calendar) return '找不到已設定的 Google 行事曆，請回到試算表重新設定。';

    const eventDates = buildLineCalendarDates_(draft);
    if (!eventDates.ok) return '建立失敗：' + eventDates.error;

    const marker = '[LINE-CALENDAR-DRAFT:' + String(draft.requestId || '').slice(0, 180) + ']';
    let alreadyCreated = false;
    try {
      alreadyCreated = calendar.getEventsForDay(eventDates.start).some(function (calendarEvent) {
        return String(calendarEvent.getDescription() || '').indexOf(marker) !== -1;
      });
    } catch (err) { /* 掃描失敗時仍可依 pending 單次碼繼續 */ }

    if (!alreadyCreated) {
      const options = { description: '由 LINE 官方帳號確認建立。\n' + marker };
      let createdEvent;
      if (draft.allDay) createdEvent = calendar.createAllDayEvent(draft.title, eventDates.start, options);
      else createdEvent = calendar.createEvent(draft.title, eventDates.start, eventDates.end, options);
      try { createdEvent.addPopupReminder(15); } catch (err) {}
    }

    pending = validPending.filter(function (item) {
      return !(item.userId === userId && String(item.code || '').toUpperCase() === code);
    });
    props.setProperty(PROP_LINE_CALENDAR_PENDING, JSON.stringify(pending));
    if (eventKey) markLineCalendarWebhookProcessed_(eventKey);
    if (draft.requestId) markLineCalendarWebhookProcessed_(draft.requestId);

    return (alreadyCreated ? '這筆行程先前已建立，已完成狀態修復，不會重複新增。\n\n' : '') +
      formatLineCalendarCreatedReply_(draft);
  } catch (err) {
    console.error('LINE calendar creation failed: ' + String(err));
    return '行事曆新增失敗。請確認 Apps Script 已取得 Calendar 權限，而且設定的行事曆仍可寫入。';
  } finally {
    if (lock) lock.releaseLock();
  }
}

function getLineCalendarPending_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PROP_LINE_CALENDAR_PENDING) || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) { return []; }
}

function buildLineCalendarDates_(draft) {
  const timeZone = String(draft.timeZone || getLineCalendarTimeZone_());
  try {
    if (draft.allDay) {
      const start = Utilities.parseDate(draft.dateText + ' 00:00', timeZone, 'yyyy/MM/dd HH:mm');
      return { ok: true, start: start };
    }
    const startClock = lineCalendarMinutesToClock_(Number(draft.startMinutes));
    const endClock = lineCalendarMinutesToClock_(Number(draft.endMinutes));
    const start = Utilities.parseDate(draft.dateText + ' ' + startClock, timeZone, 'yyyy/MM/dd HH:mm');
    const end = Utilities.parseDate(draft.dateText + ' ' + endClock, timeZone, 'yyyy/MM/dd HH:mm');
    if (end.getTime() <= start.getTime()) return { ok: false, error: '結束時間必須晚於開始時間。' };
    return { ok: true, start: start, end: end };
  } catch (err) {
    return { ok: false, error: '日期或時間無法解析，請重新輸入。' };
  }
}

function formatLineCalendarDraftReply_(draft) {
  return '行事曆草稿（尚未建立）\n' +
    '標題：' + draft.title + '\n' +
    '日期：' + draft.dateText + '\n' +
    '時間：' + (draft.allDay ? '全天' : lineCalendarMinutesToClock_(draft.startMinutes) + '-' + lineCalendarMinutesToClock_(draft.endMinutes)) +
    '\n\n請在 10 分鐘內回覆：\n確認行事曆 ' + draft.code;
}

function formatLineCalendarCreatedReply_(draft) {
  return '✅ 已新增 Google 行事曆\n' +
    '標題：' + draft.title + '\n' +
    '日期：' + draft.dateText + '\n' +
    '時間：' + (draft.allDay ? '全天' : lineCalendarMinutesToClock_(draft.startMinutes) + '-' + lineCalendarMinutesToClock_(draft.endMinutes));
}

function getLineCalendarWebhookKey_(event) {
  const webhookId = String(event && event.webhookEventId || '').trim();
  if (webhookId) return 'webhook:' + webhookId.slice(0, 160);
  const messageId = String(event && event.message && event.message.id || '').trim();
  return messageId ? 'message:' + messageId.slice(0, 160) : '';
}

function getLineCalendarProcessed_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PROP_LINE_CALENDAR_PROCESSED) || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) { return []; }
}

function isLineCalendarWebhookProcessed_(eventKey) {
  const cutoff = Date.now() - LINE_CALENDAR_PROCESSED_TTL_MS;
  return getLineCalendarProcessed_().some(function (item) {
    return item && item.id === eventKey && Number(item.at) >= cutoff;
  });
}

function markLineCalendarWebhookProcessed_(eventKey) {
  const props = PropertiesService.getScriptProperties();
  const cutoff = Date.now() - LINE_CALENDAR_PROCESSED_TTL_MS;
  let processed = getLineCalendarProcessed_().filter(function (item) {
    return item && item.id && Number(item.at) >= cutoff && item.id !== eventKey;
  });
  processed.push({ id: eventKey, at: Date.now() });
  if (processed.length > LINE_CALENDAR_MAX_PROCESSED) processed = processed.slice(-LINE_CALENDAR_MAX_PROCESSED);
  props.setProperty(PROP_LINE_CALENDAR_PROCESSED, JSON.stringify(processed));
}

function getCalendarTimeZoneSafe_(calendar) {
  try {
    const value = String(calendar.getTimeZone() || '').trim();
    if (value) return value;
  } catch (err) {}
  try { return Session.getScriptTimeZone() || 'Asia/Taipei'; } catch (err) { return 'Asia/Taipei'; }
}

function getLineCalendarTimeZone_() {
  const saved = String(PropertiesService.getScriptProperties().getProperty(PROP_LINE_CALENDAR_TIME_ZONE) || '').trim();
  if (saved) return saved;
  try { return Session.getScriptTimeZone() || 'Asia/Taipei'; } catch (err) { return 'Asia/Taipei'; }
}

function lineCalendarMinutesToClock_(minutes) {
  const value = Number(minutes);
  return padLineCalendarNumber_(Math.floor(value / 60)) + ':' + padLineCalendarNumber_(value % 60);
}

function padLineCalendarNumber_(value) {
  return ('0' + Number(value)).slice(-2);
}

function cleanLineCalendarText_(value, maxLength) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const max = maxLength || 120;
  if (text.length <= max) return text;
  let sliced = text.slice(0, max);
  const lastCode = sliced.charCodeAt(sliced.length - 1);
  if (lastCode >= 0xD800 && lastCode <= 0xDBFF) sliced = sliced.slice(0, -1);
  return sliced;
}
