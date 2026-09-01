function doGet() {
  return HtmlService.createHtmlOutputFromFile('quiz')
    .setTitle('族語聽力測驗')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getQuizData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var quizList = [];

  // 從第 2 列開始讀取
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== '') {
      quizList.push({
        indigenous: data[i][0],      // A 欄：族語
        chinese: data[i][1] || '',   // B 欄：中文
        example: data[i][2] || '',   // C 欄：例句
        level: data[i][3] || '',     // D 欄：級別
        audioUrl: data[i][4] || ''   // E 欄：音檔連結
      });
    }
  }

  return quizList;
}

// 自動填寫音檔連結小工具
function autoFillAudioLinks() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  // 請在這裡填入您的 Google Drive 音檔資料夾 ID
  // 資料夾權限必須設為「知道連結的任何人都可以查看」
  var folderId = '1vzQzbBrNSTQ4URdNCv34oHt05xShQD6G';

  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var audioMap = {};

    // 建立「中文 -> 檔案 ID」的對應表
    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName(); // 例如：01-01_一.wav

      // 擷取底線「_」與副檔名前「.」之間的中文
      var match = name.match(/_(.+)\./);
      if (match && match[1]) {
        var chineseWord = match[1];
        audioMap[chineseWord] = file.getId();
      }
    }

    // 將對應的檔案連結填入 E 欄（第 5 欄）
    for (var i = 1; i < data.length; i++) {
      var rowChinese = data[i][1]; // B 欄中文
      if (rowChinese && audioMap[rowChinese]) {
        var directLink = 'https://drive.google.com/uc?export=download&id=' + audioMap[rowChinese];
        sheet.getRange(i + 1, 5).setValue(directLink);
      }
    }

    Logger.log('音檔連結填寫完成！');
  } catch (e) {
    Logger.log('發生錯誤：' + e.toString());
  }
}
