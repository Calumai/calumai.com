(() => {
  "use strict";

  const article = document.querySelector("[data-lesson-body]");
  if (!article) return;

  const toc = document.querySelector("[data-lesson-toc]");
  const progress = document.querySelector("[data-reading-progress]");
  const printButton = document.querySelector("[data-print-lesson]");

  const slugify = (value, index) => {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[\s/：:]+/g, "-")
      .replace(/[^\p{Letter}\p{Number}-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return slug || `section-${index + 1}`;
  };

  const headings = [...article.querySelectorAll("h2, h3")];
  const usedIds = new Set();

  headings.forEach((heading, index) => {
    let id = slugify(heading.textContent, index);
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    heading.id = heading.id || id;
  });

  if (toc && headings.length) {
    toc.innerHTML = headings.map((heading) => `
      <a href="#${heading.id}" data-level="${heading.tagName === "H3" ? "3" : "2"}">${heading.textContent}</a>
    `).join("");
  }

  article.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("lesson-table-wrap")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "lesson-table-wrap";
    table.before(wrapper);
    wrapper.appendChild(table);
  });

  article.querySelectorAll("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (!code) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-copy-code";
    button.textContent = "複製";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = "已複製";
        setTimeout(() => { button.textContent = "複製"; }, 1400);
      } catch (error) {
        console.error("Unable to copy code", error);
      }
    });
    pre.appendChild(button);
  });

  const updateProgress = () => {
    if (!progress) return;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = documentHeight > 0 ? Math.min(100, Math.max(0, (window.scrollY / documentHeight) * 100)) : 0;
    progress.style.width = `${percentage}%`;
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  if ("IntersectionObserver" in window && toc) {
    const links = new Map([...toc.querySelectorAll("a")].map((link) => [link.getAttribute("href").slice(1), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.remove("is-active"));
      links.get(visible.target.id)?.classList.add("is-active");
    }, { rootMargin: "-18% 0px -70% 0px", threshold: 0 });
    headings.forEach((heading) => observer.observe(heading));
  }

  printButton?.addEventListener("click", () => window.print());

  window.lucide?.createIcons();
})();
