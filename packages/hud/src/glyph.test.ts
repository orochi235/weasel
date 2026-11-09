import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import type { IconGlyph, IconRef, IconSpec } from '@weasel-js/icons';
import { glyphCommands, iconCommands } from './glyph';

const glyph = (body: string): IconGlyph => ({ body, group: 'test', tags: [] });
const at = { x: 10, y: 20, size: 16, color: '#123456' };

/** Every path command in the tree, with the transforms above it. */
function paths(cmds: readonly DrawCommand[], above: readonly GroupDrawCommand[] = []): { cmd: PathDrawCommand; above: readonly GroupDrawCommand[] }[] {
  return cmds.flatMap((c) => (c.kind === 'path' ? [{ cmd: c, above }]
    : c.kind === 'group' ? paths(c.children, [...above, c]) : []));
}

describe('glyphCommands', () => {
  it("scales the 20×20 viewBox into the square, and strokes as <Icon>'s root does, in the given color", () => {
    const [root] = glyphCommands(glyph('<path d="M0 0 L20 20"/>'), at);
    expect(root!.kind).toBe('group');
    const t = (root as GroupDrawCommand).transform!;
    expect([t[0], t[4], t[6], t[7]]).toEqual([0.8, 0.8, 10, 20]);
    const [{ cmd }] = paths([root!]);
    expect(cmd!.fill).toBeUndefined();
    expect(cmd!.stroke).toMatchObject({ paint: { color: '#123456' }, width: 1.5, cap: 'round', join: 'round' });
  });

  it('draws every shape element the tables use, and inherits presentation from a g', () => {
    const body = '<g stroke-width="2" stroke-linecap="butt"><rect x="1" y="1" width="4" height="4" rx="1"/>'
      + '<circle cx="10" cy="10" r="2" fill="currentColor"/></g><ellipse cx="5" cy="5" rx="2" ry="1"/>'
      + '<line x1="0" y1="0" x2="4" y2="4"/><polygon points="0,0 4,0 4,4"/><polyline points="0 0 2 2 4 0"/>';
    const found = paths(glyphCommands(glyph(body), at)).map((p) => p.cmd);
    // The circle fills and strokes, so it is two commands.
    expect(found).toHaveLength(7);
    expect(found[0]!.stroke).toMatchObject({ width: 2, cap: 'butt' });
    expect(found[1]!.fill).toMatchObject({ paint: { color: '#123456' } });
    expect(found[3]!.stroke).toMatchObject({ width: 1.5, cap: 'round' });
  });

  it('applies transforms, clips to a nested svg, and skips defs', () => {
    const body = '<defs><clipPath id="c"><rect width="1" height="1"/></clipPath></defs>'
      + '<g transform="rotate(90 10 10)"><svg x="2" y="0" width="5" height="20" viewBox="2 0 5 20"><path d="M0 0 H20"/></svg></g>';
    const found = paths(glyphCommands(glyph(body), at));
    expect(found).toHaveLength(1);
    const [, rotated, nested] = found[0]!.above;
    const t = rotated!.transform!;
    expect([t[0], t[1], t[3], t[4]].map((v) => Math.round(v))).toEqual([0, 1, -1, 0]);
    expect(nested!.clip).toEqual({ kind: 'rect', x: 2, y: 0, width: 5, height: 20 });
  });

  it('keeps fill-opacity to the fill and paints nothing for none', () => {
    const found = paths(glyphCommands(glyph('<path d="M0 0 H4 V4 Z" fill="currentColor" fill-opacity="0.4" stroke="none"/>'), at));
    expect(found).toHaveLength(1);
    expect(found[0]!.cmd.stroke).toBeUndefined();
    expect(found[0]!.above.at(-1)!.alpha).toBe(0.4);
  });
});

describe('iconCommands', () => {
  const table: Record<string, IconGlyph> = {
    'test:page': glyph('<rect x="2" y="2" width="16" height="16"/>'),
    'test:plus': glyph('<path d="M10 3.5v13M3.5 10h13"/>'),
  };
  const icons = { get: (r: string) => table[r] };
  const spec = (name: string, mark?: string) => ({ name, mark }) as unknown as IconSpec;

  it('draws a bare ref as its glyph alone', () => {
    expect(iconCommands(icons, 'test:page' as IconRef, at)).toEqual(glyphCommands(table['test:page']!, at));
  });

  it("erases the subject under the mark in an isolated group, then draws the mark in the corner at the subject's weight", () => {
    const [cutGroup, mark] = iconCommands(icons, spec('test:page', 'test:plus'), at);
    expect(cutGroup).toMatchObject({ kind: 'group', isolate: true });
    expect((cutGroup as GroupDrawCommand).children[1]).toMatchObject({ kind: 'group', composite: 'destination-out' });
    // The slot is the frame's lower-right half from 10.5, at 16px.
    const t = (mark as GroupDrawCommand).transform!;
    expect([t[0], t[6], t[7]]).toEqual([0.4, 10 + 8.4, 20 + 8.4]);
    const [{ cmd, above }] = paths([mark!]);
    const scaled = above.reduce((k, g) => k * (g.transform?.[0] ?? 1), 1);
    expect(Number(cmd!.stroke!.width) * scaled).toBeCloseTo(1.5 * 0.8);
  });

  it('draws the subject alone when the mark is missing, and nothing when the subject is', () => {
    expect(iconCommands(icons, spec('test:page', 'test:none'), at)).toEqual(glyphCommands(table['test:page']!, at));
    expect(iconCommands(icons, spec('test:none'), at)).toEqual([]);
  });
});
