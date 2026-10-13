/** LINE 入口：僅作課堂演示。GAS 無法取得 X-Line-Signature 標頭，不能驗證來源。 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return response_('EMPTY');
    const payload = JSON.parse(e.postData.contents);
    if (!Array.isArray(payload.events)) return response_('INVALID');
    payload.events.forEach(event => {
      if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;
      if (!event.replyToken || !event.source || !event.source.userId) return;
      const uid = event.source.userId;
      let answer;
      try { answer = command_(String(event.message.text || '').trim(), uid); }
      catch (err) { console.error('command error', err); answer = '系統暫時無法處理，請稍後重試。'; }
      reply_(event.replyToken, answer);
    });
    return response_('OK');
  } catch (error) {
    console.error('webhook error', error);
    return response_('ERROR');
  }
}
function doGet() { return response_('Calumai LINE GAS 教學版已部署'); }
function response_(txt) { return HtmlService.createHtmlOutput(txt); }
function reply_(replyToken, content) { return sendLine_('reply', {replyToken, messages:[{type:'text',text:String(content).slice(0,4900)}]}); }
function push_(userId, content) { return sendLine_('push', {to:userId,messages:[{type:'text',text:String(content).slice(0,4900)}]}); }
function sendLine_(endpoint, body) {
  const token = prop_('LINE_ACCESS_TOKEN');
  if(!token) throw new Error('請設定指令碼屬性 LINE_ACCESS_TOKEN');
  const response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/' + endpoint, {
    method:'post', contentType:'application/json',
    headers:{Authorization:'Bearer ' + token}, payload:JSON.stringify(body),
    muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  if(code < 200 || code >= 300) throw new Error('LINE API HTTP ' + code + ': ' + response.getContentText());
  return true;
}
