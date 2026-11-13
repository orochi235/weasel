import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import globLiteralArgs from './glob-literal-args.mjs';
import noPackageStarExport from './no-package-star-export.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module' } });

tester.run('glob-literal-args', globLiteralArgs, {
  valid: [
    "import.meta.glob('./*.ts');",
    "import.meta.glob(['./a/*.ts', '!./a/skip.ts'], { eager: true, import: 'default', query: { raw: '' } });",
    'import.meta.glob(`./*.svg`, { query: "?raw" });',
    "import.meta.glob<string>('./*.md', { eager: !0 });",
    'const PATTERNS = ["./*.ts"]; other.glob(PATTERNS);',
  ],
  invalid: [
    { code: 'const P = "./*.ts"; import.meta.glob(P);', errors: [{ messageId: 'dynamic', data: { which: 'patterns' } }] },
    { code: 'const O = { eager: true }; import.meta.glob("./*.ts", O);', errors: [{ messageId: 'dynamic', data: { which: 'options' } }] },
    { code: 'import.meta.glob(["./a/*.ts", ...more]);', errors: [{ messageId: 'dynamic' }] },
    { code: 'import.meta.glob("./*.ts", { ...base, eager: true });', errors: [{ messageId: 'dynamic' }] },
    { code: 'import.meta.glob(`./${dir}/*.ts`);', errors: [{ messageId: 'dynamic' }] },
  ],
});

tester.run('no-package-star-export', noPackageStarExport, {
  valid: [
    "export * from './local';",
    "export * as routing from '@weasel-js/routing';",
    "export type * from '@weasel-js/routing';",
    "export { a, b } from '@weasel-js/routing';",
    { code: "export * from 'interactions/actions/move';", options: [{ internal: ['interactions/'] }] },
  ],
  invalid: [
    { code: "export * from '@weasel-js/routing';", errors: [{ messageId: 'star', data: { spec: '@weasel-js/routing' } }] },
    { code: "export * from 'earcut';", errors: [{ messageId: 'star' }] },
  ],
});
