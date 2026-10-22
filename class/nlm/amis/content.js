// Source of truth for the two classroom games and their downloadable assets.
// Every Indigenous-language string below was checked against the supplied PDFs.
window.AMIS_MATERIALS = {
  classroom: {
    title: "教室任務：南勢阿美語搶答賽",
    shortTitle: "上課用語",
    source: "《112 年情境族語：上課用語（南勢阿美語）》",
    sourceFile: "112年情境族語_01上課用語_01南勢阿美語.pdf",
    description: "從進教室到身體不舒服，選出教材原句的意思。",
    infographicTitle: "教室裡的六個關鍵詞",
    infographicSubtitle: "看詞、說意思，再進入搶答關卡。",
    infographicWords: [
      {word:"mautang", meaning:"遲到", page:5},
      {word:"tatayi’an", meaning:"廁所", page:5},
      {word:"adada", meaning:"痛", page:5},
      {word:"sinawal", meaning:"暈", page:5},
      {word:"takulaw", meaning:"喉嚨", page:5},
      {word:"sakalima a remiad namilipay", meaning:"星期五", page:5}
    ],
    questions: [
      {scene:"快進教室！", prompt:"mautang", choices:["遲到","受傷","請假"], answer:0, page:5, type:"詞語配對"},
      {scene:"老師，我想去……", prompt:"tatayi’an", choices:["河邊","廁所","教會"], answer:1, page:5, type:"詞語配對"},
      {scene:"身體不舒服", prompt:"sinawal", choices:["發燒","暈","痛"], answer:1, page:5, type:"詞語配對"},
      {scene:"今天星期幾？", prompt:"sakalima a remiad namilipay", choices:["星期三","星期日","星期五"], answer:2, page:5, type:"時間辨識"},
      {scene:"聽到這句，要回答什麼？", prompt:"Mamaan saw kisu?", choices:["你怎麼了？","你叫什麼名字？","你要去哪裡？"], answer:0, page:2, type:"對話理解"},
      {scene:"找一找同學", prompt:"Icuwa saw ci Panay?", choices:["Panay 幾歲？","Panay 在哪裡？","Panay 生病了嗎？"], answer:1, page:3, type:"對話理解"},
      {scene:"課堂中的請求", prompt:"Mangaay haw kaku a talamisuvaw tu kamay aku?", choices:["我可以去洗手嗎？","我可以請假嗎？","我可以進來嗎？"], answer:0, page:3, type:"情境選句"},
      {scene:"照顧身體", prompt:"Pasevana’ay, adada ku tiya nu maku, a talatatayi’an kaku.", choices:["老師，我頭暈，要去休息。","老師，我肚子痛，要去廁所。","老師，我遲到了。"], answer:1, page:3, type:"對話理解"}
    ]
  },
  identity: {
    title: "認識彼此：南勢阿美語搶答賽",
    shortTitle: "姓名與問候",
    source: "《112 年情境族語：姓名與問候（南勢阿美語）》",
    sourceFile: "112年情境族語_02姓名與問候_01南勢阿美語.pdf",
    description: "從自我介紹、名字到家人與年齡，讀懂教材中的提問。",
    infographicTitle: "認識彼此的六個線索",
    infographicSubtitle: "看詞、說意思，再進入搶答關卡。",
    infographicWords: [
      {word:"Pangcah", meaning:"阿美族", page:5},
      {word:"Hulam", meaning:"漢人", page:5},
      {word:"wawa", meaning:"小孩", page:5},
      {word:"u wawa tu vavahiyan", meaning:"女兒", page:5},
      {word:"u wawa tu vavainayan", meaning:"兒子", page:5},
      {word:"tarakaw", meaning:"高", page:5}
    ],
    questions: [
      {scene:"自我介紹第一關", prompt:"Kasemuwal may tu urip nu misu.", choices:["請自我介紹。","請坐下。","你幾歲？"], answer:0, page:2, type:"對話理解"},
      {scene:"第一次見面", prompt:"Cima ku ngangan nu misu?", choices:["你是哪一族的小孩？","你叫什麼名字？","你住在哪裡？"], answer:1, page:2, type:"對話理解"},
      {scene:"看懂身分詞", prompt:"Pangcah", choices:["漢人","阿美族","小孩"], answer:1, page:5, type:"詞語配對"},
      {scene:"看懂家庭詞", prompt:"wawa", choices:["爸爸","哥哥","小孩"], answer:2, page:5, type:"詞語配對"},
      {scene:"對話中的提問", prompt:"U maanan a vinacadan nu wawa kisu?", choices:["你是哪一族的小孩？","你叫什麼名字？","你幾歲？"], answer:0, page:2, type:"對話理解"},
      {scene:"家人關係", prompt:"U nima saw a wawa kisu?", choices:["你是誰的小孩？","你的家人在哪裡？","你的爸爸幾歲？"], answer:0, page:2, type:"對話理解"},
      {scene:"猜猜在問什麼", prompt:"Pina tu ku mihcaan ni kaka nu misu?", choices:["你哥哥叫什麼名字？","你哥哥幾歲了？","你哥哥在哪裡？"], answer:1, page:3, type:"對話理解"},
      {scene:"詞語終點站", prompt:"tarakaw", choices:["高","瘦","胖"], answer:0, page:5, type:"詞語配對"}
    ]
  }
};
