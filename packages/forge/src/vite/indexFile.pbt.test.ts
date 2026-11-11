/**
 * The static indexer against the loader: a CSF file read without running it lists the stories, ids, and names the
 * module gives once run, or refuses it with an error naming the file; any text at all is indexed or refused with
 * that error, never a crash inside the indexer; and a file's auto title walks its path under the glob's directory.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadCsfModule } from '../csf/loadCsfModule';
import { runs, tally, text, timeoutFor } from '../pbt.fixture';
import { autoTitle } from './autoTitle';
import { indexFile } from './indexFile';

const RUNS = 150;
const FILE = '/repo/src/Thing.stories.tsx';

const exportName = fc.constantFrom('Primary', 'withIcon2', 'Big_Button', 'a', 'B', 'toString', 'constructor', 'valueOf', 'Ünï', '_', '$', 'X1');
const label = fc.oneof(text, fc.constantFrom('', 'Custom name', "it's", '`tick`', ' '));

interface Story {
  name: string;
  shape: 'object' | 'function';
  /** `name` and `storyName` in the literal, in order, a key given twice included. */
  props: [key: 'name' | 'storyName', value: string][];
  /** CSF 2 annotations assigned after the declaration, in order. */
  assigned: [key: 'name' | 'storyName', value: string][];
}

const annotation = fc.tuple(fc.constantFrom('name' as const, 'storyName' as const), label);
/** A CSF 2 function story takes only `storyName`, assigned: a function's `name` is read-only, and a literal is not one. */
const story: fc.Arbitrary<Story> = fc.oneof(
  fc.record({ name: exportName, shape: fc.constant('object' as const), props: fc.array(annotation, { maxLength: 3 }), assigned: fc.array(annotation, { maxLength: 2 }) }),
  fc.record({ name: exportName, shape: fc.constant('function' as const), props: fc.constant([]), assigned: fc.array(fc.tuple(fc.constant('storyName' as const), label), { maxLength: 2 }) }),
);

const module = fc.record({
  title: fc.oneof(fc.constantFrom('ui/Thing', 'Kit', 'a b/c', 'Ä/ö'), text),
  metaVia: fc.constantFrom('inline', 'const'),
  stories: fc.uniqueArray(story, { selector: (s) => s.name, maxLength: 5 }),
  include: fc.option(fc.subarray(['Primary', 'a', 'B', 'toString']), { nil: undefined }),
});

const lit = (s: string): string => JSON.stringify(s);

