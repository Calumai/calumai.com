(() => {
  const yearTargets = document.querySelectorAll("[data-year]");
  const currentYear = String(new Date().getFullYear());
  yearTargets.forEach((target) => {
    target.textContent = currentYear;
  });

  const header = document.querySelector("[data-header]");
  const nav = document.querySelector("[data-nav]");
  const menuToggle = document.querySelector("[data-menu-toggle]");

  const renderIcons = () => {
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }
  };

  const closeMenu = () => {
    if (!nav || !menuToggle) return;
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "開啟選單");
    menuToggle.innerHTML = '<i data-lucide="menu" aria-hidden="true"></i>';
    document.body.classList.remove("menu-open");
    renderIcons();
  };

  const openMenu = () => {
    if (!nav || !menuToggle) return;
    nav.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "關閉選單");
    menuToggle.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';
    document.body.classList.add("menu-open");
    renderIcons();
  };

  menuToggle?.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const desktopNav = window.matchMedia("(min-width: 921px)");
  desktopNav.addEventListener?.("change", (event) => {
    if (event.matches) closeMenu();
  });

  const topSection = document.querySelector(".hero, .lab-hero, .page-hero, .article-hero, .error-screen");
  if (header && topSection && "IntersectionObserver" in window) {
    const headerObserver = new IntersectionObserver(
      ([entry]) => {
        header.classList.toggle("is-scrolled", entry.intersectionRatio < 0.92);
      },
      { threshold: [0, 0.92] }
    );
    headerObserver.observe(topSection);
  }

  const revealItems = document.querySelectorAll(".reveal");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReducedMotion && "IntersectionObserver" in window) {
    revealItems.forEach((item) => item.classList.add("reveal-pending"));
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const copyButtons = document.querySelectorAll("[data-copy-template]");
  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.getAttribute("data-copy-template") || "";
      const scope = button.closest(".mission-comment-box") || document;
      const feedback = scope.querySelector("[data-copy-feedback]");
      const output = scope.querySelector("[data-copy-output]");

      try {
        await navigator.clipboard.writeText(text);
        if (feedback) feedback.textContent = "留言格式已複製，可以貼到你習慣的 LINE、訊息或公開留言單。";
      } catch (error) {
        if (output) {
          output.hidden = false;
          output.textContent = text;
        }
        if (feedback) feedback.textContent = "瀏覽器沒有開放自動複製，我已把留言格式顯示在下方，可以手動選取。";
      }
    });
  });

  renderIcons();
})();
