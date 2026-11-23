import { describe, expect, it } from 'vitest';
import { moduleInfo } from './moduleInfo';

const refsOf = (code: string, name: string) => [...(moduleInfo(code, '/r/a.tsx').refs.get(name) ?? [])].sort();

describe('moduleInfo refs', () => {
  it('leaves out a parameter, an inner const and a catch binding that shadow a top-level name', () => {
    const code = `
export function Button() { return null; }
export function Toolbar({ Button }) { return <Button />; }
export function Menu() { const Button = styled.button; return <Button />; }
export function Safe() { try { return null; } catch (Button) { return Button; } }
`;
    expect(refsOf(code, 'Toolbar')).toEqual([]);
    expect(refsOf(code, 'Menu')).toEqual(['styled']);
    expect(refsOf(code, 'Safe')).toEqual([]);
  });

  it('keeps a top-level name used where nothing shadows it, defaults and other blocks included', () => {
    const code = `
export function Button() { return null; }
export const Bar = ({ icon = Button }) => { if (icon) { const Button = 1; } return <Button />; };
export function Loop() { for (const Button of []) {} label: for (;;) break label; return Button; }
export function Hoisted() { { var Button = 2; } return Button; }
`;
    expect(refsOf(code, 'Bar')).toEqual(['Button']);
    expect(refsOf(code, 'Loop')).toEqual(['Button']);
    expect(refsOf(code, 'Hoisted')).toEqual([]);
  });
});
