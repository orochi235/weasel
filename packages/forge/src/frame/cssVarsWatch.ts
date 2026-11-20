import type { CssVarReport } from '../protocol/messages';
import { type Overrides, resolveCssVars, scanCssVars } from './cssVars';

/** A running report of the custom properties `scanCssVars` finds. */
export interface CssVarsWatch {
  /** Scans now, and reports the result if it changed. */
  scan(): void;
  /** Reports the last report's vars again once an override on `name` has changed it, every value re-resolved: a var
   *  defined through `name` changes with it. */
  revise(name: string): void;
  dispose(): void;
}

const VARS_SETTLE_MS = 100;

/**
 * Reports what `scanCssVars` finds whenever it changes: on `scan`, and once mutations under `under` settle, except the
 * overrides' own. Values resolve on `root`, as `scanCssVars` resolves them. Every attribute is watched, not just style
 * and class: a stylesheet can select on any of them, `[data-wzl-mode]` included.
 */
export function watchCssVars(
  doc: Document,
  overrides: Overrides,
  report: (vars: CssVarReport[]) => void,
  { under, root = doc.documentElement }: { under: Node; root?: Element },
): CssVarsWatch {
  let last: CssVarReport[] | null = null;
  let reported: string | null = null;
  const publish = (vars: CssVarReport[]) => {
    last = vars;
    const key = JSON.stringify(vars);
    if (key === reported) return;
    reported = key;
    report(vars);
  };
  const scan = () => publish(scanCssVars(doc, overrides.has, root));
  const ownMutation = (record: MutationRecord) => {
    if (overrides.owns(record.target)) return true;
    const nodes = [...record.addedNodes, ...record.removedNodes];
    return record.type === 'childList' && nodes.length > 0 && nodes.every(overrides.owns);
  };
  let settle: ReturnType<typeof setTimeout> | undefined;
  const mutations =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          if (records.every(ownMutation)) return;
          clearTimeout(settle);
          settle = setTimeout(scan, VARS_SETTLE_MS);
        });
  mutations?.observe(under, { subtree: true, childList: true, characterData: true, attributes: true });
  return {
    scan,
    revise(name) {
      if (!last?.some((v) => v.name === name)) return;
      const values = resolveCssVars(
        doc,
        last.map((v) => v.name),
        root,
      );
      publish(last.map((v) => ({ ...v, value: values.get(v.name) ?? '', overridden: overrides.has(v.name) })));
    },
    dispose() {
      mutations?.disconnect();
      clearTimeout(settle);
    },
  };
}
