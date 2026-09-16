(function exposeStore(root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YutuiStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function makeStoreModule(root) {
  "use strict";

  const STORAGE_KEY = "calumai.yutui.v1.state";
  const MAX_BYTES = 2500000;
  const MAX_RECORDS = 500;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const TOOL = /^(?:0[1-9]|1[0-2])$/;
  const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
  const DRAFT_KEYS = ["values", "prompt", "result", "recordId", "recordUpdatedAt", "title", "serviceDate", "hours", "completed"];
  const RECORD_KEYS = ["id", "toolId", "title", "values", "prompt", "result", "serviceDate", "hours", "completed", "createdAt", "updatedAt"];
  const messages = {
    INVALID_DATA: "資料格式不正確，尚未儲存。請確認日期、時數及必要欄位。",
    INVALID_DATE: "日期不存在或格式不正確，請使用年、月、日。",
    INVALID_HOURS: "服務時數需為 0 到 24 的數字，最多小數點後兩位。",
    COMPLETED_RESULT_REQUIRED: "尚未填入最終成果，不能標示為已完成。請先貼上並確認成果內容。",
    INVALID_BACKUP: "這不是可辨識的工作台備份，或資料格式已損毀。現有資料沒有變更。",
    BACKUP_TOO_LARGE: "備份或工作資料超過 2.5 MB，尚未儲存。請先匯出備份，再整理不需要的內容。",
    RECORD_LIMIT: "最多保留 500 筆工作紀錄。請先匯出備份，再整理不需要的紀錄。",
    RECORD_NOT_FOUND: "這筆工作紀錄已不存在。請重新開啟工作紀錄，確認最新內容。",
    RECORD_CONFLICT: "這筆紀錄已更新，沒有覆蓋新版。請保留目前輸入，再重新開啟最新紀錄。",
    IMPORT_CONFLICT: "備份內有相同編號、內容不同的紀錄，尚未匯入。請先保留兩份備份並確認要使用的內容。",
    STORAGE_CONFLICT: "其他分頁已更新資料，這次沒有覆蓋。請保留目前輸入，再重新開啟最新內容。",
    STORAGE_CORRUPT: "這個瀏覽器的工作資料無法讀取。原始資料仍保留，請勿清除瀏覽器資料；可改用另一個瀏覽器匯入備份。",
    STORAGE_UNAVAILABLE: "瀏覽器目前無法保存工作資料。輸入內容尚未存妥，請先複製到安全的位置，再確認瀏覽器設定。",
    STORAGE_FULL: "瀏覽器的儲存空間不足，這次沒有存入。原有資料仍保留；請先複製目前輸入並匯出既有備份。",
    ID_UNAVAILABLE: "目前無法建立紀錄編號，尚未儲存。請確認使用支援的瀏覽器與安全網站。"
  };

  function issue(code) {
    const error = new Error(messages[code] || messages.INVALID_DATA);
    error.code = code;
    return error;
  }
  function fail(code) { throw issue(code); }
  function publicError(error) { return { code: error.code || "INVALID_DATA", message: messages[error.code] || messages.INVALID_DATA }; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function byteLength(text) {
    if (typeof root.TextEncoder === "function") return new root.TextEncoder().encode(text).length;
    let bytes = 0;
    for (const character of text) {
      const point = character.codePointAt(0);
      bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    }
    return bytes;
  }
  function object(value, keys, required) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail("INVALID_DATA");
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || FORBIDDEN.has(key) || keys && !keys.includes(key)
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) fail("INVALID_DATA");
    }
    if (required && required.some(key => !Object.hasOwn(value, key))) fail("INVALID_DATA");
    return value;
  }
  function text(value, max, required) {
    if (typeof value !== "string" || value.length > max || required && !value.trim()
      || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail("INVALID_DATA");
    return value;
  }
  function tool(value) { if (typeof value !== "string" || !TOOL.test(value)) fail("INVALID_DATA"); return value; }
  function id(value) { if (typeof value !== "string" || !UUID.test(value)) fail("INVALID_DATA"); return value; }
  function boolean(value) { if (typeof value !== "boolean") fail("INVALID_DATA"); return value; }
  function date(value, allowBlank) {
    if (allowBlank && value === "") return value;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) fail("INVALID_DATE");
    const parsed = new Date(value + "T00:00:00.000Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail("INVALID_DATE");
    return value;
  }
  function instant(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail("INVALID_DATA");
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail("INVALID_DATA");
    return value;
  }
  function hours(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 24
      || Math.abs(value * 100 - Math.round(value * 100)) > 0.00000001) fail("INVALID_HOURS");
    return Math.round(value * 100) / 100;
  }
  function values(input) {
    object(input);
    const keys = Object.keys(input).sort();
    if (keys.length > 40) fail("INVALID_DATA");
    const result = {};
    for (const key of keys) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key)) fail("INVALID_DATA");
      result[key] = text(input[key], 50000, false);
    }
    return result;
  }
  function settings(input) {
    object(input, ["teachingMode", "language"], ["teachingMode", "language"]);
    return { teachingMode: boolean(input.teachingMode), language: text(input.language, 100, false) };
  }
  function draft(input) {
    object(input, DRAFT_KEYS, DRAFT_KEYS);
    const result = { values: values(input.values), prompt: text(input.prompt, 100000, false), result: text(input.result, 150000, false),
      recordId: input.recordId === null ? null : id(input.recordId), recordUpdatedAt: input.recordUpdatedAt === "" ? "" : instant(input.recordUpdatedAt), title: text(input.title, 200, false),
      serviceDate: date(input.serviceDate, true), hours: hours(input.hours), completed: boolean(input.completed) };
    if (result.completed && !result.result.trim()) fail("COMPLETED_RESULT_REQUIRED");
    if (result.recordId === null && result.recordUpdatedAt !== "" || result.recordId !== null && result.recordUpdatedAt === "") fail("INVALID_DATA");
    return result;
  }
  function record(input) {
    object(input, RECORD_KEYS, RECORD_KEYS);
    const result = { id: id(input.id), toolId: tool(input.toolId), title: text(input.title, 200, true).trim(), values: values(input.values),
      prompt: text(input.prompt, 100000, false), result: text(input.result, 150000, false), serviceDate: date(input.serviceDate, false),
      hours: hours(input.hours), completed: boolean(input.completed), createdAt: instant(input.createdAt), updatedAt: instant(input.updatedAt) };
    if (result.createdAt > result.updatedAt) fail("INVALID_DATA");
    if (result.completed && !result.result.trim()) fail("COMPLETED_RESULT_REQUIRED");
    return result;
  }
  function emptyState() { return { version: 1, settings: { teachingMode: true, language: "" }, drafts: {}, records: [] }; }
  function state(input) {
    object(input, ["version", "settings", "drafts", "records"], ["version", "settings", "drafts", "records"]);
    if (input.version !== 1 || !Array.isArray(input.records)) fail("INVALID_DATA");
    if (input.records.length > MAX_RECORDS) fail("RECORD_LIMIT");
    object(input.drafts);
    const result = { version: 1, settings: settings(input.settings), drafts: {}, records: input.records.map(record) };
    const known = new Map();
    for (const item of result.records) { if (known.has(item.id)) fail("INVALID_DATA"); known.set(item.id, item); }
    for (const key of Object.keys(input.drafts).sort()) {
      tool(key);
      result.drafts[key] = draft(input.drafts[key]);
      const recordId = result.drafts[key].recordId;
      if (recordId !== null && (!known.has(recordId) || known.get(recordId).toolId !== key)) fail("INVALID_DATA");
    }
    return result;
  }
  function parseStorage(raw) {
    if (raw === null) return emptyState();
    try {
      if (typeof raw !== "string" || byteLength(raw) > MAX_BYTES) fail("STORAGE_CORRUPT");
      const data = JSON.parse(raw);
      object(data, ["format", "version", "revision", "state"], ["format", "version", "revision", "state"]);
      if (data.format !== "calumai.yutui.storage" || data.version !== 1) fail("INVALID_DATA");
      id(data.revision);
      return state(data.state);
    } catch { fail("STORAGE_CORRUPT"); }
  }
  function parseBackup(raw) {
    if (typeof raw !== "string") fail("INVALID_BACKUP");
    if (byteLength(raw) > MAX_BYTES) fail("BACKUP_TOO_LARGE");
    try {
      const data = JSON.parse(raw);
      object(data, ["format", "version", "exportedAt", "state"], ["format", "version", "exportedAt", "state"]);
      if (data.format !== "calumai.yutui.backup" || data.version !== 1) fail("INVALID_DATA");
      instant(data.exportedAt);
      return state(data.state);
    } catch (error) { fail(error.code === "RECORD_LIMIT" ? "RECORD_LIMIT" : "INVALID_BACKUP"); }
  }
  function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
  function defaultsDraft(input) {
    object(input, DRAFT_KEYS);
    return { values: {}, prompt: "", result: "", recordId: null, recordUpdatedAt: "", title: "", serviceDate: "", hours: 0, completed: false, ...input };
  }

  function createStore(providedStorage, options) {
    options = options || {};
    let storage = providedStorage;
    if (storage === undefined) { try { storage = root.localStorage; } catch { storage = null; } }
    let current = emptyState(), lastRaw = null, lastError = null, loaded = false;
    const now = typeof options.now === "function" ? options.now : () => Date.now();
    function uuid() {
      try {
        const value = typeof options.uuid === "function" ? options.uuid() : root.crypto.randomUUID();
        return id(value);
      } catch { fail("ID_UNAVAILABLE"); }
    }
    function timestamp(after) {
      const value = Number(now());
      if (!Number.isFinite(value)) fail("INVALID_DATA");
      return instant(new Date(Math.max(value, after ? Date.parse(after) + 1 : value)).toISOString());
    }
    function read() {
      try {
        if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") fail("STORAGE_UNAVAILABLE");
        return storage.getItem(STORAGE_KEY);
      } catch { fail("STORAGE_UNAVAILABLE"); }
    }
    function getState() { return clone(current); }
    function load() {
      try {
        const raw = read();
        const next = parseStorage(raw);
        current = next; lastRaw = raw; lastError = null; loaded = true;
        return { state: getState() };
      } catch (error) {
        // Keep the last known valid state and never replace an unreadable value.
        lastError = publicError(error); loaded = true;
        return { state: getState(), error: { ...lastError } };
      }
    }
    function fresh() {
      if (!loaded) load();
      const raw = read();
      const next = parseStorage(raw);
      if (lastError) {
        current = next; lastRaw = raw; lastError = null;
      } else if (raw !== lastRaw) {
        current = next; lastRaw = raw;
        fail("STORAGE_CONFLICT");
      }
      return clone(current);
    }
    function write(next) {
      next = state(next);
      if (equal(next, current)) return;
      const serialized = JSON.stringify({ format: "calumai.yutui.storage", version: 1, revision: uuid(), state: next });
      if (byteLength(serialized) > MAX_BYTES) fail("BACKUP_TOO_LARGE");
      // localStorage has no atomic compare-and-swap across processes. This
      // second check refuses changes visible before the final synchronous write.
      // The UI must also react to storage events and must not promise DB isolation.
      if (read() !== lastRaw) {
        load();
        fail(lastError ? lastError.code : "STORAGE_CONFLICT");
      }
      try { storage.setItem(STORAGE_KEY, serialized); }
      catch (error) {
        fail(error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014)
          ? "STORAGE_FULL" : "STORAGE_UNAVAILABLE");
      }
      if (read() !== serialized) { load(); fail("STORAGE_CONFLICT"); }
      current = next; lastRaw = serialized; lastError = null;
    }
    function mutate(change) {
      try {
        const next = fresh();
        const extra = change(next) || {};
        write(next);
        return { ok: true, state: getState(), ...extra };
      } catch (error) {
        return { ok: false, error: publicError(error), state: getState() };
      }
    }
    function saveDraft(toolId, input) {
      return mutate(next => { next.drafts[tool(toolId)] = draft(defaultsDraft(input)); });
    }
    function saveSettings(input) {
      return mutate(next => {
        object(input, ["teachingMode", "language"]);
        next.settings = settings({ ...next.settings, ...input });
      });
    }
    function saveRecord(input, expected) {
      return mutate(next => {
        object(input, RECORD_KEYS);
        object(expected || {}, ["expectedUpdatedAt"]);
        const incomingId = input.id === undefined || input.id === null || input.id === "" ? null : id(input.id);
        const existing = incomingId ? next.records.find(item => item.id === incomingId) : null;
        if (existing) {
          if (!expected || expected.expectedUpdatedAt !== existing.updatedAt) fail("RECORD_CONFLICT");
          if (input.createdAt !== undefined && input.createdAt !== existing.createdAt
            || input.toolId !== undefined && input.toolId !== existing.toolId) fail("RECORD_CONFLICT");
          const updated = record({ ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: timestamp(existing.updatedAt) });
          next.records[next.records.findIndex(item => item.id === existing.id)] = updated;
          return { record: clone(updated) };
        }
        if (expected && expected.expectedUpdatedAt !== undefined) fail("RECORD_NOT_FOUND");
        if (next.records.length >= MAX_RECORDS) fail("RECORD_LIMIT");
        const newId = incomingId || uuid();
        if (next.records.some(item => item.id === newId)) fail("ID_UNAVAILABLE");
        const createdAt = timestamp();
        const created = record({ values: {}, prompt: "", result: "", hours: 0, completed: false, ...input, id: newId, createdAt, updatedAt: createdAt });
        next.records.push(created);
        return { record: clone(created) };
      });
    }
    function deleteRecord(recordId, expected) {
      return mutate(next => {
        id(recordId);
        object(expected || {}, ["expectedUpdatedAt"]);
        const existing = next.records.find(item => item.id === recordId);
        if (!existing) fail("RECORD_NOT_FOUND");
        if (!expected || expected.expectedUpdatedAt !== existing.updatedAt) fail("RECORD_CONFLICT");
        next.records = next.records.filter(item => item.id !== recordId);
        for (const item of Object.values(next.drafts)) if (item.recordId === recordId) { item.recordId = null; item.recordUpdatedAt = ""; }
      });
    }
    function exportBackup() {
      // Re-read so an export includes the other tab's most recent saved data.
      const loadedState = load();
      if (loadedState.error) throw issue(loadedState.error.code);
      const serialized = JSON.stringify({ format: "calumai.yutui.backup", version: 1, exportedAt: timestamp(), state: current });
      if (byteLength(serialized) > MAX_BYTES) fail("BACKUP_TOO_LARGE");
      return serialized;
    }
    function importBackup(serialized) {
      let imported;
      try { imported = parseBackup(serialized); }
      catch (error) { return { ok: false, error: publicError(error), state: getState() }; }
      return mutate(next => {
        const summary = { importedRecords: 0, unchangedRecords: 0, keptNewerRecords: 0, importedDrafts: 0, keptLocalDrafts: 0, keptLocalSettings: lastRaw !== null };
        const known = new Map(next.records.map(item => [item.id, item]));
        for (const item of imported.records) {
          const existing = known.get(item.id);
          if (!existing) { next.records.push(item); known.set(item.id, item); summary.importedRecords++; }
          else if (equal(existing, item)) summary.unchangedRecords++;
          else if (existing.toolId === item.toolId && existing.createdAt === item.createdAt && existing.updatedAt > item.updatedAt) summary.keptNewerRecords++;
          else fail("IMPORT_CONFLICT");
        }
        if (next.records.length > MAX_RECORDS) fail("RECORD_LIMIT");
        for (const [key, item] of Object.entries(imported.drafts)) {
          if (!Object.hasOwn(next.drafts, key)) { next.drafts[key] = item; summary.importedDrafts++; }
          else if (!equal(next.drafts[key], item)) summary.keptLocalDrafts++;
        }
        if (lastRaw === null) next.settings = imported.settings;
        return { summary };
      });
    }
    load();
    return { load, getState, saveDraft, saveSettings, saveRecord, deleteRecord, exportBackup, importBackup };
  }

  return { createStore, STORAGE_KEY, MAX_BYTES, MAX_RECORDS };
});
