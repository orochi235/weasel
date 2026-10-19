import { afterEach, describe, expect, it } from 'vitest';
import { evalInInspectedWindow, type ExtensionApi } from './browserApi';

type Globals = { browser?: unknown; chrome?: unknown };
const g = globalThis as Globals;

/** A namespace whose `eval` answers only through the shape given. */
function withEval(evaluate: (expression: string, callback?: (r: unknown, e?: unknown) => void) => unknown): ExtensionApi {
  return { devtools: { inspectedWindow: { tabId: 1, eval: evaluate } } } as unknown as ExtensionApi;
}

afterEach(() => {
  delete g.browser;
  delete g.chrome;
});

describe('evalInInspectedWindow', () => {
  it("answers in Chrome, whose `browser` promise resolves to the bare result and whose `chrome` calls back", async () => {
    const browser = withEval(() => Promise.resolve(true));
    g.browser = browser;
    g.chrome = withEval((_, callback) => callback?.(true, undefined));
    await expect(evalInInspectedWindow(browser, 'x')).resolves.toBe(true);
  });

  it('answers in Firefox without a `chrome` namespace, whose promise resolves to [result, exception]', async () => {
    const browser = withEval(() => Promise.resolve([true, undefined]));
    g.browser = browser;
    await expect(evalInInspectedWindow(browser, 'x')).resolves.toBe(true);
  });

  it('rejects with the exception the page threw', async () => {
    const chrome = withEval((_, callback) => callback?.(undefined, { isException: true, value: 'boom' }));
    g.chrome = chrome;
    await expect(evalInInspectedWindow(chrome, 'x')).rejects.toMatchObject({ value: 'boom' });
  });
});
