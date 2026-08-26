/**
 * Find style rules that a labkit class and a weasel-ui CSS module both set at
 * identical specificity — where injection order, not intent, picks the winner.
 *
 * Usage: node scripts/find-css-ties.mjs <storybook-url> [story-id ...]
 *   node scripts/find-css-ties.mjs http://localhost:6006 labkit-lab-fullchrome--all-chrome
 * With no story ids, every story titled `labkit/…` is checked.
 *
 * Each page is seeded with a known collision first. A run that cannot find its
 * own canary reports the story as BROKEN rather than clean — an earlier version
 * of this probe reported "no collisions" against a plainly visible defect twice.
 */
import { chromium } from 'playwright';

const [base, ...only] = process.argv.slice(2);
if (!base) {
  console.error('usage: node scripts/find-css-ties.mjs <storybook-url> [story-id ...]');
  process.exit(2);
}

const CANARY_CSS = '.lk-canary-tie { width: 1px } ._canary_tie_ { width: 2px }';

/** Runs in the page. Returns one entry per (labkit rule, module rule, property)
 *  tie found on a rendered element. */
function collectTies() {
  const specificity = (sel) => {
    let s = sel;
    let prev;
    do {
      prev = s;
      s = s.replace(/:where\(([^()]*)\)/g, '');
    } while (s !== prev);
    do {
      prev = s;
      s = s.replace(/:(?:is|not|has)\(([^()]*)\)/g, ' $1 ');
    } while (s !== prev);
    return [
      (s.match(/#[\w-]+/g) || []).length,
      (s.match(/\.[\w-]+/g) || []).length +
        (s.match(/\[[^\]]*\]/g) || []).length +
        (s.match(/:(?!:)[\w-]+/g) || []).length,
      (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length,
    ];
  };
  const equal = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  const rules = [];
  for (const sheet of document.styleSheets) {
    let top;
    try {
      top = sheet.cssRules;
    } catch {
      continue; // cross-origin
    }
    // A CSSStyleRule carries its own (usually empty) cssRules list now that
    // nested CSS exists, so collect before recursing or every rule is skipped.
    const visit = (list) => {
      for (const r of list) {
        if (r.selectorText) rules.push(r);
        if (r.cssRules && r.cssRules.length) visit(r.cssRules);
      }
    };
    visit(top);
  }

  const found = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('[class*="lk-"]')) {
    const matched = [];
    for (const rule of rules) {
      for (const part of rule.selectorText.split(',')) {
        const sel = part.trim();
        if (!sel) continue;
        try {
          if (el.matches(sel)) matched.push({ sel, rule, spec: specificity(sel) });
        } catch {
          /* selector this browser cannot parse */
        }
      }
    }
    const labkit = matched.filter((m) => /\.lk-/.test(m.sel));
    const module = matched.filter((m) => !/\.lk-/.test(m.sel));
    for (const a of labkit) {
      for (const prop of a.rule.style) {
        for (const b of module) {
          if (!b.rule.style.getPropertyValue(prop)) continue;
          if (!equal(a.spec, b.spec)) continue;
          const key = `${a.sel}|${b.sel}|${prop}`;
          if (seen.has(key)) continue;
          seen.add(key);
          found.push({
            prop,
            spec: a.spec.join(','),
            labkit: `${a.sel} { ${prop}: ${a.rule.style.getPropertyValue(prop)} }`,
            module: `${b.sel} { ${prop}: ${b.rule.style.getPropertyValue(prop)} }`,
            computed: getComputedStyle(el).getPropertyValue(prop),
          });
        }
      }
    }
  }
  return found;
}

const index = await (await fetch(`${base}/index.json`)).json();
const ids = only.length
  ? only
  : Object.entries(index.entries)
      .filter(([, v]) => v.title.startsWith('labkit/'))
      .map(([id]) => id);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const ties = new Map();
let broken = 0;
let n = 0;

for (const id of ids) {
  n++;
  const page = await context.newPage();
  try {
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(700);
    await page.addStyleTag({ content: CANARY_CSS });
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'lk-canary-tie _canary_tie_';
      document.body.appendChild(d);
    });

    const found = await page.evaluate(`(${collectTies})()`);
    const sawCanary = found.some((f) => f.labkit.includes('canary'));
    const real = found.filter((f) => !f.labkit.includes('canary'));

    if (!sawCanary) {
      broken++;
      console.log(`${n}/${ids.length} ${id} — BROKEN: probe missed its own canary`);
    } else {
      for (const f of real) {
        const key = `${f.labkit} >< ${f.module}`;
        if (!ties.has(key)) ties.set(key, { ...f, stories: [] });
        ties.get(key).stories.push(id);
      }
      console.log(`${n}/${ids.length} ${id} — ${real.length} tie(s)`);
    }
  } catch (e) {
    broken++;
    console.log(`${n}/${ids.length} ${id} — BROKEN: ${e.message.split('\n')[0]}`);
  }
  await page.close();
}

console.log(`\n${ties.size} distinct tie(s) across ${ids.length - broken} story/stories`);
for (const v of ties.values()) {
  console.log(`\n[${v.spec}] ${v.prop} — computed ${v.computed}`);
  console.log(`  labkit: ${v.labkit}`);
  console.log(`  module: ${v.module}`);
  console.log(`  seen in: ${v.stories.slice(0, 4).join(', ')}`);
}
if (broken) console.log(`\n${broken} story/stories could not be checked.`);

await browser.close();
process.exit(ties.size || broken ? 1 : 0);
