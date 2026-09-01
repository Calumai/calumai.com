(function initLesson04CodeGenerator(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.Lesson04CodeGenerator = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createLesson04CodeGenerator() {
  const FOLDER_ID_TOKEN = '__CALUMAI_DRIVE_FOLDER_ID__';
  const FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

  function invalid(error) {
    return { id: '', error };
  }

  function parseFolderId(value) {
    const input = String(value == null ? '' : value).trim();

    if (!input) {
      return invalid('請填入 Google Drive 音檔資料夾 ID。');
    }

    let candidate = input;

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
      let url;

      try {
        url = new URL(input);
      } catch (error) {
        return invalid('網址格式不正確，請重新複製 Google Drive 資料夾網址。');
      }

      if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') {
        return invalid('請貼上 drive.google.com 的 HTTPS 資料夾網址。');
      }

      const folderMatch = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)(?:\/|$)/);
      if (!folderMatch) {
        return invalid('這不是 Google Drive 資料夾網址，請開啟資料夾後再複製網址。');
      }

      candidate = folderMatch[1];
    }

    if (!FOLDER_ID_PATTERN.test(candidate)) {
      return invalid('資料夾 ID 只能包含英文字母、數字、連字號或底線，請確認沒有多貼空格或其他文字。');
    }

    return { id: candidate, error: '' };
  }

  function buildCode(template, folderId) {
    const parsed = parseFolderId(folderId);
    if (parsed.error) {
      throw new Error(parsed.error);
    }

    const parts = String(template).split(FOLDER_ID_TOKEN);
    if (parts.length !== 2) {
      throw new Error('Code.gs 範本格式不正確，請重新載入頁面。');
    }

    return parts[0] + parsed.id + parts[1];
  }

  return Object.freeze({
    FOLDER_ID_TOKEN,
    parseFolderId,
    buildCode
  });
});
