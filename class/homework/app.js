const fileInput = document.querySelector("#file-input");
const cameraInput = document.querySelector("#camera-input");
const chooseButton = document.querySelector("#choose-button");
const cameraButton = document.querySelector("#camera-button");
const analyzeButton = document.querySelector("#analyze-button");
const againButton = document.querySelector("#again-button");
const dropzone = document.querySelector("#dropzone");
const preview = document.querySelector("#preview");
const emptyPreview = document.querySelector("#empty-preview");
const fileInfo = document.querySelector("#file-info");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
let photo = null;
let subject = "不確定";

chooseButton.addEventListener("click", () => fileInput.click());
cameraButton.addEventListener("click", () => cameraInput.click());
fileInput.addEventListener("change", () => selectFile(fileInput.files?.[0]));
cameraInput.addEventListener("change", () => selectFile(cameraInput.files?.[0]));
againButton.addEventListener("click", () => {
  photo = null;
  fileInput.value = "";
  cameraInput.value = "";
  preview.removeAttribute("src");
  preview.hidden = true;
  emptyPreview.hidden = false;
  result.hidden = true;
  analyzeButton.disabled = true;
  fileInfo.textContent = "可以使用 JPG、PNG 或 WebP。照片只會在按下「開始看看」後送出。";
  status.textContent = "";
  chooseButton.focus();
});

for (const button of document.querySelectorAll(".subject")) {
  button.addEventListener("click", () => {
    subject = button.dataset.subject;
    for (const item of document.querySelectorAll(".subject")) {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    }
  });
}

for (const type of ["dragenter", "dragover"]) {
  dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
}
for (const type of ["dragleave", "drop"]) {
  dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
}
dropzone.addEventListener("drop", event => selectFile(event.dataTransfer?.files?.[0]));

async function selectFile(file) {
  if (!file) return;
  photo = null;
  analyzeButton.disabled = true;
  status.textContent = "";
  result.hidden = true;
  if (!file.type.startsWith("image/")) {
    status.textContent = "請選擇圖片檔案。";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    status.textContent = "這張照片太大了，請換一張小於 15 MB 的照片。";
    return;
  }
  try {
    const dataUrl = await imageToJpeg(file);
    photo = dataUrl;
    preview.src = dataUrl;
    preview.hidden = false;
    emptyPreview.hidden = true;
    analyzeButton.disabled = false;
    fileInfo.textContent = `已選擇：${file.name || "新照片"}。若字太小，請換一張更清楚的照片。`;
  } catch {
    status.textContent = "這張圖片無法讀取。請改用 JPG、PNG 或 WebP。";
  }
}

function imageToJpeg(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(objectUrl); }
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("invalid image")); };
    image.src = objectUrl;
  });
}

analyzeButton.addEventListener("click", async () => {
  if (!photo) return;
  analyzeButton.disabled = true;
  chooseButton.disabled = true;
  cameraButton.disabled = true;
  status.classList.add("loading");
  status.textContent = "正在看照片，等我一下下…";
  result.hidden = true;
  try {
    const response = await fetch(location.hostname === "calumai.com" ? "/api/classroom-ai/homework/analyze" : "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: photo, subject })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || "分析暫時失敗，請再試一次。");
    for (const [id, value] of Object.entries({
      seen: data.seen,
      "first-step": data.firstStep,
      hint: data.hint,
      check: data.check
    })) document.getElementById(id).textContent = value;
    result.hidden = false;
    status.textContent = "";
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    status.textContent = error.message || "暫時無法分析，請再試一次。";
  } finally {
    status.classList.remove("loading");
    analyzeButton.disabled = false;
    chooseButton.disabled = false;
    cameraButton.disabled = false;
  }
});

