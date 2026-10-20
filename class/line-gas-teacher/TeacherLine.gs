/**
 * 老師在「原本同一個 LINE Bot」內逐步新增課務資料。
 * 與學生 Code.gs 放在同一個 Apps Script 專案；沿用原本的 7 張工作表與 LINE 權杖。
 * 指令碼屬性需另設 TEACHER_LINE_USER_ID、TEACHER_PASSCODE（至少 8 字）。
 *
 * GAS Web App 無法讀取 LINE 的 X-Line-Signature；UID 和通行碼仍不足以驗證
 * Webhook 來源。寫入前一定要用 Bot 主動推送到老師 LINE 的隨機確認碼，再驗證並消耗。
 * 不記錄通行碼或確認碼；資料只會在最終確認後寫入原試算表。
 */
const TEACHER_LINE_TTL_ = 600;
const TEACHER_LINE_AUTH_LIMIT_ = 5;
const TEACHER_LINE_PUSH_COOLDOWN_ = 30;
const TEACHER_LINE_FLOWS_ = {
  class: {
    command: '新增課表', sheet: '行事曆', label: '課表',
    fields: [
      {key: 'title', prompt: '課程名稱是什麼？', type: 'text', max: 100},
      {key: 'start', prompt: '何時開始？請輸入 YYYY/MM/DD HH:mm，例如 2026/11/01 13:00。', type: 'datetime'},
      {key: 'place', prompt: '地點在哪裡？沒有就傳「略過」。', type: 'text', max: 200, optional: true},
      {key: 'note', prompt: '有什麼備註？沒有就傳「略過」。', type: 'text', max: 1000, optional: true},
      {key: 'reminder', prompt: '何時提醒學生？請輸入 YYYY/MM/DD HH:mm；不提醒就傳「略過」。', type: 'datetime', optional: true}
    ]
  },
  word: {
    command: '新增單詞', sheet: '單詞表', label: '單詞',
    fields: [
      {key: 'chinese', prompt: '中文是什麼？', type: 'text', max: 200},
      {key: 'language', prompt: '族語是什麼？請填入經老師確認的寫法。', type: 'text', max: 200},
      {key: 'example', prompt: '例句是什麼？沒有就傳「略過」。', type: 'text', max: 1000, optional: true},
      {key: 'translation', prompt: '例句翻譯是什麼？沒有就傳「略過」。', type: 'text', max: 1000, optional: true},
      {key: 'audio', prompt: '音檔網址是什麼？請貼 https:// 完整網址；沒有就傳「略過」。', type: 'url', optional: true}
    ]
  },
  daily: {
    command: '新增每日一句', sheet: '每日一句', label: '每日一句',
    fields: [
      {key: 'date', prompt: '要顯示在哪一天？請輸入 YYYY/MM/DD，例如 2026/11/01。', type: 'date'},
      {key: 'sentence', prompt: '族語句子是什麼？請填入經老師確認的寫法。', type: 'text', max: 1000},
      {key: 'translation', prompt: '中文翻譯是什麼？', type: 'text', max: 1000},
      {key: 'audio', prompt: '音檔網址是什麼？請貼 https:// 完整網址；沒有就傳「略過」。', type: 'url', optional: true}
    ]
  },
  quiz: {
    command: '新增題目', sheet: '題庫', label: '測驗題',
    fields: [
      {key: 'question', prompt: '題目是什麼？', type: 'text', max: 1000},
      {key: 'a', prompt: '選項 A 是什麼？', type: 'text', max: 200},
      {key: 'b', prompt: '選項 B 是什麼？', type: 'text', max: 200},
      {key: 'c', prompt: '選項 C 是什麼？', type: 'text', max: 200},
      {key: 'answer', prompt: '正解是哪一個？只要傳 A、B 或 C。', type: 'answer'},
      {key: 'explanation', prompt: '解說是什麼？沒有就傳「略過」。', type: 'text', max: 1000, optional: true}
    ]
  },
  notice: {
    command: '新增通知', sheet: '通知', label: '定時通知',
    fields: [
      {key: 'due', prompt: '何時發送？請輸入未來的 YYYY/MM/DD HH:mm，例如 2026/11/01 12:00。', type: 'datetime'},
      {key: 'content', prompt: '通知內容是什麼？', type: 'text', max: 2000}
    ]
  }
};

