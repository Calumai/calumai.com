"""Build browser-readable prompts from the editable Markdown source."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "20個遊戲化簡報提示詞.md"
TARGET = ROOT / "prompts.js"

content = SOURCE.read_text(encoding="utf-8")
parts = re.findall(
    r"^### (\d{2})｜[^\n]+\n\s*\n> ([\s\S]*?)(?=\n\s*\n### |\n\s*\n## |\Z)",
    content,
    flags=re.MULTILINE,
)
prompts = {number: re.sub(r"\n> ?", "\n", body).strip() for number, body in parts}
if list(prompts) != [f"{number:02d}" for number in range(1, 21)]:
    raise ValueError(f"Expected prompts 01–20, got {list(prompts)}")

TARGET.write_text(
    "/* Generated from 20個遊戲化簡報提示詞.md by build_prompts.py. */\n"
    + "window.TRUKU_PROMPTS = "
    + json.dumps(prompts, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8",
)
print(f"Built {len(prompts)} prompts: {TARGET}")
