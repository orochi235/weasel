import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import rule from './effect-cleanup.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('effect-cleanup', rule, {
  valid: [
    'useEffect(() => store.subscribe(fn), [store]);',
    'useEffect(() => { const off = store.subscribe(fn); return off; }, [store]);',
    'useEffect(() => { if (!on) return; window.addEventListener("x", f); return () => window.removeEventListener("x", f); });',
    'useEffect(() => { scene.update(id, data); }, [scene]);',
    'useEffect(() => { const f = () => store.subscribe(g); run(f); }, []);',
    'useEffect(() => { onReady?.(); }, [onReady]);',
  ],
  invalid: [
    { code: 'useEffect(() => { store.subscribe(fn); }, [store]);', errors: [{ messageId: 'leak' }] },
    { code: 'useLayoutEffect(() => { el.addEventListener("x", f); }, [el]);', errors: [{ messageId: 'leak' }] },
    { code: 'useEffect(() => { if (on) registerFontOutlines(a, b, c); else unregisterFontOutlines(a, b); }, [on]);', errors: [{ messageId: 'leak' }] },
    { code: 'useEffect(() => { const id = setInterval(tick, 100); }, []);', errors: [{ messageId: 'leak' }] },
  ],
});