/** 回傳 null 代表交給原本學生指令處理；老師指令只在一對一訊息中進入。 */
function teacherLineCommand_(text, uid) {
  const starts = {'新增行事曆': 'class', '新增課表': 'class', '新增課程': 'class',
    '新增單詞': 'word', '新增每日一句': 'daily', '新增題目': 'quiz',
    '新增測驗題': 'quiz', '新增通知': 'notice'};
  const isStart = Object.prototype.hasOwnProperty.call(starts, text);
  const isMenu = text === '老師指令';
  const isConfirm = /^確認(?:\s|$)/.test(text);
  const props = PropertiesService.getScriptProperties();
  const teacherUid = String(props.getProperty('TEACHER_LINE_USER_ID') || '').trim();
  if (uid !== teacherUid || !/^U[0-9a-f]{32}$/i.test(teacherUid)) {
    return isStart || isMenu || isConfirm ? '這是老師專用功能。' : null;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return '老師資料正在處理，請稍後再試。';
  try {
    const cache = CacheService.getScriptCache();
    const key = 'teacherLine:session:' + uid;
    const raw = cache.get(key);
    let session = raw ? JSON.parse(raw) : null;
    let expired = false;
    if (session && Date.now() - session.createdAt >= TEACHER_LINE_TTL_ * 1000) {
      cache.remove(key);
      session = null;
      expired = true;
    }
    if (isMenu) return '老師可傳：新增行事曆（也可傳新增課表）、新增單詞、新增每日一句、新增題目、新增通知。\n每次先輸入通行碼，再照提示填寫；最後請核對確認卡。中途傳「取消」可退出。';
    if (text === '取消' && session) {
      cache.remove(key);
      return '已取消本次新增，試算表沒有改動。';
    }
    if (isStart) {
      if (session) return '目前有一筆尚未完成的老師資料。請先完成確認，或傳「取消」後再開始新增。';
      const passcode = String(props.getProperty('TEACHER_PASSCODE') || '').trim();
      if (passcode.length < 8 || passcode.length > 128) {
        return '請先到 Apps Script「專案設定 → 指令碼屬性」設定 TEACHER_PASSCODE（8～128 字；1234 不能當正式通行碼）。';
      }
      if (teacherLineAuthBlocked_(props)) return '通行碼嘗試次數過多，請 10 分鐘後再試。';
      session = {kind: starts[text], stage: 'auth', index: 0, values: {}, createdAt: Date.now()};
      teacherLineSave_(cache, key, session);
      return '準備新增' + TEACHER_LINE_FLOWS_[session.kind].label + '。請輸入老師通行碼；通行碼不會顯示在機器人回覆，也不會寫入試算表。';
    }
    if (!session) {
      if (expired) return '老師對話已逾時，請重新傳「新增行事曆」等指令。';
      return isConfirm ? '目前沒有待確認的資料。請先傳「新增行事曆」等老師指令。' : null;
    }
    if (session.stage === 'auth') {
      if (teacherLineAuthBlocked_(props)) return '通行碼嘗試次數過多，請 10 分鐘後再試。';
      const passcode = String(props.getProperty('TEACHER_PASSCODE') || '').trim();
      if (passcode.length < 8 || passcode.length > 128) {
        cache.remove(key);
        return '老師通行碼設定無效，請到專案設定檢查 TEACHER_PASSCODE。';
      }
      if (text !== passcode) {
        const failures = teacherLineCountFailure_(props);
        if (failures >= TEACHER_LINE_AUTH_LIMIT_) {
          cache.remove(key);
          return '通行碼錯誤次數過多，請 10 分鐘後再試。';
        }
        return '通行碼不正確，請再輸入一次；剩餘 ' + (TEACHER_LINE_AUTH_LIMIT_ - failures) + ' 次。';
      }
      props.deleteProperty('TEACHER_LINE_AUTH_FAILURES');
      session.stage = 'collect';
      teacherLineSave_(cache, key, session);
      return '通行碼正確。第 1/' + TEACHER_LINE_FLOWS_[session.kind].fields.length + ' 步：' +
        TEACHER_LINE_FLOWS_[session.kind].fields[0].prompt;
    }
    if (session.stage === 'collect') {
      const flow = TEACHER_LINE_FLOWS_[session.kind];
      const field = flow.fields[session.index];
      if (!field) {
        cache.remove(key);
        return '對話資料已失效，請重新傳老師指令。';
      }
      let value;
      try { value = teacherLineValidateInput_(field, text, session.values); }
      catch (error) { return error.message + '\n請重填；中途可傳「取消」。'; }
      session.values[field.key] = value;
      session.index++;
      if (session.index < flow.fields.length) {
        teacherLineSave_(cache, key, session);
        return '第 ' + (session.index + 1) + '/' + flow.fields.length + ' 步：' + flow.fields[session.index].prompt;
      }
      session.stage = 'ready';
      teacherLineSave_(cache, key, session);
      return teacherLineChallenge_(cache, key, uid, session);
    }
    if (session.stage === 'ready') {
      return text === '送出' ? teacherLineChallenge_(cache, key, uid, session) :
        '請傳「送出」取得確認卡；或傳「取消」放棄。';
    }
    if (session.stage === 'confirm') {
      const match = text.match(/^確認\s+([0-9a-f]{32})$/i);
      if (!match || match[1].toLowerCase() !== session.nonce) {
        return '請核對 Bot 主動傳送的確認卡，再點「確認新增」；或傳「取消」。';
      }
      cache.remove(key); // 在持有 Script Lock 下先消耗一次性確認碼，避免重送寫入。
      try {
        const action = teacherLineWrite_(session);
        return action + '原試算表「' + TEACHER_LINE_FLOWS_[session.kind].sheet + '」分頁。';
      } catch (error) {
        console.error('老師新增失敗：' + safeError_(error));
        return '寫入結果無法確認。請先查看原試算表有沒有這筆資料，再決定是否重做，以免重複。';
      }
    }
    cache.remove(key);
    return '對話資料已失效，請重新傳老師指令。';
  } finally {
    lock.releaseLock();
  }
}

function teacherLineAuthState_(props) {
  const raw = props.getProperty('TEACHER_LINE_AUTH_FAILURES');
  if (!raw) return {count: 0, until: 0};
  try {
    const state = JSON.parse(raw);
    if (Number(state.until) > Date.now()) return state;
  } catch (error) { /* Reset a damaged counter; never log property contents. */ }
  props.deleteProperty('TEACHER_LINE_AUTH_FAILURES');
  return {count: 0, until: 0};
}

function teacherLineAuthBlocked_(props) {
  return Number(teacherLineAuthState_(props).count) >= TEACHER_LINE_AUTH_LIMIT_;
}

function teacherLineCountFailure_(props) {
  const state = teacherLineAuthState_(props);
  const count = Number(state.count || 0) + 1;
  props.setProperty('TEACHER_LINE_AUTH_FAILURES', JSON.stringify({
    count, until: state.until || Date.now() + TEACHER_LINE_TTL_ * 1000
  }));
  return count;
}

function teacherLineSave_(cache, key, session) {
  const remaining = Math.ceil((session.createdAt + TEACHER_LINE_TTL_ * 1000 - Date.now()) / 1000);
  if (remaining <= 0) throw new Error('老師對話已逾時。');
  cache.put(key, JSON.stringify(session), remaining);
}

function teacherLineValidateInput_(field, text, values) {
  const value = String(text || '').trim();
  if (field.optional && value === '略過') return '';
  if (!value) throw new Error('這一欄不能空白。');
  if (field.type === 'text') {
    if (value.length > field.max) throw new Error('這一欄最多 ' + field.max + ' 字。');
    return value;
  }
  if (field.type === 'url') {
    if (value.length > 500 || !/^https:\/\/[^\s]+$/i.test(value)) {
      throw new Error('請貼 https:// 開頭的完整音檔網址，最多 500 字。');
    }
    return value;
  }
  if (field.type === 'answer') {
    if (!/^[ABC]$/i.test(value)) throw new Error('正解只能填 A、B 或 C。');
    return value.toUpperCase();
  }
  const format = field.type === 'date' ? 'yyyy/MM/dd' : 'yyyy/MM/dd HH:mm';
  const date = teacherLineParseDate_(value, format);
  if (field.key === 'start' || field.key === 'due' || field.key === 'reminder') {
    if (date <= new Date()) throw new Error('時間必須在未來。');
    if (field.key === 'reminder' && date >= teacherLineParseDate_(values.start, format)) {
      throw new Error('提醒時間必須早於課程開始時間。');
    }
  }
  return value.replace(/-/g, '/');
}

function teacherLineParseDate_(input, format) {
  const text = String(input || '').trim();
  const pattern = format === 'yyyy/MM/dd' ? /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/ :
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2}) (\d{1,2}):(\d{2})$/;
  const match = text.match(pattern);
  if (!match) throw new Error('日期格式不正確，請照提示輸入。');
  const canonical = match[1] + '/' + match[2].padStart(2, '0') + '/' + match[3].padStart(2, '0') +
    (format === 'yyyy/MM/dd' ? '' : ' ' + match[4].padStart(2, '0') + ':' + match[5]);
  let date;
  try { date = Utilities.parseDate(canonical, TIME_ZONE, format); }
  catch (error) { throw new Error('日期或時間無效，請重新輸入。'); }
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) ||
      Utilities.formatDate(date, TIME_ZONE, format) !== canonical) {
    throw new Error('日期或時間無效，請重新輸入。');
  }
  return date;
}

