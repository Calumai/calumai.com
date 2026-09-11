(function () {
  'use strict';

  function markCopied(button, status, successText) {
    const original = button.textContent;
    button.textContent = '已複製';
    button.classList.add('is-copied');
    if (status) status.textContent = successText || '已複製，可以貼到 AI 對話。';
    window.setTimeout(function () {
      button.textContent = original;
      button.classList.remove('is-copied');
    }, 1600);
  }

  async function copyText(text, button, status, successText) {
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        helper.style.pointerEvents = 'none';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      markCopied(button, status, successText);
    } catch (error) {
      if (status) status.textContent = '沒有自動複製成功，請選取文字後按 Ctrl + C。';
    }
  }

  function initSwitchers() {
    document.querySelectorAll('[data-switcher]').forEach(function (switcher) {
      const buttons = Array.from(switcher.querySelectorAll('[data-switch]'));
      const panels = Array.from(switcher.querySelectorAll('[data-panel]'));
      if (!buttons.length || !panels.length) return;

      function activate(value, focusButton) {
        buttons.forEach(function (button) {
          const active = button.dataset.switch === value;
          button.setAttribute('aria-selected', String(active));
          button.tabIndex = active ? 0 : -1;
          if (active && focusButton) button.focus();
        });
        panels.forEach(function (panel) {
          panel.hidden = panel.dataset.panel !== value;
        });
      }

      buttons.forEach(function (button, index) {
        button.addEventListener('click', function () {
          activate(button.dataset.switch, false);
        });
        button.addEventListener('keydown', function (event) {
          let next = null;
          if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
          if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = buttons.length - 1;
          if (next === null) return;
          event.preventDefault();
          activate(buttons[next].dataset.switch, true);
        });
      });

      const selected = buttons.find(function (button) {
        return button.getAttribute('aria-selected') === 'true';
      }) || buttons[0];
      activate(selected.dataset.switch, false);
    });
  }

  function initCycle() {
    const root = document.querySelector('[data-cycle]');
    if (!root) return;

    const steps = [
      { label: '想清楚', title: '先決定學生要學會什麼', description: '先有學習目標，再談畫面和功能。' },
      { label: '說清楚', title: '交代學生、教材與玩法', description: '告訴 AI 誰要玩、要做什麼、做完得到什麼回饋。' },
      { label: '先規劃', title: '請 AI 先整理計畫與問題', description: '先看懂遊戲流程，再讓 AI 開始寫程式。' },
      { label: '做第一版', title: '先完成最小可玩的版本', description: '先能從開始走到結束，不急著加特效或排行榜。' },
      { label: '真的試玩', title: '親手按過每一顆按鈕', description: '只看畫面不算測試，要完整玩一次。' },
      { label: '說出問題', title: '一次描述一個不符合預期的地方', description: '說清楚位置、現況、期待結果與不能改的內容。' },
      { label: '修改再測', title: '請 AI 修正，再從頭玩一次', description: '新問題消失，原本功能也沒壞，才算完成一輪。' }
    ];

    let index = 0;
    const current = root.querySelector('[data-cycle-current]');
    const label = root.querySelector('[data-cycle-label]');
    const title = root.querySelector('[data-cycle-title]');
    const description = root.querySelector('[data-cycle-description]');
    const next = root.querySelector('[data-cycle-next]');

    function render() {
      const step = steps[index];
      current.textContent = String(index + 1);
      label.textContent = step.label;
      title.textContent = step.title;
      description.textContent = step.description;
      next.textContent = index === steps.length - 1 ? '回到第一步' : '下一個動作';
    }

    next.addEventListener('click', function () {
      index = (index + 1) % steps.length;
      render();
    });

    render();
  }

  function initPromptBuilder() {
    const root = document.querySelector('[data-prompt-builder]');
    if (!root) return;

    const form = root.querySelector('form');
    const topic = form.elements.topic;
    const goal = form.elements.goal;
    const items = form.elements.items;
    const output = root.querySelector('[data-builder-output]');
    const empty = root.querySelector('[data-builder-empty]');
    const copy = root.querySelector('[data-copy-prompt]');
    const status = root.querySelector('[data-builder-status]');

    [topic, goal, items].forEach(function (field) {
      field.addEventListener('input', function () {
        field.classList.remove('has-error');
        status.textContent = '';
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const lines = items.value.split(/\r?\n/).map(function (line) {
        return line.trim();
      }).filter(Boolean);
      let valid = true;

      [topic, goal].forEach(function (field) {
        const missing = !field.value.trim();
        field.classList.toggle('has-error', missing);
        if (missing) valid = false;
      });

      const itemsMissing = lines.length < 3;
      items.classList.toggle('has-error', itemsMissing);
      if (itemsMissing) valid = false;

      if (!valid) {
        status.textContent = '請填教材主題、學習目標，並貼上至少三筆教材。';
        const firstError = form.querySelector('.has-error');
        if (firstError) firstError.focus();
        return;
      }

      const prompt = [
        '你是一位懂教學設計、遊戲式學習與網頁互動的 Vibe Coding 助手。',
        '',
        '第一回合請先不要寫程式。先把我的需求整理成一份簡短、看得懂的遊戲計畫；資料不足時，最多問我 5 個問題，而且一次只問一題。',
        '',
        '【使用者】',
        form.elements.audience.value,
        '',
        '【教材主題】',
        topic.value.trim(),
        '',
        '【學習目標】',
        goal.value.trim(),
        '',
        '【這次要練的能力】',
        form.elements.stage.value,
        '',
        '【預計玩法】',
        form.elements.gameType.value,
        '',
        '【老師已核對的教材】',
        lines.join('\n'),
        '',
        '【請先規劃】',
        '1. 學生進入後第一眼會看到什麼。',
        '2. 學生每一關要做什麼。',
        '3. 答對、答錯或完成操作後會得到什麼回饋。',
        '4. 什麼時候算過關，以及完成後會看到什麼。',
        '5. 哪些教材內容仍要由老師人工確認。',
        '',
        '【不能做的事】',
        '1. 不要翻譯、改寫或猜測族語與文化內容。',
        '2. 不要自行增加教材沒有提供的族語詞句。',
        '3. 不要先加登入、排行榜、資料庫、外部套件或付費服務。',
        '4. 不要只用分數和倒數計時假裝有學習。',
        '',
        '等我說「確認，開始製作」後，再輸出完整的單一 index.html。HTML、CSS、JavaScript 都放在同一個檔案，手機與電腦都能操作，文字清楚，按鈕容易點，並包含開始、任務、即時回饋、完成結果與重新挑戰。'
      ].join('\n');

      output.textContent = prompt;
      output.hidden = false;
      empty.hidden = true;
      copy.disabled = false;
      status.textContent = '規劃提示詞已產生。先核對教材，再複製。';
    });

    copy.addEventListener('click', function () {
      copyText(output.textContent, copy, status);
    });
  }

  function initStaticCopies() {
    document.querySelectorAll('[data-copy-target]').forEach(function (button) {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target) return;
      const card = button.closest('.copy-line-card');
      const status = card ? card.querySelector('[data-copy-status]') : null;
      button.addEventListener('click', function () {
        copyText(
          target.textContent.trim(),
          button,
          status,
          button.dataset.copySuccess || '已複製。確認 AI 的規劃後再貼上。'
        );
      });
    });
  }

  function initIssueClinic() {
    const root = document.querySelector('[data-issue-clinic]');
    if (!root) return;

    const cases = {
      button: {
        title: '按了按鈕，畫面完全沒變',
        clue: '先記下是哪一個畫面、哪一顆按鈕，以及按下前後看到什麼。',
        prompt: '我的互動遊戲有一顆按鈕沒有反應。\n\n我原本期待：【按下後應該發生什麼】\n實際發生：【現在看見什麼】\n重現步驟：1.【第一步】 2.【第二步】 3.【第三步】\n按鈕文字：【按鈕上的字】\n請保留：【題目、答案、版面或其他不能改的功能】\n\n請先判斷最可能的原因，只修正這一個問題。完成後輸出完整的單一 HTML，並列出我必須重測的 3 個動作。'
      },
      answer: {
        title: '遊戲能玩，但答案或回饋不正確',
        clue: '族語先由老師核對，再把錯誤題目、目前內容與正確內容逐項列出。',
        prompt: '我的互動遊戲功能正常，但教材內容需要更正。\n\n錯誤題目：【貼上題目】\n目前顯示：【貼上目前答案或回饋】\n老師核對後應改成：【貼上正確內容】\n請保留：【計分、畫面、操作與其他不該改的地方】\n\n請只替換我列出的內容，不要翻譯、改寫或猜測其他族語。完成後輸出完整的單一 HTML，並確認題目、答案與回饋彼此一致。'
      },
      mobile: {
        title: '電腦正常，手機卻擠在一起',
        clue: '說出哪一個畫面被切掉、要左右滑，或按鈕太小。',
        prompt: '這份互動遊戲在電腦可以使用，但直式手機上有版面問題。\n\n問題畫面：【開始頁、遊戲頁或結果頁】\n實際發生：【被切掉、重疊、按鈕太小或需要左右滑】\n我希望：【手機上應該怎麼排列】\n請保留：【題目、答案、計分與遊戲流程】\n\n請只修手機版面，讓 360px 寬的畫面也能完整操作，字體至少 18px，主要按鈕高度至少 48px，不能左右捲動。完成後輸出完整的單一 HTML。'
      },
      score: {
        title: '同一題連按，分數會一直增加',
        clue: '先確認是同一題可以重複得分，還是換題時又算了一次。',
        prompt: '我的互動遊戲有重複計分問題。\n\n我原本期待：每題最多計分一次。\n實際發生：【說明何時重複加分】\n重現步驟：1.【第一步】 2.【第二步】 3.【第三步】\n請保留：【題目、答案、視覺與總分規則】\n\n請讓每題最多計分一次，作答後鎖定該題操作，進入下一題才重新開放。請只修正計分與按鈕狀態，輸出完整的單一 HTML，並列出 3 個防止重複計分的測試。'
      }
    };

    const buttons = Array.from(root.querySelectorAll('[data-issue]'));
    const title = root.querySelector('[data-clinic-title]');
    const clue = root.querySelector('[data-clinic-clue]');
    const prompt = root.querySelector('[data-clinic-prompt]');
    const copy = root.querySelector('[data-copy-clinic]');
    const status = root.querySelector('[data-clinic-status]');

    function activate(key) {
      const item = cases[key];
      if (!item) return;
      buttons.forEach(function (button) {
        const active = button.dataset.issue === key;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      title.textContent = item.title;
      clue.textContent = item.clue;
      prompt.textContent = item.prompt;
      status.textContent = '';
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activate(button.dataset.issue);
      });
    });

    copy.addEventListener('click', function () {
      copyText(prompt.textContent, copy, status, '修正指令已複製。貼上前，先補完括號裡的內容。');
    });

    activate('button');
  }

  function initUpgradeBuilder() {
    const root = document.querySelector('[data-upgrade-builder]');
    if (!root) return;

    const upgrades = {
      analysis: {
        name: '分析',
        task: '加入一個「對話偵探」或「找錯」關卡。學生必須比較老師提供的線索，找出不合人物、場合或語意的內容，並在作答後看見判斷依據。'
      },
      evaluate: {
        name: '評鑑',
        task: '加入一個「分支決策」關卡。學生依老師提供的情境與判斷標準選擇回應，作答後要看見各選項適合或不適合的原因。不要假裝文化情境只有唯一答案。'
      },
      create: {
        name: '創造',
        task: '加入一個「對話建造」關卡。學生只能從老師提供並核對過的詞句庫挑選與排序，組成一段短對話；系統不自行產生新的族語句子。'
      }
    };

    const form = root.querySelector('form');
    const context = form.elements.context;
    const output = root.querySelector('[data-upgrade-output]');
    const empty = root.querySelector('[data-upgrade-empty]');
    const copy = root.querySelector('[data-copy-upgrade]');
    const status = root.querySelector('[data-upgrade-status]');

    context.addEventListener('input', function () {
      context.classList.remove('has-error');
      status.textContent = '';
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!context.value.trim()) {
        context.classList.add('has-error');
        status.textContent = '先用一句到三句說明目前的遊戲怎麼玩。';
        context.focus();
        return;
      }

      const upgrade = upgrades[form.elements.upgrade.value];
      const prompt = [
        '請在我目前可以正常操作的互動遊戲中，只加入一個新的「' + upgrade.name + '」關卡。',
        '',
        '【目前玩法】',
        context.value.trim(),
        '',
        '【這次只加的內容】',
        upgrade.task,
        '',
        '【修改規則】',
        '1. 先用白話說明你準備在哪裡加入這一關，不要立刻重寫整份作品。',
        '2. 題目、族語、答案與原本能用的功能都不能改。',
        '3. 新關卡使用的教材與判斷標準，只能來自我接著提供的內容。',
        '4. 不要同時加入音效、排行榜、登入或其他新功能。',
        '5. 手機與電腦都要能操作，不能左右捲動。',
        '6. 我確認計畫後，再輸出修改完成的完整單一 HTML。',
        '7. 最後列出新關卡的學習目標，以及我必須親自測試的 4 個動作。',
        '',
        '【我要補上的教材與判斷標準】',
        '請先提醒我貼在這裡，不要自行猜測。'
      ].join('\n');

      output.textContent = prompt;
      output.hidden = false;
      empty.hidden = true;
      copy.disabled = false;
      status.textContent = upgrade.name + '關卡指令已產生。這一輪先不要再加第二種能力。';
    });

    copy.addEventListener('click', function () {
      copyText(output.textContent, copy, status);
    });
  }

  function initReleaseGate() {
    const root = document.querySelector('[data-release-gate]');
    if (!root) return;

    const boxes = Array.from(root.querySelectorAll('input[type="checkbox"]'));
    const count = root.querySelector('[data-release-count]');
    const status = root.querySelector('[data-release-status]');

    function update() {
      const completed = boxes.filter(function (box) {
        return box.checked;
      }).length;
      count.textContent = completed + ' / ' + boxes.length;
      const allDone = completed === boxes.length;
      root.classList.toggle('is-complete', allDone);
      const heading = status.querySelector('strong');
      const detail = status.querySelector('span');
      heading.textContent = allDone ? '可以分享了' : '還不能分享';
      detail.textContent = allDone
        ? '複製學生要使用的正式網址，再請一個人打開確認。'
        : '還有 ' + (boxes.length - completed) + ' 項需要確認。';
    }

    boxes.forEach(function (box) {
      box.addEventListener('change', update);
    });
    update();
  }

  function initSectionNavigation() {
    if (!('IntersectionObserver' in window)) return;
    const links = Array.from(document.querySelectorAll('.header-inner nav a[href^="#"]'));
    const sections = links.map(function (link) {
      return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);
    if (!sections.length) return;

    const observer = new IntersectionObserver(function (entries) {
      const visible = entries.filter(function (entry) {
        return entry.isIntersecting;
      }).sort(function (a, b) {
        return a.boundingClientRect.top - b.boundingClientRect.top;
      });
      if (!visible.length) return;
      const id = visible[0].target.id;
      links.forEach(function (link) {
        link.classList.toggle('is-current', link.getAttribute('href') === '#' + id);
      });
    }, { rootMargin: '-24% 0px -64% 0px', threshold: 0 });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  initSwitchers();
  initCycle();
  initPromptBuilder();
  initStaticCopies();
  initIssueClinic();
  initUpgradeBuilder();
  initReleaseGate();
  initSectionNavigation();
})();
