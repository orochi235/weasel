import type { ComponentType, ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fontFamilies } from '@weasel-js/font';
import { shown } from './shown';
import { withIcons } from './withIcons';

// The font-cascade harness: each story renders inside a container set in a face of its own, and every element a kit
// component made must set its text in that face, or in a role's. The rule it holds components to is "Font families"
// in docs/conventions.md; `npm run check:fonts` is its static half.

/** The container's face, and the page's, which a story's portals land in. */
const CONTAINER = 'Cascade Probe';
const PAGE = 'Page Probe';

/** Each role token set to a face of its own, so text in a role reads apart from text that reset the base face. */
const ROLES: Record<string, string> = {
  '--wzl-font-mono': 'Probe Mono',
  '--wzl-font-display': 'Probe Display',
  '--wzl-font-numeric': 'Probe Numeric',
  '--wzl-panel-title-font': 'Probe Title',
  '--wzl-font-ui': 'Probe UI',
  '--wzl-font-body': 'Probe Body',
};
const ROLE_FACES = new Set(['Probe Mono', 'Probe Display', 'Probe Numeric', 'Probe Title']);

/** Faces a component documents as its own, each with its reason (`ALLOWED` in scripts/check-fonts.ts). */
const EXCEPTIONS: Record<string, string> = {
  'ui-sans-serif': "Keycaps' legends",
};

/** A root sets the face below it: labkit's `.lk-root` sets the UI face for a lab, and a face given inline came
 *  from a prop, which is the consumer's choice. */
const ROOTS = '.lk-root, [data-font-probe], [style*="font-family"], body';
/** Controls whose text is no text node: the user agent gives them a face of their own. */
const TEXT_CONTROLS =
  'select, textarea, input:not([type]), input:is([type=text], [type=search], [type=number], [type=email], [type=url], [type=tel], [type=password])';

const firstFace = (el: Element) => fontFamilies(getComputedStyle(el).fontFamily)[0] ?? '';

/**
 * Puts the probe faces in force for the file. A theme's tokens sit on `[data-wzl-theme]` too, so the roles beat both.
 * The container has a size: a split mounts its panes only once it has measured them.
 */
function installProbe(): void {
  let style: HTMLStyleElement | null = null;
  beforeAll(() => {
    style = document.head.appendChild(document.createElement('style'));
    const roles = Object.entries(ROLES).map(([name, face]) => `${name}: '${face}' !important;`).join(' ');
    style.textContent = `:root, [data-wzl-theme], [data-wzl-mode] { ${roles} } html { font-family: '${PAGE}'; } [data-font-probe] { font-family: '${CONTAINER}'; position: relative; width: 1024px; height: 768px; }`;
  });
  afterAll(() => style?.remove());
}

const REACT_MEMO = Symbol.for('react.memo');
const REACT_FORWARD_REF = Symbol.for('react.forward_ref');

/** A component's own name: what React DevTools would show for it. */
function nameOf(type: unknown): string | undefined {
  if (!type || (typeof type !== 'function' && typeof type !== 'object')) return undefined;
  const t = type as { displayName?: string; name?: string; render?: { name?: string }; type?: unknown };
  return t.displayName || t.name || t.render?.name || (t.type ? nameOf(t.type) : undefined);
}

const isClass = (value: unknown) => typeof value === 'function' && /^class\b/.test(Function.prototype.toString.call(value));

/** The components a set of modules exports, by name: PascalCase functions, and memo or forwardRef wrappers. */
export function exportedComponents(modules: readonly Record<string, unknown>[], leaveOut: ReadonlySet<string> = new Set()): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const mod of modules) {
    for (const [name, value] of Object.entries(mod)) {
      if (!/^[A-Z]/.test(name) || !/[a-z]/.test(name) || leaveOut.has(name) || isClass(value)) continue;
      const tag = value && typeof value === 'object' ? (value as { $$typeof?: symbol }).$$typeof : undefined;
      if (typeof value === 'function' || tag === REACT_MEMO || tag === REACT_FORWARD_REF) out.set(name, value);
    }
  }
  return out;
}

interface Fiber {
  type: unknown;
  elementType: unknown;
  child: Fiber | null;
  sibling: Fiber | null;
  stateNode: unknown;
  _debugOwner?: Fiber | null;
}

/** Whether `type` is one of `kit`'s components, by identity or by name. Names count because a story importing
 *  `@weasel-js/ui/components/X` and a glob of `./components/X` can load the module twice. */
const isKit = (kit: Kit, type: unknown) => kit.types.has(type) || kit.names.has(nameOf(type) ?? '');

interface Kit {
  readonly types: ReadonlySet<unknown>;
  readonly names: ReadonlySet<string>;
}

/** Whether a kit component made `el`: some owner up its chain is one. Markup a story writes itself is the consumer's. */
function kitMade(el: Element, kit: Kit): boolean {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  let owner = key ? (el as unknown as Record<string, Fiber>)[key]!._debugOwner : null;
  for (; owner; owner = owner._debugOwner) if (isKit(kit, owner.type)) return true;
  return false;
}

