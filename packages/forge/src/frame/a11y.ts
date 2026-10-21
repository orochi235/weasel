import type { A11yFinding, A11yOutcome, A11yReport } from '../protocol/messages';

/** The shape of `axe.run`'s answer this module reads. */
interface AxeResult {
  violations: readonly AxeFinding[];
  incomplete: readonly AxeFinding[];
  passes: readonly unknown[];
  inapplicable: readonly unknown[];
}
interface AxeFinding {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  description: string;
  nodes: readonly { target: readonly unknown[]; html: string; failureSummary?: string }[];
}
interface AxeModule {
  run(context: Element, options?: unknown): Promise<AxeResult>;
}

const IMPACTS = new Set(['minor', 'moderate', 'serious', 'critical']);

function finding(from: AxeFinding): A11yFinding {
  const impact = from.impact ?? '';
  return {
    id: from.id,
    impact: IMPACTS.has(impact) ? (impact as A11yFinding['impact']) : null,
    help: from.help,
    helpUrl: from.helpUrl,
    description: from.description,
    nodes: from.nodes.map((node) => ({
      // An axe target entry is a selector, or an array of them for an element inside a shadow root.
      target: node.target.map((part) => (Array.isArray(part) ? part.join(' ') : String(part))),
      html: node.html,
      ...(node.failureSummary === undefined ? {} : { failureSummary: node.failureSummary }),
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
  const run = () => axe.run(element, rules ? { rules } : undefined);
  const running = last.then(run, run);
  last = running;
  const result = await running;
  return {
    violations: result.violations.map(finding),
    incomplete: result.incomplete.map(finding),
    passes: result.passes.length,
    inapplicable: result.inapplicable.length,
  };
}

/** `runAxe`, with a failure to run reported as an outcome rather than thrown. */
export async function auditElement(element: Element, options?: RunAxeOptions): Promise<A11yOutcome> {
  try {
    return { ok: true, report: await runAxe(element, options) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
