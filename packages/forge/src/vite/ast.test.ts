import { describe, expect, it } from 'vitest';
import { bindingsOf, parseFile } from './ast.ts';

describe('bindingsOf', () => {
  it("reads a top-level `let` a function reassigns as reassigned, past a nested static block's own `var`", () => {
    const program = parseFile('let x = 1;\nfunction f() { class C { static { var x; } } x = 2; }\n', 'x.ts');
    expect(bindingsOf(program).get('x')?.type).toBe('VariableDeclarator');
  });
});
