/**
 * CSS Vars addon — preview-side runtime.
 *
 * Responsibilities:
 *   1. Listen for OVERRIDE / CLEAR_OVERRIDES events from the manager
 *      panel and (re)write a `<style id="weasel-css-vars-overrides">`
 *      block at `:root` so the overrides apply live.
 *   2. After each story render, walk the DOM, harvest every `var(--…)`
 *      reference from computed styles, resolve each one against the
 *      element it appeared on, and ship the unique list back to the
 *      manager via INTROSPECT_RESULT.
 *
 * Scans are debounced ~100ms because story re-renders can fire several
 * mutation callbacks back-to-back.
 */
import { addons } from 'storybook/preview-api';
import tokens from 'virtual:weasel-tokens';

const EVT_INTROSPECT_RESULT = 'WEASEL_CSS_VARS/INTROSPECT_RESULT';
const EVT_OVERRIDE = 'WEASEL_CSS_VARS/OVERRIDE';
const EVT_CLEAR_OVERRIDES = 'WEASEL_CSS_VARS/CLEAR_OVERRIDES';
const EVT_REQUEST_RESYNC = 'WEASEL_CSS_VARS/REQUEST_RESYNC';

const STYLE_ID = 'weasel-css-vars-overrides';
const VAR_REF_RE = /var\(\s*(--[a-z0-9_-]+)/gi;

interface IntrospectVar {
  readonly name: string;
  readonly currentValue: string;
}

/** Install / update the injected `<style>` element with `overrides`. */
function applyOverrides(overrides: Record<string, string>): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  // `!important` is load-bearing here: many component CSS modules
  // redeclare their local vars on a class on the component element
  // (`.curve-editor.root { --curve-line: ... }`). That declaration has
  // the same specificity as our `:root { ... }` override, so without
  // `!important` the source-order race decides who wins — and component
  // CSS modules often inject later, beating us silently. `!important`
  // takes the race out of the picture.
  const decls = Object.entries(overrides)
    .map(([k, v]) => `  ${k}: ${v} !important;`)
    .join('\n');
  el.textContent = decls.length > 0 ? `:root {\n${decls}\n}\n` : '';
}

function clearOverrides(): void {
  const el = document.getElementById(STYLE_ID);
  if (el) el.textContent = '';
}

/**
 * Collect every `var(--xxx)` reference visible to the current document.
 *
 * Why stylesheets, not computed styles: `getComputedStyle()` already
 * resolves `var()` to its computed value, so the literal `var(...)`
 * text is gone. The only places the raw reference survives are:
 *   (a) the inline `style` attribute on each element, and
 *   (b) CSS rule text in mounted stylesheets.
 * (b) is the rich source — it catches `--curve-line`, `--slider-track`,
 * and every other component-local var that's referenced by *any*
 * currently-mounted stylesheet (not just the ones a particular element
 * happens to apply right now).
 *
 * Cross-origin stylesheets throw on `cssRules` access; we skip them.
 */
function scanVars(root: Element | Document): IntrospectVar[] {
  // Phase 1: collect var NAMES from inline styles + stylesheet rules.
  const names = new Set<string>();
  const record = (name: string): void => { names.add(name); };

  // (a) inline style attributes
  const inlineEls = document.querySelectorAll('[style*="var("]');
  for (const el of Array.from(inlineEls)) {
    const inline = el.getAttribute('style') ?? '';
    VAR_REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VAR_REF_RE.exec(inline)) !== null) record(m[1]);
  }

  // (b) mounted stylesheets
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin sheet (e.g. fonts.googleapis.com). Skip silently.
      continue;
    }
    if (!rules) continue;
    walkRules(rules, record);
  }

  // Phase 2: resolve each var's current value. Theme tokens live on
  // `:root`; component-local vars (--curve-line, --slider-track, etc.)
  // are declared on inner elements, so a `:root` lookup returns empty.
  // Walk the story root's descendants until we find an element whose
  // computed style yields a value for the var.
  const values = new Map<string, string>();
  const rootCS = getComputedStyle(document.documentElement);
  for (const name of names) {
    const v = rootCS.getPropertyValue(name).trim();
    if (v) values.set(name, v);
  }
  // For any var still missing a value, walk descendants.
  const missing = Array.from(names).filter((n) => !values.has(n));
  if (missing.length > 0) {
    const scopeRoot = root instanceof Document ? (root.body ?? document.documentElement) : root;
    const els = scopeRoot.querySelectorAll('*');
    for (const el of Array.from(els)) {
      if (missing.length === 0) break;
      const cs = getComputedStyle(el);
      for (let i = missing.length - 1; i >= 0; i--) {
        const name = missing[i];
        const v = cs.getPropertyValue(name).trim();
        if (v) {
          values.set(name, v);
          missing.splice(i, 1);
        }
      }
    }
  }

  return Array.from(names)
    .map((name) => ({ name, currentValue: values.get(name) ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Recurse into @media / @supports / @layer / @container rules. */
function walkRules(rules: CSSRuleList, record: (name: string) => void): void {
  for (const rule of Array.from(rules)) {
    const txt = (rule as CSSRule & { cssText?: string }).cssText ?? '';
    if (txt.indexOf('var(') !== -1) {
      VAR_REF_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = VAR_REF_RE.exec(txt)) !== null) record(m[1]);
    }
    const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
    if (nested) walkRules(nested, record);
  }
}

/**
 * Snapshot the computed value of every known theme token off `:root`,
 * so the Theme tab can show "current" (post-override, post-cascade)
 * alongside the static default we parsed from `tokens.css`.
 */
function snapshotThemeComputed(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const out: Record<string, string> = {};
  for (const t of tokens) {
    const v = cs.getPropertyValue(t.name).trim();
    if (v) out[t.name] = v;
  }
  return out;
}

// ---------- wiring ----------

if (typeof window !== 'undefined') {
  const channel = addons.getChannel();

  let scanTimer: number | null = null;
  const scheduleScan = (): void => {
    if (scanTimer !== null) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      scanTimer = null;
      try {
        // Prefer the story root if Storybook gives us one; else fall back
        // to <body>.
        const root =
          document.getElementById('storybook-root') ??
          document.getElementById('storybook-docs') ??
          document.body;
        const vars = scanVars(root);
        const themeComputed = snapshotThemeComputed();
        channel.emit(EVT_INTROSPECT_RESULT, { vars, themeComputed });
      } catch {
        /* introspection is best-effort */
      }
    }, 100);
  };

  channel.on(EVT_OVERRIDE, (payload: { overrides: Record<string, string> }) => {
    applyOverrides(payload?.overrides ?? {});
    scheduleScan();
  });

  channel.on(EVT_CLEAR_OVERRIDES, () => {
    clearOverrides();
    scheduleScan();
  });

  channel.on(EVT_REQUEST_RESYNC, () => {
    scheduleScan();
  });

  // Re-scan whenever the story DOM mutates. The MutationObserver is
  // installed once the body exists; if we're loaded before <body>, defer.
  const install = (): void => {
    const target = document.body;
    if (!target) {
      window.setTimeout(install, 50);
      return;
    }
    const obs = new MutationObserver(() => scheduleScan());
    obs.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    // Initial scan once the page is settled.
    scheduleScan();
  };
  install();
}

// This file is a side-effects-only preview annotation; export nothing
// (Storybook still loads it for the side effects).
export {};
