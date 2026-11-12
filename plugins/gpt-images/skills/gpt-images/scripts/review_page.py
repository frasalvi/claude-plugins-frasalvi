"""Build a side-by-side review page for a folder of generated images.

Review tier: plumbing

Usage: review_page.py OUT_DIR "Page title" [--note "free text"] [--show "{id}_prev.png"] [--print-files]
Reads OUT_DIR/manifest.json (from gen_many.py) and writes OUT_DIR/index.html, which shows every
image with its label and prompt. --show picks which file to display per item (default: the generated
image), e.g. the cutout previews for a transparency task. Images are referenced by relative path, so
the page works opened locally and when published with the images as supporting files; --print-files
prints the files map ({"A1.png": "OUT_DIR/A1.png", ...}) that an artifact publish needs.
"""
import argparse
import html
import json
from pathlib import Path

CSS = """
:root{--bg:#f6f5f2;--card:#ffffff;--fg:#1d1d1b;--muted:#6a6862;--line:#e2dfd8;--accent:#8a4b12}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#161615;--card:#1f1f1d;--fg:#ecebe7;--muted:#a3a19a;--line:#34332f;--accent:#e0a060;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#161615;--card:#1f1f1d;--fg:#ecebe7;--muted:#a3a19a;--line:#34332f;--accent:#e0a060;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
.wrap{max-width:1400px;margin:0 auto;padding-block:28px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:20px}
h1{font-size:26px;margin:0;text-wrap:balance}
p{margin:0;color:var(--muted);max-width:75ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:16px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px;min-width:0}
figure img{width:100%;border-radius:4px}
.id{font:600 18px ui-monospace,monospace;color:var(--accent)}
figcaption{font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.failed{color:#b3261e}
"""


def main():
    """Parse arguments, write index.html, and print the files map."""
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("title")
    ap.add_argument("--note", default="Pick by label.")
    ap.add_argument("--show", default="{file}")
    ap.add_argument("--print-files", action="store_true")
    a = ap.parse_args()
    d = Path(a.out_dir)
    items = json.loads((d / "manifest.json").read_text())
    cards, shown = [], []
    for m in items:
        f = a.show.format(id=m["id"], file=m["file"])
        cap = html.escape(m["prompt"][:400] + ("…" if len(m["prompt"]) > 400 else ""))
        if m["status"] == "ok":
            shown.append(f)
            body = f'<img src="{f}" alt="Option {html.escape(m["id"])}" loading="lazy">'
        else:
            body = f'<p class="failed">{html.escape(m["status"])}</p>'
        cards.append(f'<figure><div class="id">{html.escape(m["id"])}</div>{body}<figcaption>{cap}</figcaption></figure>')
    page = (f"<title>{html.escape(a.title)}</title>\n"
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            f"<style>{CSS}</style>\n"
            f'<div class="wrap"><h1>{html.escape(a.title)}</h1><p>{html.escape(a.note)}</p>'
            f'<div class="grid">{"".join(cards)}</div></div>\n')
    (d / "index.html").write_text(page)
    print(d / "index.html")
    if a.print_files:
        print(json.dumps({f: str(d / f) for f in shown}, indent=1))


if __name__ == "__main__":
    main()