function teacherLineChallenge_(cache, key, uid, session) {
  const cooldown = 'teacherLine:pushCooldown:' + uid;
  if (cache.get(cooldown)) return '為避免重複推送，請稍候 30 秒再傳「送出」取得確認卡。';
  const nonce = String(Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(nonce)) throw new Error('無法產生安全確認碼，請稍後再試。');
  const summary = teacherLineSummary_(session);
  session.stage = 'confirm';
  session.nonce = nonce;
  // 確認卡的 10 分鐘從送出當下起算，不沿用前面逐題填寫的開始時間。
  session.createdAt = Date.now();
  teacherLineSave_(cache, key, session);
  try {
    sendLine_('push', {
      to: uid,
      messages: [{
        type: 'text',
        text: '老師資料確認（10 分鐘內有效）\n' + summary +
          '\n\n請逐項核對；若不是你本人剛填的資料，請回覆「取消」。確認無誤才按「確認新增」。',
        quickReply: {items: [
          {type: 'action', action: {type: 'message', label: '確認新增', text: '確認 ' + nonce}},
          {type: 'action', action: {type: 'message', label: '取消', text: '取消'}}
        ]}
      }]
    });
    cache.put(cooldown, '1', TEACHER_LINE_PUSH_COOLDOWN_);
    return '已把資料摘要與「確認新增」按鈕傳到老師的 LINE；核對後點按，才會寫入試算表。';
  } catch (error) {
    session.stage = 'ready';
    delete session.nonce;
    teacherLineSave_(cache, key, session);
    console.error('老師確認卡發送失敗：' + safeError_(error));
    return '確認卡傳送失敗，資料尚未寫入；請稍後傳「送出」重試。';
  }
}

