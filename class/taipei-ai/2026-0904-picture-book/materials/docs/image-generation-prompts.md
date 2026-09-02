# 備援圖片生成提示詞與順序

工具：OpenAI 內建圖片生成。生成日期：2026-09-02。所有圖片狀態皆為 `pending_human_review`。

## 生成順序與參考關係

1. `P00-cover-backup.png`：無參考圖，建立第一張視覺基準。
2. `P01-discovery-backup.png`：以封面作角色與畫風參考，生成新場景。
3. `P05-return-backup.png`：以封面與第 1 頁作角色、雨傘與畫風參考，生成新場景。
4. `CHAR-XQ-turnaround.png`：以封面作角色參考，生成正面、側面、背面三視圖。
5. `CHAR-MGR-turnaround.png`：以第 5 頁作管理員角色參考，生成正面、側面、背面三視圖。

以下是實際使用的提示詞。重新生成時仍須對照 YAML 工單逐頁驗收，不能假設同一提示詞會得到相同結果。

## P00｜封面候選

實際提示版本：`RED-UMBRELLA-P00-V01-ACTUAL-PROMPT`。`04a-cover-drawing-job.example.yaml` 是初審後修正方向欄位並加入三視圖的 V02 工單。

```text
Use case: illustration-story
Asset type: 4:3 children's picture-book cover artwork for a classroom backup set
Primary request: fictional child Xiao-Qing notices a closed red umbrella leaning against a wooden bench in a neighborhood park just after rain
Scene/backdrop: ordinary fictional community park, wet path, low green shrubs, a few small puddles
Subject: one fictional child with a round face, chin-length straight black hair, warm natural skin tone, five-head-tall child proportions, mustard-yellow hooded jacket, navy trousers, white sneakers, pale-green small crossbody bag; a closed red umbrella beside the bench
Style/medium: gentle transparent watercolor with fine incomplete dark-gray pencil lines and visible paper fiber
Composition/framing: wide child-eye-level view; child in lower right looking toward umbrella; generous clean low-detail negative space across the upper left for later title layout
Lighting/mood: soft diffused post-rain afternoon light; warm, curious, reassuring
Color palette: rain gray, leaf green, warm wood, mustard yellow; red umbrella accent
Constraints: exactly one child; red umbrella remains on the ground by the bench, not in the child's hands; no other people; no cultural symbols; no real place or brand
Avoid: all text, letters, numbers, logos, signage, signature, watermark; photorealism; 3D plastic look; neon colors
```

## P01｜發現紅雨傘

實際提示版本：`RED-UMBRELLA-P01-V01-ACTUAL-PROMPT`。`04b-page-01-drawing-job.example.yaml` 是後補角色三視圖的 V02 工單。

```text
Use case: illustration-story
Asset type: 4:3 children's picture-book interior artwork, page 1, for a classroom backup set
Input images: Image 1 is a character-and-style reference only; generate a new scene, do not edit the image
Primary request: the same fictional child Xiao-Qing has just discovered the same closed red umbrella leaning against the wooden bench after rain
Scene/backdrop: the same ordinary fictional community park, wet path, low green shrubs, small puddles
Subject: preserve Image 1's child's round face, chin-length straight black hair, body proportions, mustard-yellow hooded jacket, navy trousers, white sneakers, and pale-green crossbody bag; preserve the red umbrella design
Style/medium: match Image 1's gentle transparent watercolor, fine incomplete dark-gray pencil lines, visible paper fiber
Composition/framing: medium-wide child-eye-level view; child in lower left, pausing and leaning slightly toward the umbrella; bench and umbrella near center; clean low-detail negative space in upper right for later narration
Lighting/mood: soft diffused post-rain afternoon light; curious and caring
Constraints: exactly one child; umbrella remains beside the bench and is not held; no other people; no cultural symbols; no real places or brands
Avoid: all text, letters, numbers, logos, signage, signature, watermark; redesigned character; different clothes; photorealism; 3D plastic look; neon colors
```

## P05｜交還紅雨傘

實際提示版本：`RED-UMBRELLA-P05-V01-ACTUAL-PROMPT`。`04c-page-05-drawing-job.example.yaml` 是移除循環參考、加入跨頁管理員三視圖的 V02 工單。

