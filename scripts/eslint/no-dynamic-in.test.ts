import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import rule from './no-dynamic-in.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module' } });

tester.run('no-dynamic-in', rule, {
  valid: [
    "if ('touches' in e) read(e);",
    'const shaped = `id` in node;',
    'for (const k in table) use(k);',
    'class A { #x = 1; static has(o: object) { return #x in o; } }',
    'Object.hasOwn(table, key);',
  ],
  invalid: [
    { code: 'if (key in table) use(table[key]);', errors: [{ messageId: 'dynamic' }] },
    { code: 'const absent = !(name in TABLE);', errors: [{ messageId: 'dynamic' }] },
    { code: 'const listed = ids.filter((id) => id in shown);', errors: [{ messageId: 'dynamic' }] },
    { code: 'const sym = SHOWN in node;', errors: [{ messageId: 'dynamic' }] },
  ],
});
