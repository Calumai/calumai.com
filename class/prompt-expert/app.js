(function startPromptExpert(){
  'use strict';
  const core=globalThis.PromptExpertCore,shared=globalThis.ClassroomPracticeCore,$=id=>document.getElementById(id);
  if(!core||!shared)return;
  const previewMode=['127.0.0.1','localhost'].includes(location.hostname)||location.protocol==='file:';
  let session=null,busy=false,sessionChecking=!previewMode,lastRequest=null,lastInput=null,resultInput=null,result=null,retryAllowed=false,uncertain=false;
  let handoff=null,returnPending=false,returnTimer;
  const input=() => ({prompt:$('prompt-input').value.trim(),purpose:document.querySelector('input[name="purpose"]:checked')?.value||'auto'});
  const same=(a,b)=>a&&b&&a.prompt===b.prompt&&a.purpose===b.purpose;
  const makeKey=()=>shared.createIdempotencyKey('text',crypto.randomUUID());
  function eligible(){return session&&session.classroom.status==='open'&&Date.parse(session.expiresAt)>Date.now();}
  function errorMessage(error){
    if(error?.code==='DUPLICATE_SUCCEEDED')return '這次健檢已在服務端完成，但回覆沒有取回。原文仍保留；系統不會自動再扣一次額度。請先保留文字，再決定是否重新健檢。';
    if(error?.code==='RESPONSE_UNCERTAIN')return '回覆沒有完整收到，無法確認這次結果。原文與上一版結果仍保留；按「重試同一次健檢」會先確認原請求，不會自動再開新的一次。';
    if(error?.code==='CLIENT_TIMEOUT'||error?.code==='NETWORK_ERROR')return '目前無法確認是否完成健檢。原文與上一版結果仍保留；按「重試同一次健檢」會沿用原請求，不會自動再開新的一次。';
    if(error?.code)return shared.friendlyError(error);
    return '這次未能取得建議，原文與上一版結果仍保留。請稍後再試。';
  }
  function updateControls(){
    const changed=Boolean(resultInput&&!same(input(),resultInput));
    $('prompt-count').textContent=$('prompt-input').value.length+' / 4000';
    $('stale-badge').hidden=!changed;
    $('review-button').disabled=busy||sessionChecking;
    $('review-button').textContent=busy?'正在健檢…':'幫我健檢 →';
    $('prompt-input').disabled=busy;
    document.querySelectorAll('input[name="purpose"]').forEach(el=>{el.disabled=busy;});
    $('retry-button').hidden=!retryAllowed;$('retry-button').disabled=busy;
    $('recheck-button').disabled=busy||!result;
    $('return-button').disabled=busy||returnPending||changed||!result||!$('revised-prompt').value.trim();
    $('copy-button').disabled=!result||!$('revised-prompt').value.trim();
  }
  function renderSession(){
    $('join-button').hidden=previewMode||Boolean(eligible());
    $('logout-button').hidden=previewMode||!session;
    $('session-status').textContent=previewMode?'本機示範':sessionChecking?'正在確認課堂…':eligible()?(session.nickname||'老師')+'・課堂已加入':session?'課堂目前未開放':'尚未加入課堂';
    updateControls();
  }
  async function call(path,method='GET',body,timeout=70000){
    const request=shared.createRequest(path,method,body),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(request.url,{...request.options,signal:controller.signal,redirect:'error'});
      let payload;try{payload=await response.json();}catch{throw{code:'RESPONSE_UNCERTAIN',retryable:true};}
      if(response.ok&&payload?.ok!==true&&typeof payload?.error?.code!=='string')throw{code:'RESPONSE_UNCERTAIN',retryable:true};
      if(!response.ok||payload?.ok!==true)throw shared.normalizeApiError(payload,response.status);
      return payload;
    }catch(error){
      if(error?.code)throw error;
      throw{code:error?.name==='AbortError'?'CLIENT_TIMEOUT':'NETWORK_ERROR',retryable:true};
    }finally{clearTimeout(timer);}
  }
  async function restoreSession(){
    if(previewMode){$('demo-banner').hidden=false;renderSession();return;}
    try{session=shared.normalizeSession(await call('/session','GET',undefined,15000));}
    catch{session=null;}
    finally{sessionChecking=false;renderSession();}
  }
  async function review(retry=false){
    if(busy)return;
    if(!previewMode&&!eligible()){$('access-dialog').showModal();return;}
    const current=input();
    try{core.validateInput(current.prompt,current.purpose);}catch(error){$('review-status').textContent=error.message;$('prompt-input').focus();return;}
    if(retry&&!same(current,lastInput)){$('review-status').textContent='原文或用途已經修改，請按「幫我健檢」檢查現在這一版。';return;}
    const reuse=lastRequest&&same(current,lastInput)&&(retry||uncertain||retryAllowed);
    if(!reuse){lastInput={...current};lastRequest=core.buildReviewRequest(current.prompt,current.purpose,makeKey(),handoff?.purposeLabel);}
    busy=true;retryAllowed=false;$('review-error').hidden=true;$('review-status').textContent=previewMode?'正在整理本機示範…':'AI 正在看哪裡可以說得更清楚，原文會保留。';updateControls();
    try{
      let parsed;
      if(previewMode)parsed=core.localReview(current.prompt,current.purpose);
      else{
        const payload=await call('/generate/text','POST',lastRequest);
        let generated;
        try{generated=shared.normalizeGenerationResult('text',payload);parsed=core.parseReviewContent(generated.content);}catch{throw{code:'RESPONSE_UNCERTAIN',retryable:true};}
        if(session){session.remaining=generated.remaining;session.classroomRemaining=generated.classroomRemaining;}
      }
      result=parsed;resultInput={...current};uncertain=false;
      $('feedback-output').textContent=parsed.feedback;$('revised-prompt').value=parsed.revisedPrompt;
      $('reviewed-original').textContent=current.prompt;$('result-label').textContent=previewMode?'規則示範・不是 AI 回覆':'AI 的修改建議';
      $('empty-result').hidden=true;$('review-result').hidden=false;
      $('review-status').textContent=previewMode?'示範完成。正式 AI 功能沿用原課堂服務。':'健檢完成。原文沒有更動，可以直接複製右側提示詞。';
      $('result-message').textContent='';
    }catch(error){
      uncertain=['CLIENT_TIMEOUT','NETWORK_ERROR','REQUEST_IN_PROGRESS','RESPONSE_UNCERTAIN'].includes(error?.code);
      retryAllowed=error?.retryable===true&&error?.code!=='DUPLICATE_SUCCEEDED';
      $('error-message').textContent=errorMessage(error);$('review-error').hidden=false;$('review-status').textContent='';
      if(['UNAUTHENTICATED','SESSION_EXPIRED','CLASSROOM_CLOSED'].includes(error?.code)){session=null;renderSession();}
    }finally{busy=false;updateControls();}
  }
  $('review-form').addEventListener('submit',event=>{event.preventDefault();void review();});
  $('retry-button').addEventListener('click',()=>void review(true));
  $('prompt-input').addEventListener('input',updateControls);
  document.querySelectorAll('input[name="purpose"]').forEach(el=>el.addEventListener('change',updateControls));
  $('revised-prompt').addEventListener('input',updateControls);
  $('recheck-button').addEventListener('click',()=>{
    const revised=$('revised-prompt').value.trim();if(!revised||busy)return;
    $('prompt-input').value=revised;updateControls();void review();
  });
  $('copy-button').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('revised-prompt').value);$('result-message').textContent='提示詞已複製，可以貼到你使用的 AI。';}
    catch{$('revised-prompt').focus();$('revised-prompt').select();$('result-message').textContent='瀏覽器未允許自動複製，已選取文字。請按 Ctrl+C，手機可長按選擇「複製」。';}
  });
  $('join-button').addEventListener('click',()=>$('access-dialog').showModal());
  $('close-access').addEventListener('click',()=>$('access-dialog').close());
  $('claim-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!$('claim-form').reportValidity())return;
    $('claim-button').disabled=true;$('claim-message').textContent='正在確認課堂…';
    try{
      const claim=shared.buildClaimPayload({class_code:$('class-code').value,nickname:$('nickname').value,consent:$('consent').checked});
      session=shared.normalizeSession(await call('/session/claim','POST',claim,20000));
      $('class-code').value='';$('claim-message').textContent='';$('access-dialog').close();
      $('review-status').textContent='已加入課堂，按「幫我健檢」就可以開始。';renderSession();
    }catch(error){$('claim-message').textContent=errorMessage(error);}
    finally{$('claim-button').disabled=false;}
  });
  $('logout-button').addEventListener('click',async()=>{
    if(busy)return;$('logout-button').disabled=true;
    try{await call('/session/logout','POST',{},15000);session=null;renderSession();$('review-status').textContent='已離開課堂，這一頁的文字仍保留。';}
    catch{$('review-status').textContent='暫時無法確認是否離開課堂，請稍後再試。';}
    finally{$('logout-button').disabled=false;}
  });
  // Prompt text never travels in a URL or persistent storage. Only the exact
  // originating window can complete this user-initiated handoff.
  const handoffId=new URLSearchParams(location.hash.slice(1)).get('picture');
  if(core.safeHandoffId(handoffId)&&window.opener){
    handoff={id:handoffId,source:window.opener,received:false};
    $('handoff-status').hidden=false;$('handoff-status').textContent='正在接收圖片工作室的提示詞…';
    handoff.source.postMessage({type:'calum-prompt-ready',id:handoff.id},location.origin);
  }
  window.addEventListener('message',event=>{
    const value=event.data;
    if(!handoff||event.origin!==location.origin||event.source!==handoff.source||!value||value.id!==handoff.id)return;
    if(value.type==='calum-prompt-source'&&!handoff.received){
      if(typeof value.prompt!=='string'||value.prompt.trim().length<3||value.prompt.length>4000||value.purpose!=='image')return;
      handoff.received=true;
      handoff.purposeLabel=core.safePurposeLabel(value.purposeLabel);
      if(!$('prompt-input').value.trim()&&!busy){$('prompt-input').value=value.prompt;document.querySelector('input[name="purpose"][value="image"]').checked=true;}
      $('return-button').hidden=false;$('handoff-status').textContent='已帶入圖片工作室的原文。健檢後，按「確認帶回圖片工作室」，才會更新那一頁的修正版。';updateControls();
      history.replaceState(null,'',location.pathname+location.search);
    }
    if(value.type==='calum-prompt-accepted'&&returnPending){
      clearTimeout(returnTimer);returnPending=false;
      $('result-message').textContent=value.ok===true?'修正版已帶回圖片工作室。回到原分頁確認後，再決定是否生成圖片。':'圖片工作室沒有套用這份內容，可能已修改原文或離開課堂。請回原分頁確認；這裡的文字仍保留。';
      updateControls();
    }
  });
  $('return-button').addEventListener('click',()=>{
    if(!handoff?.received||!result||!same(input(),resultInput)||busy||returnPending)return;
    const revisedPrompt=$('revised-prompt').value.trim();if(revisedPrompt.length<3||revisedPrompt.length>4000){$('result-message').textContent='修正版請保留至少 3 個字、最多 4000 字。';return;}
    if(handoff.source.closed){$('result-message').textContent='原本的圖片工作室已關閉。請複製提示詞，再回工作室貼上。';return;}
    returnPending=true;updateControls();$('result-message').textContent='正在交回原本的圖片工作室…';
    handoff.source.postMessage({type:'calum-prompt-result',id:handoff.id,feedback:result.feedback,revisedPrompt},location.origin);
    returnTimer=setTimeout(()=>{returnPending=false;$('result-message').textContent='尚未收到圖片工作室的確認，沒有宣稱已套用。請回原分頁查看，也可以複製提示詞。';updateControls();},5000);
  });
  window.addEventListener('beforeunload',event=>{if($('prompt-input').value.trim()||$('revised-prompt').value.trim()){event.preventDefault();event.returnValue='';}});
  void restoreSession();
})();
