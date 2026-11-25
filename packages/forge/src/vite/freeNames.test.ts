import { describe, expect, it } from 'vitest';
import { parseFile } from './ast.ts';
import { freeNames } from './freeNames.ts';

const namesIn = (code: string): Set<string> => freeNames(parseFile(code, 'x.tsx'));

describe('freeNames', () => {
  it('reads the decorators of a class method and of its parameters', () => {
    const names = namesIn('class Panel { @bound handle(@inject(Token) x) { return x; } @track("x") #render() {} }');
    expect(names).toContain('bound');
    expect(names).toContain('inject');
    expect(names).toContain('Token');
    expect(names).toContain('track');
    expect(names).not.toContain('x');
  });

  it('takes import.meta and new.target for no reference', () => {
    const names = namesIn('function f() { return [import.meta.env, new.target]; }');
    expect(names).not.toContain('import');
    expect(names).not.toContain('meta');
    expect(names).not.toContain('new');
    expect(names).not.toContain('target');
  });

  it("takes a static block's `var` for its own, not a reference to a top-level name", () => {
    expect(namesIn('class C { static { var x = 1; use(x); } }')).not.toContain('x');
  });

  it('reads a parameter default in the outer scope, past a `var` of the same name in the body', () => {
    expect(namesIn('function C(p = Icon) { var Icon; return p; }')).toContain('Icon');
    expect(namesIn('function C(p = 1) { var Icon; return Icon; }')).not.toContain('Icon');
  });

  it('takes an intrinsic or namespaced tag for no reference, and a component or member tag for one', () => {
    const names = namesIn('const C = () => <label><svg:rect /><my-el /><Icon /><ui.Panel /></label>;');
    for (const intrinsic of ['label', 'svg', 'rect', 'my-el']) expect(names).not.toContain(intrinsic);
    expect(names).toContain('Icon');
    expect(names).toContain('ui');
  });

  it('reads the values a namespace or an enum body refers to, and none an ambient one declares', () => {
    const names = namesIn('namespace Parts { export const Icon = () => <Glyph />; const Own = 1; use(Own, Icon); }');
    expect(names).toContain('Glyph');
    expect(names).toContain('use');
    expect(names).not.toContain('Own');
    expect(names).not.toContain('Icon');
    const members = namesIn('enum E { A = compute(), B = A, C = E.A }');
    expect(members).toContain('compute');
    expect(members).not.toContain('A');
    expect(members).not.toContain('E');
    expect(namesIn('declare namespace N { const x: typeof Hidden; }')).not.toContain('Hidden');
  });

  it('reads the name an import alias refers to', () => {
    expect(namesIn('import Icon = Parts.Icon;')).toContain('Parts');
  });
});
