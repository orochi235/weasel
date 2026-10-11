import { parseFile } from './ast.ts';
import { indexProgram, scan } from './indexFile.ts';
import { type Foreign, type ForeignStories, isFn, mayBeStory, mayReturnStory, type Scope } from './nativeExports.ts';
import type { Trace } from './trace.ts';

type Kind = keyof ForeignStories;
type Ask = (kind: Kind, name: string) => Promise<boolean | undefined>;

const MAX_DEPTH = 8;

/**
 * Runs `read` until it asks about no import it has not asked about before, answering each through `ask`. Reading
 * is synchronous and following an import is not, so each pass reads with what the passes before it learned.
 */
async function settled<T>(read: (foreign: Foreign) => T, ask: Ask): Promise<{ result: T; known: ForeignStories }> {
  const known: ForeignStories = { values: {}, calls: {}, reexports: {} };
  const asked = new Set<string>();
  for (;;) {
    const fresh: [Kind, string][] = [];
    const answer = (kind: Kind) => (name: string) => {
      if (!asked.has(`${kind}:${name}`)) fresh.push([kind, name]);
      return known[kind][name];
    };
    const result = read({ value: answer('values'), call: answer('calls'), reexport: answer('reexports') });
    if (fresh.length === 0) return { result, known };
    for (const [kind, name] of fresh) {
      asked.add(`${kind}:${name}`);
      const found = await ask(kind, name);
      if (found !== undefined) known[kind][name] = found;
    }
  }
}

/**
 * What the imports a native story file's exports rest on are: a story, a function that returns one, or neither.
 * `own` holds the bindings that are forge's `meta` and `story`, by declaring `file#local`; `wrappers` are the file's
 * callees already found to be those.
 */
export async function foreignStories(
  file: string,
  wrappers: ReadonlySet<string>,
  own: ReadonlyMap<string, 'meta' | 'story'>,
  trace: Trace,
  read: (file: string) => string,
): Promise<ForeignStories> {
  const answers = new Map<string, Promise<boolean | undefined>>();

  /** Whether the binding `at` exports as `name` is a story, or, `called`, returns one. */
  const exported = async (at: string, name: string, called: boolean, depth: number): Promise<boolean | undefined> => {
    const key = await trace.declaring(at, name);
    if (!key) return undefined;
    if (own.has(key)) return called && own.get(key) === 'story';
    const memo = `${key}:${called}`;
    if (!answers.has(memo)) {
      // Set before it is awaited, so a cycle of imports meets a pending answer and not a second walk.
      answers.set(memo, depth > MAX_DEPTH ? Promise.resolve(undefined) : declared(key, called, depth));
    }
    return answers.get(memo);
  };

  const declared = async (key: string, called: boolean, depth: number): Promise<boolean | undefined> => {
    const at = key.slice(0, key.lastIndexOf('#'));
    const local = key.slice(at.length + 1);
    let scope: Scope;
    try {
      scope = scan(parseFile(read(at), at), new Set());
    } catch {
      return undefined;
    }
    const node = scope.bindings.get(local);
    if (!node) return undefined;
    const { result } = await settled(
      (foreign) => (called ? isFn(node) && mayReturnStory(node, { ...scope, foreign }) : mayBeStory(node, { ...scope, foreign })),
      asking(at, depth + 1),
    );
    return result;
  };

  const asking =
    (at: string, depth: number): Ask =>
    async (kind, name) => {
      const mod = trace.info(at);
      const exp = mod?.exports.get(name);
      const from = kind === 'reexports' ? (exp?.kind === 'from' ? exp : undefined) : mod?.imports.get(name);
      if (!from || from.imported === '*') return undefined;
      const target = await trace.target(from.spec, at);
      return target ? exported(target, from.imported, kind === 'calls', depth) : undefined;
    };

  // Indexing the file is what asks: it reads exactly the exports a native file's index depends on.
  try {
    const program = parseFile(read(file), file);
    return (await settled((foreign) => void indexProgram(program, file, '', wrappers, foreign), asking(file, 0))).known;
  } catch {
    return { values: {}, calls: {}, reexports: {} };
  }
}
