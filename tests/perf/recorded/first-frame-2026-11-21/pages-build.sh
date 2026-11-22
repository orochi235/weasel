#!/usr/bin/env bash
# Builds skulkr's demo audits page against this weasel tree into .ff-skulkr/out/pages/<label>/, with
# packages/renderer and packages/core as at the merge-base (`base`), at HEAD (`head`), and as in the working tree
# (`tree`, and `boot`, which also has skulkr's main.tsx call warmPrograms() first), then runs pages.sh over them.
# Run from the repo root on a fleet node, after copying skulkr's dashboard (no node_modules or dist) into
# .ff-skulkr/dashboard:
#   rsync -a --exclude node_modules --exclude dist ~/src/skulkr/dashboard/ .ff-skulkr/dashboard/
#   onto do --kind bench --solo --gui --node teitou --task <t> --expect 12m --out .ff-skulkr/out -- \
#     bash tests/perf/recorded/first-frame-2026-11-21/pages-build.sh
set -euo pipefail
root="$(pwd)"; out="$root/.ff-skulkr/out"
rm -rf "$out"; mkdir -p "$out/pages"
echo "ff: tree $(git rev-parse HEAD) + $(git status --porcelain | wc -l | tr -d ' ') dirty paths"
[ -d node_modules ] || npm ci --no-audit --no-fund > /dev/null 2>&1
npm run build > "$out/weasel-build.log" 2>&1
cd "$root/.ff-skulkr/dashboard"
npm ci --no-audit --no-fund --omit=optional > "$out/dashboard-install.log" 2>&1
node -e '
const fs = require("fs"), path = require("path");
const root = process.argv[1];
for (const dir of fs.readdirSync(path.join(root, "packages"))) {
  const pj = path.join(root, "packages", dir, "package.json");
  if (!fs.existsSync(pj)) continue;
  const name = JSON.parse(fs.readFileSync(pj, "utf8")).name;
  const at = path.join("node_modules", name);
  if (!name?.startsWith("@weasel-js/") || !fs.existsSync(at)) continue;
  fs.rmSync(path.join(at, "dist"), { recursive: true, force: true });
  fs.cpSync(path.join(root, "packages", dir, "dist"), path.join(at, "dist"), { recursive: true });
  fs.copyFileSync(pj, path.join(at, "package.json"));
}' "$root"
cd "$root"
saved="$(mktemp -d)"; cp -R packages/renderer/src "$saved/renderer"; cp -R packages/core/src "$saved/core"
for label in base head tree boot; do
  for pkg in renderer core; do
    rm -rf packages/$pkg/src
    case $label in
      base) git checkout 1eae5ad17c -- packages/$pkg/src ;;
      head) git checkout HEAD -- packages/$pkg/src ;;
      tree|boot) cp -R "$saved/$pkg" packages/$pkg/src ;;
    esac
    npm run build -w @weasel-js/$pkg > "$out/$pkg-build-$label.log" 2>&1
  done
  cd "$root/.ff-skulkr/dashboard"
  for pkg in renderer core; do rm -rf node_modules/@weasel-js/$pkg/dist; cp -R "$root/packages/$pkg/dist" node_modules/@weasel-js/$pkg/dist; done
  if [ "$label" = boot ]; then
    cp src/main.tsx /tmp/ff-main.tsx
    printf "import { warmPrograms } from '@weasel-js/core';\nwarmPrograms();\n" | cat - /tmp/ff-main.tsx > src/main.tsx
  fi
  npx vite build --config vite.demo.config.ts --mode demo --outDir "$out/pages/$label" > "$out/page-build-$label.log" 2>&1
  if [ "$label" = boot ]; then cp /tmp/ff-main.tsx src/main.tsx; fi
  cd "$root"
  # vite 8 writes this build's one lazy preload list as `[]` and a stray 32-hex hash, a syntax error; the list is empty.
  for f in "$out/pages/$label"/assets/*.js; do perl -pi -e 's/\[\][0-9a-f]{32}\)/[])/g' "$f"; done
  node -e 'const a=require("acorn"),fs=require("fs");for(const f of process.argv.slice(1)){a.parse(fs.readFileSync(f,"utf8"),{ecmaVersion:"latest",sourceType:"module"})}' "$out/pages/$label"/assets/*.js
  echo "ff: $label built; KHR mentions $(cat "$out/pages/$label"/assets/*.js | grep -c KHR_parallel_shader_compile || true)"
done
for pkg in renderer core; do rm -rf packages/$pkg/src; cp -R "$saved/$pkg" packages/$pkg/src; npm run build -w @weasel-js/$pkg > /dev/null 2>&1; done
rm -rf "$saved"
ROUNDS=4 HEADLESS=1 bash tests/perf/recorded/first-frame-2026-11-21/pages.sh "$out/pages" warmup
mkdir -p "$out/runs"; mv tests/perf/recorded/first-frame-2026-11-21/$(hostname -s)/warmup-* "$out/runs/"
