(function(){
"use strict";
const shared=globalThis.ClassroomPracticeCore,$=id=>document.getElementById(id); if(!shared)return;
let session=null,file=null,busy=false,lastNote="";
function eligible(){return session&&session.classroom.status==="open"&&Date.parse(session.expiresAt)>Date.now()}
async function call(path,method="GET",body,timeout=90000){const r=shared.createRequest(path,method,body),c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const res=await fetch(r.url,{...r.options,signal:c.signal});const p=await res.json();if(!res.ok||p?.ok!==true)throw shared.normalizeApiError(p,res.status);return p}finally{clearTimeout(t)}}
async function restore(){try{session=shared.normalizeSession(await call("/session"))}catch{session=null}$("session-status").textContent=eligible()?(session.nickname||"已加入課堂"):"尚未加入課堂"}
function uuid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)}
async function imageData(f){if(!["image/jpeg","image/png","image/webp"].includes(f.type))throw Error("請選 JPG、PNG 或 WebP 圖片。");if(f.size>8*1024*1024)throw Error("圖片太大，請使用 8 MB 以下的照片。");return await new Promise((ok,no)=>{const r=new FileReader;r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=no;r.readAsDataURL(f)})}
function renderText(s){$("answer").textContent=String(s||"").trim();$("answer-card").hidden=!$("answer").textContent}
async function solve(alternate=false){if(busy||!file)return;if(!eligible()){$("access").showModal();return}busy=true;$("solve").disabled=true;$("again").disabled=true;$("status").textContent="AI 正在看作業圖片並理解題目…";try{const b64=await imageData(file);const note=$("note").value.trim();lastNote=note;const payload={idempotency_key:"classroom-text-"+uuid(),image:{mime_type:file.type,data_base64:b64},instruction:["請直接閱讀這張作業照片，理解題目、範例、空格與作答要求。","學生是國小三年級，答案使用三年級能理解與書寫的字詞。","國語造句不可照抄照片中的示範句；若要求多句，數量必須正確。","數學請給答案與簡短算式；選擇題給答案並用一句話解釋。","照片不清楚或無法確定題意時，明確指出需要重拍的位置，不可猜題。",alternate?"請換一個不同但同樣正確、難度相同的答案。":"",note?"額外要求："+note:""].filter(Boolean).join("\n")};const p=await call("/generate/vision","POST",payload,120000);renderText(p.content);$("status").textContent="完成。"}catch(e){$("status").textContent=e?.code==="HTTP_404"?"圖片辨識中轉尚未啟用；前端已完成，但後端需要新增 /generate/vision。":(e?.message||shared.friendlyError(e)||"這次沒有完成，請再試一次。")}finally{busy=false;$("solve").disabled=false;$("again").disabled=false}}
$("photo").addEventListener("change",e=>{file=e.target.files?.[0]||null;if(!file)return;const u=URL.createObjectURL(file);$("preview").src=u;$("preview-wrap").hidden=false;$("answer-card").hidden=true;$("status").textContent=""});
$("remove").addEventListener("click",()=>{file=null;$("photo").value="";$("preview-wrap").hidden=true;$("answer-card").hidden=true});
$("solve").addEventListener("click",()=>{if(!file){$("status").textContent="先拍照或選一張作業圖片。";return}void solve(false)});
$("again").addEventListener("click",()=>void solve(true));
$("claim").addEventListener("submit",async e=>{e.preventDefault();try{const p=shared.buildClaimPayload({class_code:$("class-code").value,nickname:$("nickname").value,consent:$("consent").checked});session=shared.normalizeSession(await call("/session/claim","POST",p,20000));$("access").close();$("session-status").textContent=session.nickname+"・課堂已加入";void solve(false)}catch(err){$("claim-msg").textContent=shared.friendlyError(err)}});
void restore();
})();