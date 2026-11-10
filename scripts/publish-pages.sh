#!/usr/bin/env bash
# Publish the public, no-login part of Hermes Agent 101 to GitHub Pages:
#   index.html  = the slides (slides.html)
#   manual.html = the student manual
#   img/...     = only the images those two pages use
# It builds the gh-pages branch from scratch each time and pushes it.
# The course app itself (index.html + api/) is NOT published here; it needs Vercel.
#   bash scripts/publish-pages.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

python3 -I - "$ROOT" "$OUT" <<'PY'
import os, re, shutil, sys
root, out = sys.argv[1], sys.argv[2]
pages = {'slides.html': 'index.html', 'manual.html': 'manual.html'}
imgs = set()
for src, dst in pages.items():
    s = open(os.path.join(root, src), encoding='utf-8').read()
    # links into the course app don't exist on Pages: keep the text, drop the link
    s = re.sub(r'<a href="/[a-z-]*(?:#[a-z-]+)?"(?: target="_blank" rel="noopener")?>(.*?)</a>', r'\1', s)
    s = s.replace('href="/"', 'href="./"').replace('href="/manual', 'href="manual.html')
    imgs.update(re.findall(r'(?:src|href)="(img/[^"#?]+)"', s))
    open(os.path.join(out, dst), 'w', encoding='utf-8').write(s)
for rel in sorted(imgs):
    os.makedirs(os.path.join(out, os.path.dirname(rel)), exist_ok=True)
    shutil.copy2(os.path.join(root, rel), os.path.join(out, rel))
open(os.path.join(out, '.nojekyll'), 'w').close()
print(f'built {len(pages)} pages and {len(imgs)} images')
PY

REMOTE="$(git remote get-url origin)"
cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" \
  commit -q -m "Publish slides and manual ($(git -C "$ROOT" rev-parse --short HEAD))"
git push -q -f "$REMOTE" gh-pages
OWNER_REPO="$(echo "$REMOTE" | sed -E 's#.*github\.com[:/]##; s#\.git$##')"
echo "Pushed gh-pages. URL: https://$(echo "${OWNER_REPO%%/*}" | tr 'A-Z' 'a-z').github.io/${OWNER_REPO#*/}/"