/** What under `root` that a kit component made is not in the face its nearest root set, or a role's. */
export function strays(root: Element, kit: Kit): string[] {
  const out: string[] = [];
  const judge = (el: Element, what: string) => {
    if (!kitMade(el, kit) || !shown(el)) return;
    const face = firstFace(el);
    const home = el.closest(ROOTS);
    if (!home || face === firstFace(home) || ROLE_FACES.has(face) || Object.hasOwn(EXCEPTIONS, face)) return;
    out.push(`${face}  ${JSON.stringify(what.slice(0, 40))} in <${el.localName} class="${el.getAttribute('class') ?? ''}">`);
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent?.trim() || el.closest('style, script, template, noscript')) continue;
    judge(el, node.textContent.trim());
  }
  for (const el of root.querySelectorAll(TEXT_CONTROLS)) judge(el, `<${el.localName}>`);
  return out;
}

/** Every component mounted under the React root in `container`, portals included, by identity and by name. */
function mountedTypes(container: Element, into: Set<unknown>): void {
  const key = Object.keys(container).find((k) => k.startsWith('__reactContainer$'));
  if (!key) return;
  const host = (container as unknown as Record<string, Fiber>)[key]!;
  const stack: (Fiber | null)[] = [(host.stateNode as { current: Fiber }).current];
  while (stack.length) {
    const fiber = stack.pop();
    if (!fiber) continue;
    for (const type of [fiber.type, fiber.elementType]) into.add(type).add(nameOf(type));
    stack.push(fiber.child, fiber.sibling);
  }
}

/** The `unmounted` entries no longer true: a case mounts the component, or no module exports it any more. */
export function staleUnmounted(components: Map<string, unknown>, unmounted: Record<string, string>, seen: (name: string) => boolean): string[] {
  return Object.keys(unmounted).filter((name) => !components.has(name) || seen(name));
}

export interface FontCascadeSuite {
  /** Every story to render, as `file#Export`, and any fixture drawing a component no story mounts. */
  readonly cases: [string, ComponentType][];
  /** The components the cases must between them mount. */
  readonly components: Map<string, unknown>;
  /** Components whose elements are judged without being ones the cases must mount (ui's, under labkit). */
  readonly alsoKit?: Map<string, unknown>;
  /** Components no case mounts, by name, each with the reason. */
  readonly unmounted: Record<string, string>;
  /** Stories left out, by `file#Export`, each with the reason. */
  readonly skip?: Record<string, string>;
  /** What forge draws each story inside, for a package whose stories expect a root of their own. */
  readonly wrap?: ComponentType<{ children: ReactNode }>;
}

const Bare = ({ children }: { children: ReactNode }) => <>{children}</>;

const wait = () => act(() => new Promise<void>((done) => setTimeout(done, 50)));

/** Lets effects, a lazy load and a first persisted read settle before the page is read: until the page's markup,
 *  portals included, holds still across a wait, or half a second has gone. */
export async function settle(): Promise<void> {
  let last: string | null = null;
  for (let tries = 0; tries < 10; tries += 1) {
    await wait();
    const now = document.body.innerHTML;
    if (now === last) return;
    last = now;
  }
}

/** One test per case, failing on text in a face it should not be in, then one that every component was mounted. */
export function describeFontCascade(title: string, { cases, components, alsoKit, unmounted, skip = {}, wrap: Wrap = Bare }: FontCascadeSuite): void {
  installProbe();
  const all = [...components.values(), ...(alsoKit?.values() ?? [])];
  const kit: Kit = { types: new Set(all), names: new Set(all.map(nameOf).filter((n): n is string => !!n)) };
  const mounted = new Set<unknown>();
  describe(title, { timeout: 30_000 }, () => {
    it.each(cases.filter(([name]) => !Object.hasOwn(skip, name)))('%s', async (_, Story) => {
      const host = document.body.appendChild(document.createElement('div'));
      host.setAttribute('data-font-probe', '');
      const before = new Set(document.body.children);
      const view = render(<Wrap><Story /></Wrap>, { container: host, wrapper: withIcons });
      await settle();
      try {
        mountedTypes(host, mounted);
        const portals = [...document.body.children].filter((el) => el !== host && !before.has(el));
        expect([host, ...portals].flatMap((el) => strays(el, kit))).toEqual([]);
      } finally {
        view.unmount();
        host.remove();
      }
    });

    it('mounts every exported component in some case', () => {
      const seen = (name: string) => mounted.has(components.get(name)) || mounted.has(nameOf(components.get(name)) ?? name);
      const missing = [...components.keys()].filter((name) => !seen(name) && !Object.hasOwn(unmounted, name));
      expect(missing).toEqual([]);
      expect(staleUnmounted(components, unmounted, seen), 'listed as unmounted, but a case mounts it or nothing exports it').toEqual([]);
    });
  });
}
