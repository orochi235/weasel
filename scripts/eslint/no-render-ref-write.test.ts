import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import rule from './no-render-ref-write.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const err = (target: string) => ({ messageId: 'renderWrite', data: { target } });

tester.run('no-render-ref-write', rule, {
  valid: [
    // Reads are never reported.
    'function C({ v }) { const r = useRef(v); return r.current; }',
    'function useX() { const r = useRef(0); const n = r.current + 1; return n; }',
    // Callbacks that run after render.
    'function C({ v }) { const r = useRef(v); useEffect(() => { r.current = v; }); return null; }',
    'function C({ v }) { const r = useRef(v); useLayoutEffect(() => { r.current = v; }); return null; }',
    'function C({ v }) { const r = useRef(v); useInsertionEffect(() => { r.current = v; }); return null; }',
    'function C({ v }) { const r = useRef(v); const f = useCallback(() => { r.current = v; }, [v]); return f; }',
    'function C() { const r = useRef(0); return <button onClick={() => { r.current++; }} />; }',
    'function useX() { const r = useRef(0); return { bump() { r.current += 1; } }; }',
    'function useX() { const r = useRef(0); function onEvent() { r.current = 1; } return onEvent; }',
    // Not a component or a hook.
    'function helper(r) { r.current = 1; }',
    'const helper = (r) => { r.current = 1; };',
    'class K { m() { this.r.current = 1; } }',
    'ref.current = 1;',
    // Lazy initialization, in each allowed spelling.
    'function C() { const r = useRef(null); if (r.current == null) r.current = make(); return null; }',
    'function C() { const r = useRef(null); if (r.current === null) { r.current = make(); } return null; }',
    'function C() { const r = useRef(); if (r.current === undefined) r.current = make(); return null; }',
    'function C() { const r = useRef(null); if (!r.current) r.current = make(); return null; }',
    'function C() { const r = useRef(null); if (null == r.current) r.current = make(); return null; }',
    'function useX() { const r = useRef(null); r.current ??= make(); return r; }',
  ],
  invalid: [
    { code: 'function C({ v }) { const r = useRef(v); r.current = v; return null; }', errors: [err('r.current')] },
    { code: 'const C = ({ v }) => { const r = useRef(v); r.current = v; return null; };', errors: [err('r.current')] },
    { code: 'function useX(v) { const r = useRef(v); r.current = v; return r; }', errors: [err('r.current')] },
    { code: 'const useX = function (v) { const r = useRef(v); r.current = v; return r; };', errors: [err('r.current')] },
    // Nested blocks in render are still render.
    { code: 'function C({ v, on }) { const r = useRef(v); if (on) { r.current = v; } return null; }', errors: [err('r.current')] },
    { code: 'function C({ vs }) { const r = useRef(0); for (const v of vs) r.current += v; return null; }', errors: [err('r.current')] },
    { code: 'function C() { const r = useRef(0); r.current++; return null; }', errors: [err('r.current')] },
    // Through the ref.
    { code: 'function C({ v }) { const r = useRef({}); r.current.v = v; return null; }', errors: [err('r.current')] },
    { code: 'function C({ fwd, v }) { fwd.current = v; return null; }', errors: [err('fwd.current')] },
    // Callbacks React calls during render.
    { code: 'function C({ v }) { const r = useRef(v); useMemo(() => { r.current = v; }, [v]); return null; }', errors: [err('r.current')] },
    { code: 'function C({ v }) { const r = useRef(v); React.useMemo(() => { r.current = v; }, [v]); return null; }', errors: [err('r.current')] },
    { code: 'function C({ v }) { const r = useRef(v); useState(() => { r.current = v; return 0; }); return null; }', errors: [err('r.current')] },
    { code: 'function C({ v }) { const r = useRef(v); useReducer((s) => { r.current = s; return s; }, 0); return null; }', errors: [err('r.current')] },
    { code: 'function C({ v }) { const r = useRef(v); (() => { r.current = v; })(); return null; }', errors: [err('r.current')] },
    // Component wrappers.
    { code: 'const C = forwardRef((p, ref) => { const r = useRef(p); r.current = p; return null; });', errors: [err('r.current')] },
    { code: 'const C = memo(function (p) { const r = useRef(p); r.current = p; return null; });', errors: [err('r.current')] },
    // Not the lazy-init shape: extra statement, an else, a different ref, or a non-empty test.
    { code: 'function C() { const r = useRef(null); if (r.current == null) { r.current = make(); log(); } return null; }', errors: [err('r.current')] },
    { code: 'function C() { const r = useRef(null); if (r.current == null) r.current = make(); else r.current = other(); return null; }', errors: [err('r.current'), err('r.current')] },
    { code: 'function C() { const a = useRef(null); const b = useRef(null); if (a.current == null) b.current = make(); return null; }', errors: [err('b.current')] },
    { code: 'function C({ v }) { const r = useRef(v); if (r.current !== v) r.current = v; return null; }', errors: [err('r.current')] },
    { code: 'function C() { const r = useRef(null); if (r.current == null) r.current.x = 1; return null; }', errors: [err('r.current')] },
    { code: 'function C({ v }) { const r = useRef(v); r.current ||= v; return null; }', errors: [err('r.current')] },
  ],
});
