import type { A11yFinding, A11yNode, A11yOutcome, A11yReport } from '../protocol/messages';
import { type ContrastAxe, judgeContrast, RECHECKED } from './a11yContrast';

/** The shape of `axe.run`'s answer this module reads. */
interface AxeResult {
  violations: readonly AxeFinding[];
  incomplete: readonly AxeFinding[];
  passes: readonly { id: string }[];
  inapplicable: readonly unknown[];
}
interface AxeCheck {
  message?: string;
  data?: { messageKey?: string } | null;
}
interface AxeNode {
  target: readonly unknown[];
  html: string;
  failureSummary?: string;
  element?: Element;
  any?: readonly AxeCheck[];
  all?: readonly AxeCheck[];
  none?: readonly AxeCheck[];
  reason?: A11yNode['reason'];
}
interface AxeFinding {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  description: string;
  nodes: readonly AxeNode[];
}
interface AxeModule extends ContrastAxe {
  run(context: Element, options?: unknown): Promise<AxeResult>;
}

const IMPACTS = new Set(['minor', 'moderate', 'serious', 'critical']);

/** Why axe could not decide a node: the first check that says, as axe's message key and its own sentence. */
function reasonOf(node: AxeNode): A11yNode['reason'] {
  if (node.reason) return node.reason;
  const checks = [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])];
  const said = checks.find((c) => c.data?.messageKey) ?? checks.find((c) => c.message);
  if (!said) return undefined;
  const key = said.data?.messageKey;
  return { ...(key ? { key } : {}), ...(said.message ? { message: said.message } : {}) };
}

function finding(from: AxeFinding, withReasons = false): A11yFinding {
  const impact = from.impact ?? '';
  const reasons = withReasons ? from.nodes.map(reasonOf) : [];
  return {
    id: from.id,
    impact: IMPACTS.has(impact) ? (impact as A11yFinding['impact']) : null,
    help: from.help,
    helpUrl: from.helpUrl,
    description: from.description,
    nodes: from.nodes.map((node, i) => ({
      // An axe target entry is a selector, or an array of them for an element inside a shadow root.
      target: node.target.map((part) => (Array.isArray(part) ? part.join(' ') : String(part))),
      html: node.html,
      ...(node.failureSummary === undefined ? {} : { failureSummary: node.failureSummary }),
      ...(reasons[i] ? { reason: reasons[i] } : {}),
    })),
  };
}

let loading: Promise<AxeModule> | null = null;

/** axe is ~500 KB, so a frame that is never audited never pays for it. */
function loadAxe(): Promise<AxeModule> {
  loading ??= import('axe-core').then((mod) => (mod as unknown as { default?: AxeModule }).default ?? (mod as unknown as AxeModule));
  return loading;
}

/** Rules that judge the page rather than the element audited; off when the element is one story on a page of many. */
export const PAGE_RULES: readonly string[] = [
  'bypass',
  'document-title',
  'html-has-lang',
  'html-lang-valid',
  'html-xml-lang-mismatch',
  'landmark-one-main',
  'page-has-heading-one',
  'region',
];

export interface RunAxeOptions {
  /** Whether `element` stands for the whole page. False leaves `PAGE_RULES` out. Default true. */
  page?: boolean;
}

// axe refuses a run while another is under way in the same document, and the workshop page holds every story.
let last: Promise<unknown> = Promise.resolve();

/** Runs axe over `element` and reduces its answer to what crosses the frame's channel. A run waits for the one before it. */
export async function runAxe(element: Element, { page = true }: RunAxeOptions = {}): Promise<A11yReport> {
  const axe = await loadAxe();
  const rules = page ? undefined : Object.fromEntries(PAGE_RULES.map((id) => [id, { enabled: false }]));
  const run = async () => recheckContrast(axe, element, await axe.run(element, { elementRef: true, ...(rules ? { rules } : {}) }));
  const running = last.then(run, run);
  last = running;
  const result = await running;
  return {
    violations: result.violations.map((f) => finding(f)),
    incomplete: result.incomplete.map((f) => finding(f, true)),
    passes: result.passes.length,
    inapplicable: result.inapplicable.length,
  };
}

/** Moves the color-contrast nodes axe gave up on because of chrome outside `root` to where `judgeContrast` puts them. */
function recheckContrast(axe: AxeModule, root: Element, result: AxeResult): AxeResult {
  const review = result.incomplete.find((f) => f.id === 'color-contrast');
  const rechecked = (n: AxeNode) => n.element !== undefined && RECHECKED.has(reasonOf(n)?.key ?? '');
  if (!review?.nodes.some(rechecked)) return result;
  const kept: AxeNode[] = [];
  const failed: AxeNode[] = [];
  let passed = false;
  axe.setup(document);
  try {
    for (const node of review.nodes) {
      const verdict = rechecked(node) ? judgeContrast(axe, node.element!, root) : null;
      if (!verdict) kept.push(node);
      else if (!verdict.decided) kept.push({ ...node, failureSummary: undefined, reason: { key: verdict.key } });
      else if (verdict.isValid) passed = true;
      else {
        const summary = `Contrast is ${verdict.ratio.toFixed(2)}:1 (foreground ${verdict.fg}, background ${verdict.bg}); ${verdict.expected}:1 is needed.`;
        failed.push({ ...node, failureSummary: summary });
      }
    }
  } finally {
    axe.teardown();
  }
  const others = (list: readonly AxeFinding[]) => list.filter((f) => f.id !== 'color-contrast');
  const failing = result.violations.find((f) => f.id === 'color-contrast');
  const violations = failed.length === 0 ? result.violations : [
    ...others(result.violations),
    { ...review, impact: 'serious', ...failing, nodes: [...(failing?.nodes ?? []), ...failed] },
  ];
  const incomplete = kept.length === 0 ? others(result.incomplete) : result.incomplete.map((f) => (f === review ? { ...f, nodes: kept } : f));
  const passes = passed && !result.passes.some((p) => p.id === 'color-contrast') ? [...result.passes, { id: 'color-contrast' }] : result.passes;
  return { ...result, violations, incomplete, passes };
}

/** `runAxe`, with a failure to run reported as an outcome rather than thrown. */
export async function auditElement(element: Element, options?: RunAxeOptions): Promise<A11yOutcome> {
  try {
    return { ok: true, report: await runAxe(element, options) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
