/* 語推 AI 工作台：只產生提示詞，不呼叫 AI，也不傳送工作資料。 */
(() => {
  'use strict';
  const catalog = window.YutuiCatalog;
  const store = window.YutuiStore.createStore({
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key)
  });
  const main = document.querySelector('#main');
  const notice = document.querySelector('#notice');
  let loaded = store.load();
  let state = loaded.state;
  const drafts = new Map();
  const draftBaselines = new Map();
  const dirtyTools = new Set();
  const conflictedTools = new Set();
  let activeTool = null;
  let saveTimer;
  let unpersisted = false;
  let promptStale = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
  const freshDraft = () => ({ values: {}, prompt: '', result: '', recordId: null, recordUpdatedAt: '', title: '', serviceDate: today(), hours: 0, completed: false });
  const draftSignature = id => JSON.stringify(state.drafts[id] || null);
  const getDraft = id => { if (!drafts.has(id)) { drafts.set(id, { ...freshDraft(), ...(state.drafts[id] || {}), values: { ...(state.drafts[id]?.values || {}) } }); draftBaselines.set(id, draftSignature(id)); } return drafts.get(id); };
  function tell(message, error = false) { notice.textContent = message; notice.hidden = false; notice.classList.toggle('error', error); }
  function errorText(error) { return typeof error === 'string' ? error : error?.message || '資料無法儲存，請先下載目前內容，稍後再試。'; }
  function sync(result) { if (result.state) state = result.state; if (!result.ok) tell(errorText(result.error), true); return result.ok; }
  function download(text, filename, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function readForm() {
    if (!activeTool || !document.querySelector('#tool-form')) return null;
    const draft = getDraft(activeTool.id);
    activeTool.fields.forEach(field => { draft.values[field.id] = document.getElementById(`field-${field.id}`).value; });
    draft.prompt = document.querySelector('#prompt-output').value;
    draft.result = document.querySelector('#result-input').value;
    draft.title = document.querySelector('#record-title').value;
    draft.serviceDate = document.querySelector('#service-date').value;
    const hours = document.querySelector('#service-hours').value;
    draft.hours = hours === '' ? 0 : Number(hours);
    draft.completed = document.querySelector('#record-completed').checked;
    return draft;
  }
  function persistDraft() {
    clearTimeout(saveTimer);
    if (!activeTool) return true;
    if (!dirtyTools.has(activeTool.id)) return true;
    const draft = readForm(); if (!draft) return true;
    if (conflictedTools.has(activeTool.id)) { showConflict(); return false; }
    const result = store.saveDraft(activeTool.id, draft);
    const success = sync(result);
    if (success) { dirtyTools.delete(activeTool.id); draftBaselines.set(activeTool.id, draftSignature(activeTool.id)); }
    else if (result.error?.code === 'STORAGE_CONFLICT') { conflictedTools.add(activeTool.id); showConflict(); }
    unpersisted = dirtyTools.size > 0;
    const status = document.querySelector('#draft-status');
    if (status) status.textContent = success ? '草稿已保存在這個瀏覽器。' : '草稿尚未儲存。請先下載提示詞或目前文字，避免遺失。';
    return success;
  }
  function queueDraft() { readForm(); dirtyTools.add(activeTool.id); unpersisted = true; clearTimeout(saveTimer); saveTimer = setTimeout(persistDraft, 450); }
  function showConflict() {
    tell('其他分頁已更新這份草稿，已暫停自動儲存，沒有覆蓋新版。請先下載目前文字，再按「載入最新草稿」。', true);
    const button = document.querySelector('#reload-draft'); if (button) button.hidden = false;
  }
  function renderHome() {
    const month = today().slice(0, 7);
    const completed = state.records.filter(record => record.completed && record.serviceDate.startsWith(month));
    const sum = records => Math.round(records.reduce((total, record) => total + record.hours, 0) * 100) / 100;
    const hours = sum(completed);
    main.innerHTML = `<section class="hero"><div><div class="eyebrow">LANGUAGE · EVERYDAY WORK</div><h1>把時間留給族語，<br>把整理交給好工具。</h1><p>家庭輔導、部落活動、語料整理到行政報告。選一個工具，寫下需求，就能帶著提示詞開始工作。</p></div><aside class="workflow-note"><strong>三步驟，整理好一份工作</strong><ol><li>寫需求、產生提示詞</li><li>複製到你慣用的 AI</li><li>貼回確認過的結果、保存</li></ol></aside></section>
      <div class="stats" aria-label="本月工作統計"><div class="stat"><strong data-stat="hours">${hours}</strong><span>本月實際服務時數</span></div><div class="stat"><strong data-stat="completed">${completed.length}</strong><span>本月已完成紀錄</span></div><div class="stat"><strong data-stat="records">${state.records.length}</strong><span>全部工作紀錄</span></div><div class="stat"><strong data-stat="drafts">${Object.keys(state.drafts).filter(id => Object.values(state.drafts[id].values).some(v => v.trim()) || state.drafts[id].result || state.drafts[id].prompt).length}</strong><span>工具草稿</span></div></div><p class="stat-note">本月：${month.replace('-', ' 年 ')} 月。只統計標記「已完成」的紀錄；規劃時間不會自動算成服務時數。</p>
      <div id="tool-grid">${catalog.categories.map(category => `<section><div class="section-heading"><h2>${esc(category.title)}</h2><span>${catalog.tools.filter(tool => tool.category === category.id).length} 個實用工具</span></div><div class="tool-cards">${catalog.tools.filter(tool => tool.category === category.id).map(tool => `<a class="tool-card" data-tool="${tool.id}" href="#tool/${tool.id}"><span class="tool-number">TOOL ${tool.id}</span>${state.drafts[tool.id]?.prompt ? '<span class="draft-tag">繼續草稿</span>' : ''}<span class="arrow" aria-hidden="true">↗</span><h3>${esc(tool.title)}</h3><p>${esc(tool.description)}</p></a>`).join('')}</div></section>`).join('')}</div>`;
  }
  function fieldHTML(field, draft) {
    const value = draft.values[field.id] || '';
    const attrs = `id="field-${esc(field.id)}" name="${esc(field.id)}" ${field.required ? 'required' : ''} aria-describedby="hint-${esc(field.id)} error-${esc(field.id)}"`;
    let control;
    if (field.type === 'select') control = `<select ${attrs}><option value="">請選擇（選填）</option>${field.options.map(option => `<option value="${esc(option)}" ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
    else if (field.type === 'textarea') control = `<textarea ${attrs} maxlength="12000" placeholder="${esc(field.placeholder || '')}">${esc(value)}</textarea>`;
    else control = `<input ${attrs} type="text" maxlength="500" placeholder="${esc(field.placeholder || '')}" value="${esc(value)}">`;
    return `<div class="field"><label for="field-${esc(field.id)}">${esc(field.label)}${field.required ? '' : '（選填）'}</label>${control}<small id="hint-${esc(field.id)}" ${state.settings.teachingMode ? '' : 'hidden'}>${esc(field.hint || '')}</small><small class="field-error" id="error-${esc(field.id)}"></small></div>`;
  }
  function renderTool(id) {
    const tool = catalog.getTool(id);
    if (!tool) { renderHome(); tell('找不到這個工具，請從工作工具重新選擇。', true); return; }
    activeTool = tool; promptStale = false;
    const draft = getDraft(id);
    main.innerHTML = `<a class="back" href="#home">← 所有工具</a><div class="page-heading"><div class="eyebrow">TOOL ${id}</div><h1>${esc(tool.title)}</h1><p>${esc(tool.description)}</p></div>
      <div class="tool-layout"><div><section class="panel"><div class="panel-heading"><h2>這次想完成什麼？</h2><span class="step-label">01 寫需求</span></div><form id="tool-form" novalidate>${fieldHTML(tool.fields.find(field => field.id === tool.primaryField), draft)}<details class="optional"><summary>補充資訊（選填）</summary>${tool.fields.filter(field => field.id !== tool.primaryField).map(field => fieldHTML(field, draft)).join('')}</details><div class="actions"><button class="primary" id="generate-prompt" type="submit">${draft.prompt ? '重新產生提示詞' : '產生提示詞'}</button><button id="fill-example" type="button">帶入示範</button></div><p class="privacy-note">請用家庭代號，避免填入姓名、電話等個人資料。</p></form><p class="save-state" id="draft-status">草稿會自動保存在這個瀏覽器。</p></section>
      <section class="panel result-panel"><div class="panel-heading"><h2>留下一份工作紀錄</h2><span class="step-label">03 保存成果</span></div><p class="section-intro">把 AI 回覆確認、修改後貼回來，也可以直接記下你的工作成果。</p><div class="field"><label for="result-input">確認過的結果或工作筆記</label><textarea class="result-box" id="result-input" maxlength="80000" placeholder="AI 內容可能有誤，請確認族語、文化內容及事實後再保存。">${esc(draft.result)}</textarea></div><details id="record-details"><summary>紀錄名稱、日期與實際時數</summary><div class="field"><label for="record-title">紀錄名稱</label><input id="record-title" maxlength="160" value="${esc(draft.title)}" placeholder="未填會使用工具名稱"></div><div class="metadata"><div class="field"><label for="service-date">工作日期</label><input id="service-date" type="date" value="${esc(draft.serviceDate)}" required></div><div class="field"><label for="service-hours">實際時數</label><input id="service-hours" type="number" min="0" max="24" step="0.01" value="${esc(draft.hours)}"><small>尚未執行請填 0。</small></div></div></details><label class="check-label"><input id="record-completed" type="checkbox" ${draft.completed ? 'checked' : ''}><span>這份工作已完成<br><small class="muted">勾選後，實際時數才會計入首頁統計。</small></span></label><div class="actions"><button class="primary" id="save-record">${draft.recordId ? '更新工作紀錄' : '儲存工作紀錄'}</button><button id="download-result">下載目前文字</button>${draft.recordId ? '<button id="new-record">另存新紀錄</button>' : ''}</div><p class="save-state" id="record-status">${draft.recordId ? '正在編輯已保存的紀錄；更新前不會更動原紀錄。' : '紀錄只存在這個瀏覽器。'}</p></section></div>
      <section class="panel prompt-panel"><div class="panel-heading"><h2>把提示詞帶去 AI</h2><span class="step-label">02 複製使用</span></div><p class="section-intro">這裡依照你的需求整理提示詞。複製後貼到 ChatGPT、Gemini 等工具，才會取得 AI 回覆。</p><label class="field-label" for="prompt-output">可直接修改的提示詞</label><textarea class="output" id="prompt-output" maxlength="80000" placeholder="填好左邊的需求，按「產生提示詞」。">${esc(draft.prompt)}</textarea><p id="prompt-stale" class="stale" hidden>需求已變更。可重新產生提示詞，或直接在上方調整。</p><div class="actions"><button id="copy-prompt" class="primary" ${draft.prompt.trim() ? '' : 'disabled'}>複製提示詞</button><button id="download-prompt" ${draft.prompt.trim() ? '' : 'disabled'}>下載提示詞</button></div><div class="hint" ${state.settings.teachingMode ? '' : 'hidden'}>族語翻譯、拼寫與文化內容，請交由熟悉該語別的人確認。AI 不知道的部分應保留「待確認」，不要當成事實。</div></section></div>`;
    // DOM 與手機閱讀順序一致：需求 → 提示詞 → 成果；桌面用 grid 排兩欄。
    const layout = main.querySelector('.tool-layout'); const left = layout.firstElementChild;
    const requestPanel = left.firstElementChild; const resultPanel = left.lastElementChild;
    layout.prepend(requestPanel); layout.append(resultPanel); left.remove();
    main.querySelectorAll('input, textarea, select').forEach(input => input.addEventListener('input', () => {
      if (input.id.startsWith('field-') && document.querySelector('#prompt-output').value) { promptStale = true; document.querySelector('#prompt-stale').hidden = false; }
      if (input.id === 'prompt-output') setPromptButtons();
      queueDraft();
    }));
    document.querySelector('#tool-form').addEventListener('submit', generatePrompt);
    document.querySelector('#fill-example').addEventListener('click', () => {
      const current = readForm();
      if (Object.values(current.values).some(value => value.trim()) && !window.confirm('要以示範取代目前需求欄位嗎？已產生的提示詞與成果會保留。')) return;
      for (const field of tool.fields) document.getElementById(`field-${field.id}`).value = tool.example[field.id] || '';
      promptStale = Boolean(current.prompt); document.querySelector('#prompt-stale').hidden = !promptStale; queueDraft();
      tell('已帶入合成示範。請改成自己的需求，再產生提示詞。');
    });
    document.querySelector('#copy-prompt').addEventListener('click', copyPrompt);
    document.querySelector('#download-prompt').addEventListener('click', () => download(document.querySelector('#prompt-output').value, `${tool.title}-提示詞.txt`));
    document.querySelector('#download-result').addEventListener('click', () => { const current = readForm(); download(recordText({ ...current, toolId: id }), `${tool.title}-工作內容.txt`); });
    document.querySelector('#save-record').addEventListener('click', saveRecord);
    document.querySelector('#new-record')?.addEventListener('click', () => saveRecord(true));
    const reload = document.createElement('button'); reload.id = 'reload-draft'; reload.textContent = '載入最新草稿'; reload.hidden = !conflictedTools.has(id);
    document.querySelector('#draft-status').after(reload);
    reload.addEventListener('click', () => {
      if (!window.confirm('要捨棄這個分頁尚未存妥的輸入，載入最新草稿嗎？請先下載要保留的內容。')) return;
      const result = store.load(); state = result.state;
      if (result.error) { tell(errorText(result.error), true); return; }
      drafts.delete(id); draftBaselines.delete(id); dirtyTools.delete(id); conflictedTools.delete(id); unpersisted = dirtyTools.size > 0;
      renderTool(id); tell('已載入最新草稿。');
    });
    if (conflictedTools.has(id)) showConflict();
  }
  function setPromptButtons() { const empty = !document.querySelector('#prompt-output').value.trim(); document.querySelector('#copy-prompt').disabled = empty; document.querySelector('#download-prompt').disabled = empty; }
  function generatePrompt(event) {
    event.preventDefault(); const draft = readForm(); const check = catalog.validateForm(activeTool.id, draft.values);
    for (const field of activeTool.fields) { document.getElementById(`error-${field.id}`).textContent = check.errors[field.id] || ''; document.getElementById(`field-${field.id}`).setAttribute('aria-invalid', check.errors[field.id] ? 'true' : 'false'); }
    if (!check.ok) { tell(Object.values(check.errors)[0], true); const invalid = main.querySelector('[aria-invalid="true"]'); invalid?.closest('details')?.setAttribute('open', ''); invalid?.focus(); return; }
    if (draft.prompt && !window.confirm('重新產生會取代上方提示詞（包含你手動改過的文字），工作成果不會更動。確定繼續？')) return;
    try { document.querySelector('#prompt-output').value = catalog.buildPrompt(activeTool.id, draft.values, state.settings); }
    catch (error) { tell(errorText(error), true); return; }
    promptStale = false; document.querySelector('#prompt-stale').hidden = true; setPromptButtons();
    document.querySelector('#generate-prompt').textContent = '重新產生提示詞';
    dirtyTools.add(activeTool.id); const saved = persistDraft();
    if (saved) tell('提示詞已整理好。按「複製提示詞」，貼到你慣用的 AI 工具。');
    document.querySelector('#prompt-output').focus();
  }
  async function copyPrompt() {
    const output = document.querySelector('#prompt-output');
    try { await navigator.clipboard.writeText(output.value); tell('提示詞已複製，可以貼到你的 AI 工具。'); }
    catch { output.focus(); output.select(); tell('瀏覽器未允許自動複製，已選取提示詞。請按 Ctrl+C／⌘C，手機請長按後選「複製」。', true); }
  }
  function saveRecord(asNew = false) {
    // addEventListener 傳入的是 Event，只有明確傳 true 才另存。
    asNew = asNew === true;
    const draft = readForm();
    if (conflictedTools.has(activeTool.id)) { showConflict(); return; }
    if (!draft.result.trim() && !draft.prompt.trim()) { tell('請先產生提示詞，或填入工作筆記，再儲存紀錄。', true); return; }
    const date = document.querySelector('#service-date'); const hours = document.querySelector('#service-hours');
    if (!date.checkValidity() || !hours.checkValidity()) { document.querySelector('#record-details').open = true; (date.checkValidity() ? hours : date).reportValidity(); tell('請填寫有效工作日期，實際時數需介於 0 到 24 小時。', true); return; }
    const prior = !asNew && draft.recordId ? state.records.find(record => record.id === draft.recordId) : null;
    if (!asNew && draft.recordId && !prior) { tell('原紀錄已在另一個分頁刪除。文字仍保留，可按「另存新紀錄」。', true); return; }
    const record = { toolId: activeTool.id, title: draft.title.trim() || activeTool.title, values: draft.values, prompt: draft.prompt, result: draft.result, serviceDate: draft.serviceDate, hours: draft.hours, completed: draft.completed };
    if (prior) { record.id = prior.id; record.createdAt = prior.createdAt; record.updatedAt = prior.updatedAt; }
    const result = store.saveRecord(record, prior ? { expectedUpdatedAt: draft.recordUpdatedAt || prior.updatedAt } : {});
    if (!sync(result)) { dirtyTools.add(activeTool.id); unpersisted = true; if (result.error?.code === 'STORAGE_CONFLICT') { conflictedTools.add(activeTool.id); showConflict(); } return; }
    const saved = result.record;
    draft.recordId = saved.id; draft.recordUpdatedAt = saved.updatedAt; draft.title = saved.title;
    document.querySelector('#record-title').value = saved.title;
    dirtyTools.add(activeTool.id); const draftOK = persistDraft();
    renderTool(activeTool.id);
    document.querySelector('#record-status').textContent = `已保存在這個瀏覽器 · ${new Date(saved.updatedAt).toLocaleString('zh-TW')}`;
    if (draftOK) tell(asNew ? '已另存為新紀錄，原紀錄保留。' : '工作紀錄已保存在這個瀏覽器。可繼續修改，或到「工作紀錄」查看。');
  }
  function recordText(record) {
    const tool = catalog.getTool(record.toolId);
    const fields = Object.entries(record.values || {}).map(([key, value]) => `${tool?.fields.find(field => field.id === key)?.label || key}：${value}`).join('\n');
    return `${record.title || tool?.title || '工作紀錄'}\n工作日期：${record.serviceDate}\n狀態：${record.completed ? '已完成' : '整理中'}\n實際時數：${record.hours}\n\n【需求欄位】\n${fields}\n\n【提示詞】\n${record.prompt}\n\n【確認過的結果／工作筆記】\n${record.result}\n`;
  }
  function renderRecords() {
    main.innerHTML = `<div class="page-heading"><div class="eyebrow">MY WORK</div><h1>工作紀錄</h1><p>回到做過的工作，接著整理。這裡只顯示這個瀏覽器保存或匯入的紀錄。</p></div><div class="record-toolbar"><div class="field"><label for="record-search">找一份紀錄</label><input type="search" id="record-search" placeholder="搜尋名稱、筆記或提示詞"></div><div class="field"><label for="record-filter">工具類型</label><select id="record-filter"><option value="">全部工具</option>${catalog.tools.map(tool => `<option value="${tool.id}">${esc(tool.title)}</option>`).join('')}</select></div></div><div id="records-list"></div>`;
    const list = () => {
      const query = document.querySelector('#record-search').value.trim().toLocaleLowerCase(); const filter = document.querySelector('#record-filter').value;
      const records = state.records.filter(record => (!filter || record.toolId === filter) && `${record.title} ${record.result} ${record.prompt}`.toLocaleLowerCase().includes(query)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      document.querySelector('#records-list').innerHTML = records.length ? records.map(record => `<article class="record" data-record-id="${esc(record.id)}"><div class="record-head"><h2>${esc(record.title)}</h2><span class="badge">${record.completed ? '已完成' : '整理中'}</span></div><p class="record-meta">${esc(catalog.getTool(record.toolId)?.title || '')} · ${esc(record.serviceDate)} · 實際 ${record.hours} 小時<br>最後更新 ${esc(new Date(record.updatedAt).toLocaleString('zh-TW'))}</p><p class="record-snippet">${esc((record.result || record.prompt).slice(0, 150))}${(record.result || record.prompt).length > 150 ? '…' : ''}</p><div class="actions"><button data-action="edit">開啟編輯</button><button data-action="export-record">下載文字</button><button class="danger" data-action="delete">刪除紀錄</button></div></article>`).join('') : `<div class="empty"><h2>${state.records.length ? '沒有符合的紀錄' : '還沒有工作紀錄'}</h2><p>${state.records.length ? '試試其他關鍵字，或切換工具類型。' : '選一個工具，整理提示詞或工作筆記後，按「儲存工作紀錄」。'}</p><a class="button" href="#home">前往工作工具</a></div>`;
    };
    document.querySelector('#record-search').addEventListener('input', list); document.querySelector('#record-filter').addEventListener('change', list);
    document.querySelector('#records-list').addEventListener('click', event => {
      const button = event.target.closest('[data-action]'); if (!button) return;
      const record = state.records.find(item => item.id === button.closest('[data-record-id]').dataset.recordId); if (!record) return;
      if (button.dataset.action === 'export-record') { download(recordText(record), `工作紀錄-${record.serviceDate}.txt`); return; }
      if (button.dataset.action === 'delete') {
        if (!window.confirm(`確定刪除「${record.title}」？此裝置的這筆紀錄會移除，已下載的備份不受影響。`)) return;
        if (sync(store.deleteRecord(record.id, { expectedUpdatedAt: record.updatedAt }))) {
          for (const [id, draft] of drafts) {
            if (draft.recordId === record.id) { draft.recordId = null; draft.recordUpdatedAt = ''; draftBaselines.set(id, draftSignature(id)); }
          }
          list(); tell('已刪除這筆工作紀錄。工具草稿仍保留，可繼續整理。');
        } return;
      }
      const current = getDraft(record.toolId);
      if ((current.prompt || current.result || Object.values(current.values).some(value => value.trim())) && !window.confirm('要將這份紀錄載入工具嗎？會取代該工具的草稿，已儲存的工作紀錄不會刪除。')) return;
      const next = { values: { ...record.values }, prompt: record.prompt, result: record.result, recordId: record.id, recordUpdatedAt: record.updatedAt, title: record.title, serviceDate: record.serviceDate, hours: record.hours, completed: record.completed };
      drafts.set(record.toolId, next); const result = store.saveDraft(record.toolId, next); sync(result);
      if (result.ok) { dirtyTools.delete(record.toolId); conflictedTools.delete(record.toolId); draftBaselines.set(record.toolId, draftSignature(record.toolId)); }
      else { dirtyTools.add(record.toolId); if (result.error?.code === 'STORAGE_CONFLICT') conflictedTools.add(record.toolId); }
      unpersisted = dirtyTools.size > 0; location.hash = `tool/${record.toolId}`;
    }); list();
  }
  function renderSettings() {
    main.innerHTML = `<div class="page-heading"><div class="eyebrow">YOUR WORKSPACE</div><h1>設定與備份</h1><p>不用登入。工作資料留在自己的瀏覽器，換電腦時請帶著備份一起走。</p></div><div class="settings-grid"><section class="panel"><h2>工作偏好</h2><label class="check-label"><input type="checkbox" id="teaching-mode" ${state.settings.teachingMode ? 'checked' : ''}><span>顯示操作提示與欄位說明</span></label><div class="field"><label for="language">常用族語／語別（選填）</label><input type="text" maxlength="100" id="language" value="${esc(state.settings.language)}" placeholder="填寫你實際使用的族語與語別"><small>只加入提示詞背景，不會自動翻譯或判定族語正確性。</small></div><button id="save-settings" class="primary">儲存偏好</button></section><section class="panel"><h2>把工作備份帶走</h2><p class="section-intro">備份包含所有工作紀錄、工具草稿與設定。請妥善保管檔案，其中可能包含你的工作內容。</p><button class="primary" id="export-backup">下載完整備份</button><hr><label class="field-label" for="import-backup">從備份檔匯入</label><input class="file-input" id="import-backup" type="file" accept=".json,application/json"><p class="small muted">匯入會合併新紀錄；已有的草稿和設定優先保留。相同紀錄若有衝突，會提示你處理。</p></section><section class="panel"><h2>資料存在哪裡？</h2><p class="section-intro">資料存在這個裝置、這個瀏覽器的本機儲存空間，沒有上傳到 Google Sheets 或雲端資料庫。清除網站資料、無痕模式結束或更換瀏覽器，都可能讓紀錄消失。</p><p class="small muted">共用電腦上的下一位使用者可能看到這些紀錄。請避免填入可識別家庭或個人的敏感資料，並定期下載備份。</p></section></div>`;
    document.querySelector('#save-settings').addEventListener('click', () => { if (sync(store.saveSettings({ teachingMode: document.querySelector('#teaching-mode').checked, language: document.querySelector('#language').value.trim() }))) tell('工作偏好已儲存。'); });
    if (dirtyTools.size) {
      const recovery = document.createElement('button'); recovery.id = 'download-unsaved'; recovery.textContent = '下載尚未存妥的草稿';
      document.querySelector('#export-backup').after(recovery);
      const warning = document.createElement('p'); warning.className = 'hint'; warning.textContent = '有草稿尚未存妥。完整備份只包含已儲存的資料，請另外下載尚未存妥的草稿。'; recovery.after(warning);
      recovery.addEventListener('click', () => download([...dirtyTools].map(id => recordText({ ...getDraft(id), toolId: id })).join('\n\n────────\n\n'), `語推工作台-未存草稿-${today()}.txt`));
    }
    document.querySelector('#export-backup').addEventListener('click', () => { try { download(store.exportBackup(), `語推工作台-備份-${today()}.json`, 'application/json'); tell(dirtyTools.size ? '已下載已保存資料的備份。另有草稿尚未存妥，請再按「下載尚未存妥的草稿」。' : '備份下載已開始，請確認檔案已保存在下載資料夾。'); } catch (error) { tell(errorText(error), true); } });
    document.querySelector('#import-backup').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      if (dirtyTools.size) { tell('目前有草稿尚未存妥，尚未匯入。請先下載未存草稿、處理儲存問題後再匯入。', true); event.target.value = ''; return; }
      if (file.size > 3000000) { tell('備份檔過大，請選擇本工作台下載的 JSON 備份（3 MB 以內）。', true); event.target.value = ''; return; }
      if (!window.confirm(`匯入「${file.name}」並合併工作紀錄？請只使用你信任的工作台備份檔。`)) { event.target.value = ''; return; }
      try {
        const text = await file.text();
        if (dirtyTools.size || location.hash !== '#settings') { tell('讀取備份期間工作區有變更，尚未匯入。請先保存草稿，再回到設定重新選擇備份檔。', true); return; }
        const result = store.importBackup(text);
        if (sync(result)) { drafts.clear(); draftBaselines.clear(); renderSettings(); tell(`備份已匯入。現在共有 ${state.records.length} 筆工作紀錄。${result.summary?.keptNewerRecords ? '本機較新的紀錄已保留。' : ''}`); }
      } catch (error) { tell(errorText(error), true); }
      event.target.value = '';
    });
  }
  function route() {
    if (activeTool) persistDraft(); activeTool = null;
    const routeName = location.hash.slice(1) || 'home';
    document.querySelectorAll('nav a').forEach(link => { if (link.hash.slice(1) === (routeName.startsWith('tool/') ? 'home' : routeName)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    if (routeName.startsWith('tool/')) renderTool(routeName.slice(5)); else if (routeName === 'records') renderRecords(); else if (routeName === 'settings') renderSettings(); else renderHome();
    window.scrollTo({ top: 0 }); main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); main.focus(); });
  window.addEventListener('beforeunload', event => { if (activeTool && unpersisted) persistDraft(); if (unpersisted) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (event.key !== 'calumai.yutui.v1.state') return;
    const result = store.load(); state = result.state;
    if (result.error) tell(errorText(result.error), true);
    else {
      for (const id of drafts.keys()) {
        if (draftBaselines.get(id) === draftSignature(id)) continue;
        if (dirtyTools.has(id)) conflictedTools.add(id);
        else { drafts.delete(id); draftBaselines.delete(id); if (activeTool?.id === id) renderTool(id); }
      }
      if (activeTool && conflictedTools.has(activeTool.id)) showConflict();
      else if (!activeTool) { route(); tell('工作資料已同步另一個分頁的變更。'); }
    }
  });
  route();
  if (loaded.error) tell(errorText(loaded.error), true);
})();
