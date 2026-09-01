var AUDIO_FOLDER_ID = '__CALUMAI_DRIVE_FOLDER_ID__';

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

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== '') {
      quizList.push({
        indigenous: data[i][0],
        chinese: data[i][1] || '',
        example: data[i][2] || '',
        level: data[i][3] || '',
        audioUrl: data[i][4] || ''
      });
    }
  }

  return quizList;
}

// 終極解法：後端直接把音檔轉換成瀏覽器能播放的 Base64 格式
function getAudioBase64(url) {
  try {
    var idMatch = url.match(/id=([^&]+)/);
    if (idMatch && idMatch[1]) {
      var fileId = idMatch[1];
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var base64 = Utilities.base64Encode(blob.getBytes());
      return 'data:' + blob.getContentType() + ';base64,' + base64;
    }
  } catch (e) {
    Logger.log(e);
  }

  return null;
}

// 自動填寫音檔連結小工具
function autoFillAudioLinks() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  try {
    var folder = DriveApp.getFolderById(AUDIO_FOLDER_ID);
    var files = folder.getFiles();
    var audioMap = {};

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName();

      var match = name.match(/_(.+)\./);
      if (match && match[1]) {
        var chineseWord = match[1];
        audioMap[chineseWord] = file.getId();
      }
    }

    for (var i = 1; i < data.length; i++) {
      var rowChinese = data[i][1];
      if (rowChinese && audioMap[rowChinese]) {
        var directLink = 'https://docs.google.com/uc?export=download&id=' + audioMap[rowChinese];
        sheet.getRange(i + 1, 5).setValue(directLink);
      }
    }
  } catch (e) {
    Logger.log('發生錯誤: ' + e.toString());
  }
}
