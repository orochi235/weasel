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
});
