import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import rule from './no-arrow-strict-wrapper.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});

tester.run('no-arrow-strict-wrapper', rule, {
  valid: [
    'renderHook(() => useX(), { wrapper: StrictMode });',
    'renderHook(() => useX(), { reactStrictMode: true });',
    'renderHook(() => useX(), { wrapper: ({ children }) => <Provider>{children}</Provider> });',
    'const Wrapper = StrictMode; renderHook(() => useX(), { wrapper: Wrapper });',
  ],
  invalid: [
    { code: 'renderHook(() => useX(), { wrapper: ({ children }) => <StrictMode>{children}</StrictMode> });', errors: [{ messageId: 'arrow' }] },
    { code: 'render(<A />, { wrapper: ({ children }) => { return <React.StrictMode>{children}</React.StrictMode>; } });', errors: [{ messageId: 'arrow' }] },
  ],
});
