import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import rule from './no-hand-lerp.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module' } });

tester.run('no-hand-lerp', rule, {
  valid: [
    'lerp(a, b, t);',
    'a * (1 - t) + b * t;',
    'p[(i - 1) * 2 + 1];',
    'cx + (2 / 3) * (qx - cx);',
    'a + (b - c) * t;',
    'A + 1 + (A - 1) * cos;',
  ],
  invalid: [
    { code: 'a + (b - a) * t;', errors: [{ messageId: 'lerp' }] },
    { code: 'a + t * (b - a);', errors: [{ messageId: 'lerp' }] },
    { code: '(b - a) * t + a;', errors: [{ messageId: 'lerp' }] },
    { code: 'p.x + (q.x - p.x) * f;', errors: [{ messageId: 'lerp' }] },
    { code: 'W[i - 1] + (W[i] - W[i - 1]) * f;', errors: [{ messageId: 'lerp' }] },
    { code: 'a! + (b - a!) * t;', errors: [{ messageId: 'lerp' }] },
  ],
});
