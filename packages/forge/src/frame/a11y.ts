import type { A11yFinding, A11yReport } from '../protocol/messages';

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

/** Runs axe over `element` and reduces its answer to what crosses the frame's channel. */
export async function runAxe(element: Element, { page = true }: RunAxeOptions = {}): Promise<A11yReport> {
  const axe = await loadAxe();
  const rules = page ? undefined : Object.fromEntries(PAGE_RULES.map((id) => [id, { enabled: false }]));
  const result = await axe.run(element, rules ? { rules } : undefined);
  return {
    violations: result.violations.map(finding),
    incomplete: result.incomplete.map(finding),
    passes: result.passes.length,
    inapplicable: result.inapplicable.length,
  };
}
