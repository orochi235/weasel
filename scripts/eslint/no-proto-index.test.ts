import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { join } from 'node:path';
import { afterAll, describe, it } from 'vitest';
import rule from './no-proto-index.mjs';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const dir = join(import.meta.dirname, 'fixtures/proto-index');
const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { projectService: true, tsconfigRootDir: dir },
  },
});

const filename = join(dir, 'file.ts');
const valid = (code: string) => ({ code, filename });
const invalid = (code: string, messageId: 'read' | 'write') => ({ code, filename, errors: [{ messageId }] });

tester.run('no-proto-index', rule, {
  valid: [
    valid("declare const t: Record<string, number>; t['x'];"),
    valid("declare const t: Record<string, number>; declare const k: 'a' | 'b'; t[k];"),
    valid('declare const t: Record<string, number>; declare const k: `data-${number}`; t[k];'),
    valid('declare const xs: number[]; declare const i: number; xs[i];'),
    valid('declare const t: { [i: number]: string }; declare const k: string; t[k as unknown as number];'),
    valid('declare const m: Map<string, number>; declare const k: string; m.get(k);'),
    valid("declare const t: { a: 1; b: 2 }; declare const k: 'a'; t[k];"),
    valid('declare const t: Record<string, number>; declare const k: string; delete t[k];'),
    valid('declare const t: Record<string, number>; declare const k: string; Object.hasOwn(t, k) ? t[k] : 0;'),
    valid('declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, k) && t[k] > 0) {}'),
    valid('declare const t: Record<string, number>; declare const k: string; if (!Object.hasOwn(t, k)) throw 0; t[k];'),
    valid('declare const t: Record<string, number>; declare function hasOwnKey(o: object, k: string): boolean; declare const k: string; if (hasOwnKey(t, k)) t[k];'),
    valid('declare const t: Record<string, number>; for (const k in t) t[k];'),
    valid('declare const t: Record<string, number>; for (const k of Object.keys(t)) t[k] = 1;'),
    valid('declare const t: Record<string, number>; for (const [k] of Object.entries(t)) t[k];'),
    valid('declare const t: Record<string, number>; Object.keys(t).sort().forEach((k) => t[k]);'),
    valid('declare const t: Record<string, number>; const ks = Object.keys(t); ks.every((k) => t[k]);'),
    valid('declare const v: object; for (const k of Object.keys(v)) (v as Record<string, unknown>)[k];'),
    valid('declare const v: object; declare const k: string; function f() { if (k === "" || !Object.hasOwn(v, k)) return; (v as Record<string, unknown>)[k]; }'),
    valid('declare const t: Record<string, number>; declare const k: string; if (k === "__proto__") {} else t[k] = 1;'),
    valid('declare const t: Record<string, number>; declare const k: string; if (k !== "__proto__") t[k] = 1;'),
  ],
  invalid: [
    invalid('declare const t: Record<string, number>; declare const k: string; t[k];', 'read'),
    invalid('declare const t: { [k: string]: number }; declare const k: string; t[k];', 'read'),
    invalid('declare const t: Record<string, number> | undefined; declare const k: string; t?.[k];', 'read'),
    invalid('declare const t: Record<string, number>; declare const k: string | undefined; t[k!];', 'read'),
    invalid('declare const t: Record<string, number>; function f<K extends string>(k: K) { return t[k]; }', 'read'),
    invalid('declare const t: Record<string, number>; declare const k: string; t[k] = 1;', 'write'),
    invalid('declare const t: Record<string, number>; declare const k: string; t[k] += 1;', 'read'),
    invalid('declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, k)) {} t[k];', 'read'),
    invalid('declare const t: Record<string, number>; declare const u: Record<string, number>; for (const k in u) t[k];', 'read'),
    invalid('declare const t: Record<string, number>; declare const k: string; if (Object.hasOwn(t, "x")) t[k];', 'read'),
    invalid('declare const t: Record<string, number>; declare const k: string; if (k !== "__proto__") t[k];', 'read'),
  ],
});
