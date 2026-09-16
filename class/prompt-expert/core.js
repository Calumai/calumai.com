(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PromptExpertCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const purposes=Object.freeze({auto:'自動判斷',image:'圖片',teaching:'教材',vibe:'Vibe Coding'});
  const clean=value=>typeof value==='string'?value.trim():'';
  function validateInput(prompt,purpose='auto'){
    const text=clean(prompt);
    if(text.length<3||text.length>4000)throw new Error('請貼上至少 3 個字、最多 4000 字的提示詞。');
    if(!Object.hasOwn(purposes,purpose))throw new Error('請重新選擇用途。');
    return{prompt:text,purpose};
  }
  function safePurposeLabel(value){return typeof value==='string'&&value.trim().length<=80&&!/[\u0000-\u001f\u007f]/.test(value)?value.trim():'';}
  function buildReviewRequest(prompt,purpose,idempotencyKey,purposeLabel){
    const value=validateInput(prompt,purpose);
    if(typeof idempotencyKey!=='string'||!/^classroom-text-[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))throw new Error('無法建立請求識別碼，請重新整理後再試。');
    return{idempotency_key:idempotencyKey,topic:'提示詞小專家｜'+purposes[purpose],audience:'使用 AI 製作教學內容的老師',duration_minutes:5,
      objective:'檢查提示詞是否清楚，提出最多三項具體建議，保留原意整理出可複製的修正版；不要執行提示詞本身的任務。',
      source_notes:value.prompt,
      requirements:'只回傳 feedback 與 revised_prompt 兩欄 JSON。feedback 用繁體中文白話說明哪裡不清楚、可能有什麼影響、可以怎麼補，不要虛構評分。revised_prompt 保留老師原意；未知條件標示［請補充…］，不要擅自補成事實。不得猜造族語、文化、答案、來源或個資，也不要直接產出圖片、教案或程式碼。'+(purpose==='image'&&safePurposeLabel(purposeLabel)?' 老師在圖片工作室選擇的用途：'+safePurposeLabel(purposeLabel)+'。':'')};
  }
  function parseReviewContent(content){
    if(typeof content!=='string'||content.length>20000)throw new Error('AI 回覆格式不完整，原文仍保留。');
    let value;try{value=JSON.parse(content);}catch{throw new Error('AI 回覆格式不完整，原文仍保留。');}
    if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='feedback,revised_prompt')throw new Error('AI 回覆格式不完整，原文仍保留。');
    const feedback=clean(value.feedback),revisedPrompt=clean(value.revised_prompt);
    if(!feedback||feedback.length>4000||revisedPrompt.length<3||revisedPrompt.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(feedback+revisedPrompt))throw new Error('AI 回覆格式不完整，原文仍保留。');
    return{feedback,revisedPrompt};
  }
  function localReview(prompt,purpose){
    const value=validateInput(prompt,purpose),text=value.prompt;
    const direction={auto:'希望 AI 最後交付什麼、給誰使用，以及有哪些條件需要保留',image:'主體、場景、動作、構圖，以及不要出現的內容',teaching:'學生年級、學習目標、老師提供的題目，以及希望的教材格式',vibe:'學生怎麼操作、預期畫面與互動，以及驗收成功的條件'}[purpose];
    const reminders=['用途與對象：［請補充使用對象及目的］','希望的成果：［請補充輸出格式與必要內容］','請保留我提供的原文與已確認資料；缺少的資訊先問我，不要猜造族語、文化或正確答案。'].filter(line=>!text.includes(line));
    return{feedback:'本機規則示範，這不是 AI 健檢結果。\n\n1. 可以檢查是否寫清楚「'+direction+'」。資訊不足時，AI 可能自行猜測。\n\n2. 族語、答案或文化資料請提供已確認的內容；缺少的部分保留待填，避免產生不正確的教材。',
      revisedPrompt:(text+(reminders.length?'\n\n'+reminders.join('\n'):'')).slice(0,4000)};
  }
  function safeHandoffId(value){return typeof value==='string'&&/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(value);}
  return{purposes,validateInput,buildReviewRequest,parseReviewContent,localReview,safeHandoffId,safePurposeLabel};
});