```text
Use case: illustration-story
Asset type: 4:3 children's picture-book interior artwork, page 5, for a classroom backup set
Input images: Images 1 and 2 are character, umbrella, and watercolor-style references only; generate a new indoor scene, do not edit either image
Primary request: inside a fictional community activity center, the same child Xiao-Qing warmly returns the same closed red umbrella to its older owner after the owner correctly identifies the small yellow duck-shaped tag on its handle
Scene/backdrop: simple service counter area with a light wood desk, cork board with no readable papers or marks, and a window; no institutional identity
Subjects: exactly three fictional people — (1) preserve Xiao-Qing from the references: round face, chin-length straight black hair, child proportions, mustard-yellow hooded jacket, navy trousers, white sneakers, pale-green crossbody bag; (2) an older woman with short silver-gray hair, pale-purple jacket, dark long skirt, warm smile; (3) an adult manager with a long face, short black hair, gray-blue shirt, dark-gray trousers, standing quietly in the background
Action: Xiao-Qing and the older woman both gently hold the closed red umbrella during the handover; the small yellow duck-shaped tag is visible on the curved handle; manager observes
Style/medium: match the gentle transparent watercolor, fine incomplete dark-gray pencil lines, visible paper fiber
Composition/framing: eye-level medium view; handover at center-left; manager secondary in background; generous clean low-detail negative space in upper right for later narration
Lighting/mood: soft window light; relief, warmth, trust
Color palette: pale wood, cream, gray-blue, mustard yellow; red umbrella and yellow tag as accents
Constraints: exactly three people; one red umbrella only; preserve Xiao-Qing's identity and clothing; no other characters; no real institution, place, culture, or brand
Avoid: all text, pseudo-text, letters, numbers, logos, signage, signature, watermark; extra fingers or limbs; duplicate umbrella; photorealism; 3D plastic look; neon colors
```

## CHAR-XQ｜角色三視圖

實際提示版本：`CHAR-XQ-V01-ACTUAL-PROMPT`。

```text
Use case: illustration-story
Asset type: 4:3 character anchor reference sheet for a children's picture-book classroom exercise
Input images: Image 1 is the identity, outfit, palette, and watercolor-style reference; create a new neutral reference sheet
Primary request: show the same fictional child Xiao-Qing in exactly three full-body turnaround views: front, left-facing side profile, and back
Subject: preserve the round face, chin-length straight black hair, warm natural skin tone, five-head-tall child proportions, mustard-yellow hooded jacket, navy trousers, white sneakers, and pale-green small crossbody bag; neutral relaxed pose with arms slightly away from torso so clothing remains visible
Style/medium: match Image 1's gentle transparent watercolor, fine incomplete dark-gray pencil lines, visible paper fiber
Composition/framing: three evenly spaced full-body figures in one horizontal row, all the same scale, feet fully visible, generous margin; blank off-white watercolor-paper background
Lighting/mood: soft neutral studio-like diffuse light; friendly and practical
Constraints: exactly three views of the same one character; no extra people, props, scenery, or costume variations
Avoid: all text, labels, arrows, letters, numbers, logos, signature, watermark; cropped feet; different hairstyle; different clothing; photorealism; 3D plastic look
```

## CHAR-MGR｜管理員三視圖

實際提示版本：`CHAR-MGR-V01-ACTUAL-PROMPT`。

```text
Use case: illustration-story
Asset type: 4:3 character anchor reference sheet for a children's picture-book classroom exercise
Input images: Image 1 is the source image for the adult community-center manager's identity, clothing, palette, and watercolor style; create a new neutral reference sheet and do not reproduce the child or older woman
Primary request: show the same fictional adult manager from Image 1 in exactly three full-body turnaround views: front, left-facing side profile, and back
Subject: preserve the long face, short black hair, warm natural skin tone, approximately seven-head-tall adult proportions, gray-blue collared shirt, dark-gray trousers, black belt, and dark shoes; neutral relaxed pose with arms slightly away from torso
Style/medium: match Image 1's gentle transparent watercolor, fine incomplete dark-gray pencil lines, visible paper fiber
Composition/framing: three evenly spaced full-body figures in one horizontal row, all the same scale, feet fully visible, generous margin; blank off-white watercolor-paper background
Lighting/mood: soft neutral diffuse light; friendly and practical
Constraints: exactly three views of the same one adult manager; no child, no older woman, no umbrella, no desk, no props, no scenery, no costume variations
Avoid: all text, labels, arrows, letters, numbers, logos, signature, watermark; cropped feet; different hairstyle; different clothing; photorealism; 3D plastic look
```
