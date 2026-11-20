import { describe, it, expect } from 'vitest';
import { parseSvg } from './parse';
import { isDeclarationHonored, readProperty } from './properties';
import type { SvgPathNode } from './types';

const parse = (body: string) => parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`);

describe('keywords read without regard to case', () => {
  it('reads a keyword in any case, as the validator already does', () => {
    const { nodes, warnings } = parse('<path d="M0 0L9 9L0 9" stroke="#000" stroke-linejoin="bevel" style="stroke-linejoin: Round; stroke-linecap: SQUARE; fill-rule: EvenOdd"/>');
    expect(warnings).toEqual([]);
    const path = nodes[0] as SvgPathNode;
    expect(path.stroke).toMatchObject({ join: 'round', cap: 'square' });
    expect(path.path).toMatchObject({ fillRule: 'evenodd' });
  });

  it('hides an element with display="None"', () => {
    expect(parse('<rect width="5" height="5" display="None"/>').nodes).toEqual([]);
  });

  it('reads every keyword-valued property case-insensitively', () => {
    expect(readProperty('text-anchor', 'Middle')).toBe('middle');
    expect(readProperty('direction', 'RTL')).toBe('rtl');
    expect(readProperty('visibility', 'Hidden')).toBe('hidden');
    expect(readProperty('vector-effect', 'Non-Scaling-Stroke')).toBe('non-scaling-stroke');
    expect(readProperty('font-weight', 'Bold')).toBe('bold');
    expect(readProperty('font-style', 'Italic')).toBe('italic');
    expect(readProperty('stroke-dasharray', 'None')).toBeNull();
    expect(readProperty('letter-spacing', 'Normal')).toBeNull();
    expect(readProperty('fill', 'Context-Stroke')).toEqual({ kind: 'context', of: 'stroke' });
  });

  it('honors a keyword in any case under @supports', () => {
    expect(isDeclarationHonored('fill-rule', 'EvenOdd')).toBe(true);
    expect(isDeclarationHonored('fill', 'Inherit')).toBe(true);
  });
});