function teacherLineSummary_(session) {
  const value = session.values;
  if (session.kind === 'class') return '【課表】\n課程：' + value.title + '\n開始：' + value.start +
    '\n地點：' + (value.place || '無') + '\n備註：' + (value.note || '無') +
    '\n提醒：' + (value.reminder || '不提醒');
  if (session.kind === 'word') return '【單詞】\n中文：' + value.chinese + '\n族語：' + value.language +
    '\n例句：' + (value.example || '無') + '\n例句翻譯：' + (value.translation || '無') +
    '\n音檔：' + (value.audio || '無');
  if (session.kind === 'daily') return '【每日一句】\n日期：' + value.date + '\n族語：' + value.sentence +
    '\n中文：' + value.translation + '\n音檔：' + (value.audio || '無') +
    '\n（同日期已有內容時，確認後會更新該筆。）';
  if (session.kind === 'quiz') return '【測驗題】\n題目：' + value.question + '\nA：' + value.a +
    '\nB：' + value.b + '\nC：' + value.c + '\n正解：' + value.answer +
    '\n解說：' + (value.explanation || '無');
  return '【定時通知】\n發送時間：' + value.due + '\n內容：' + value.content +
    '\n（確認只會建立排程，不會立刻群發。）';
}

function teacherLineWrite_(session) {
  const flow = TEACHER_LINE_FLOWS_[session.kind];
  if (!flow) throw new Error('老師指令不正確。');
  const ss = book_();
  const sheet = ss.getSheetByName(flow.sheet);
  if (!sheet) throw new Error('缺少「' + flow.sheet + '」分頁，請先執行 setup。');
  const headers = COLUMNS[flow.sheet];
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.some((header, index) => actual[index] !== header)) {
    throw new Error('「' + flow.sheet + '」欄名不符，請確認原本的試算表。');
  }
  const v = session.values;
  if (session.kind === 'class') {
    const start = teacherLineParseDate_(v.start, 'yyyy/MM/dd HH:mm');
    const reminder = v.reminder ? teacherLineParseDate_(v.reminder, 'yyyy/MM/dd HH:mm') : '';
    if (start <= new Date()) throw new Error('課程開始時間必須在未來。');
    if (reminder && (reminder <= new Date() || reminder >= start)) {
      throw new Error('提醒時間必須在未來，且早於課程開始時間。');
    }
    sheet.appendRow([teacherLineUniqueId_(sheet, 'LC'), teacherLineCell_(v.title), start,
      teacherLineCell_(v.place), teacherLineCell_(v.note), reminder, '是']);
    return '已新增到';
  } else if (session.kind === 'word') {
    sheet.appendRow([teacherLineUniqueId_(sheet, 'LW'), teacherLineCell_(v.chinese),
      teacherLineCell_(v.language), teacherLineCell_(v.example),
      teacherLineCell_(v.translation), teacherLineCell_(v.audio), '是']);
    return '已新增到';
  } else if (session.kind === 'daily') {
    const date = teacherLineParseDate_(v.date, 'yyyy/MM/dd');
    const row = [date, teacherLineCell_(v.sentence), teacherLineCell_(v.translation),
      teacherLineCell_(v.audio), '是'];
    const wanted = Utilities.formatDate(date, TIME_ZONE, 'yyyy/MM/dd');
    if (sheet.getLastRow() > 1) {
      const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < dates.length; i++) {
        const cell = dates[i][0];
        let existing = cell instanceof Date ? Utilities.formatDate(cell, TIME_ZONE, 'yyyy/MM/dd') :
          String(cell || '').trim();
        const parts = existing.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (parts) existing = parts[1] + '/' + parts[2].padStart(2, '0') + '/' + parts[3].padStart(2, '0');
        if (existing === wanted) {
          sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
          return '已更新';
        }
      }
    }
    sheet.appendRow(row);
    return '已新增到';
  } else if (session.kind === 'quiz') {
    sheet.appendRow([teacherLineUniqueId_(sheet, 'LQ'), teacherLineCell_(v.question),
      teacherLineCell_(v.a), teacherLineCell_(v.b), teacherLineCell_(v.c), v.answer,
      teacherLineCell_(v.explanation), '是']);
    return '已新增到';
  } else if (session.kind === 'notice') {
    const due = teacherLineParseDate_(v.due, 'yyyy/MM/dd HH:mm');
    if (due <= new Date()) throw new Error('通知發送時間必須在未來。');
    sheet.appendRow([teacherLineUniqueId_(sheet, 'LN'), due, teacherLineCell_(v.content), '是']);
    return '已新增到';
  }
}

function teacherLineUniqueId_(sheet, prefix) {
  const oldIds = sheet.getLastRow() > 1 ?
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(row => String(row[0])) : [];
  for (let i = 0; i < 5; i++) {
    const id = prefix + '-' + String(Utilities.getUuid()).replace(/-/g, '');
    if (oldIds.indexOf(id) === -1) return id;
  }
  throw new Error('無法產生唯一資料 ID，請稍後重試。');
}

function teacherLineCell_(value) {
  const text = String(value == null ? '' : value).trim();
  // LINE 輸入是純文字；避免以 =、+、-、@ 開頭（含前置空白）被 Sheet 當公式。
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}