/** The module as source, and as the object running it would give. */
function render(m: { title: string; metaVia: string; stories: Story[]; include: string[] | undefined }): { code: string; mod: Record<string, unknown> } {
  const metaText = `{ title: ${lit(m.title)}${m.include ? `, includeStories: [${m.include.map(lit).join(', ')}]` : ''} }`;
  const lines = m.metaVia === 'inline' ? [`export default ${metaText};`] : [`const meta = ${metaText};`, 'export default meta;'];
  const mod: Record<string, unknown> = { default: { title: m.title, ...(m.include ? { includeStories: m.include } : {}) } };
  for (const s of m.stories) {
    const body = s.props.map(([k, v]) => `${k}: ${lit(v)}`).join(', ');
    if (s.shape === 'object') {
      lines.push(`export const ${s.name} = { ${body} };`);
    } else {
      lines.push(`export const ${s.name} = () => null;`);
    }
    for (const [k, v] of s.assigned) lines.push(`${s.name}.${k} = ${lit(v)};`);
    const value: Record<string, unknown> = {};
    for (const [k, v] of [...s.props, ...s.assigned]) value[k] = v;
    Object.defineProperty(mod, s.name, {
      value: s.shape === 'object' ? value : Object.assign(() => null, value),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return { code: lines.join('\n'), mod };
}

describe('indexFile', () => {
  it('lists the stories, ids, and names the module gives once run, or refuses it naming the file', () => {
    const seen = tally();
    fc.assert(
      fc.property(module, (m) => {
        const { code, mod } = render(m);
        let loaded: { id: string; name: string; exportName: string }[];
        try {
          loaded = loadCsfModule(mod, m.title);
        } catch (error) {
          expect(() => indexFile(code, FILE, 'auto')).toThrow(`${FILE}: ${(error as Error).message}`);
          seen.count('refused');
          return;
        }
        const indexed = indexFile(code, FILE, 'auto');
        expect(indexed.map((e) => [e.exportName, e.id, e.name])).toEqual(loaded.map((s) => [s.exportName, s.id, s.name]));
        if (m.stories.some((s) => s.assigned.length > 0)) seen.count('assigned');
        if (m.stories.some((s) => s.props.some(([, v]) => v === '') || s.assigned.some(([, v]) => v === ''))) seen.count('empty name');
        if (m.stories.some((s) => new Set(s.props.map(([k]) => k)).size < s.props.length)) seen.count('twice');
        if (indexed.length > 1) seen.count('several');
      }),
      runs(RUNS),
    );
    for (const c of ['assigned', 'empty name', 'twice']) seen.atLeast(c, 10);
    seen.atLeast('refused', 4);
    seen.atLeast('several', 4);
  }, timeoutFor(RUNS, 10));

  it('indexes any text or refuses it with an error naming the file, never crashing inside', () => {
    const seen = tally();
    const valid = module.map((m) => render(m).code);
    const mangled = fc.tuple(valid, fc.array(fc.tuple(fc.nat(), fc.nat({ max: 4 }), fc.constantFrom('', '{', '}', '(', ')', ',', ';', '"', '`', '=', 'export ', 'default ', '.', '[', ']', '/', '*', 'x')), { maxLength: 4 }))
      .map(([code, edits]) => edits.reduce((c, [at, cut, put]) => { const i = at % (c.length + 1); return c.slice(0, i) + put + c.slice(i + cut); }, code));
    fc.assert(
      fc.property(fc.oneof(mangled, fc.string({ maxLength: 40 }), text), (code) => {
        try {
          const entries = indexFile(code, FILE, 'auto');
          expect(Array.isArray(entries)).toBe(true);
          seen.count('indexed');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message.startsWith(`${FILE}: `)).toBe(true);
          const cause = (error as Error).cause;
          expect(cause instanceof TypeError || cause instanceof RangeError || cause instanceof ReferenceError, String(cause)).toBe(false);
          seen.count('refused');
        }
      }),
      runs(RUNS * 2),
    );
    seen.atLeast('indexed', 30);
    seen.atLeast('refused', 30);
  }, timeoutFor(RUNS * 2, 5));
});

describe('autoTitle', () => {
  it("titles a file by its path under the glob's directory, collapsing a repeated last segment and an index file", () => {
    const seg = fc.constantFrom('ui', 'kit', 'Button', 'Bar', 'a b');
    fc.assert(
      fc.property(fc.array(seg, { maxLength: 3 }), fc.constantFrom('Button', 'Bar', 'index', 'stories', 'Card'), fc.constantFrom('.stories.tsx', '.story.ts', '.tsx', '.stories.mdx'), fc.constantFrom('src', 'packages/x'), (dirs, base, ext, root) => {
        const file = `/r/${root}/${[...dirs, base].join('/')}${ext}`;
        const title = autoTitle(file, '/r', [`./${root}/**/*${ext}`]);
        const parts = [...dirs];
        const last = parts.at(-1);
        let want: string[];
        if (base.toLowerCase() === last?.toLowerCase()) want = parts;
        else if (/^index$/i.test(base) || (/^(story|stories)$/i.test(base) && ext === '.tsx')) want = parts.length > 0 ? parts : [base];
        else want = [...parts, base];
        if (dirs.length === 0) want = [base === 'stories' && ext === '.tsx' ? 'stories' : base];
        expect(title, file).toBe(want.join('/'));
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  const names = (code: string): string[] => indexFile(code, FILE, 'auto').map((e) => e.name);

  it('names a story whose `name` is empty from its export, as the loader does', () => {
    expect(names('export default { title: "ui/Thing" };\nexport const Primary = {};\nPrimary.name = "";')).toEqual(['Primary']);
  });

  it('reads the last of a key a literal gives twice, as it evaluates', () => {
    expect(names('export default { title: "x" };\nexport const Primary = { storyName: " ", storyName: "" };')).toEqual(['Primary']);
    expect(names('export default { title: "x" };\nexport const Primary = { name: "a", name: "b" };')).toEqual(['b']);
  });
});
