import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import {
  EllipseIcon, ImageIcon, KIT_SHAPE_KINDS, LassoIcon, LineIcon, PenIcon, PencilIcon, PolygonIcon,
  RectIcon, StarIcon, TextIcon, UnknownIcon,
} from '@weasel-js/core';
import { CheckIcon, DeleteIcon, RedoIcon, ShapeKindIcon, UndoIcon } from './index';
import { isFillable } from './Icon';
import { ICON_FILLS, ICON_GROUPS, ICON_PATHS, type IconName } from './paths';

const NAMES = Object.keys(ICON_PATHS) as IconName[];

describe('icon set', () => {
  it('renders every glyph with drawable content', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
      expect(svg?.children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('hides unlabeled glyphs from assistive tech and names labeled ones', () => {
    const { container: bare } = render(<Icon name="close" />);
    expect(bare.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    const { container: named } = render(<Icon name="close" label="Close trial" />);
    const svg = named.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Close trial');
  });

  // Guards the emitter bug that fused `d="…"` to a following attribute.
  it('keeps every path element well formed', () => {
    for (const name of NAMES) {
      expect(ICON_PATHS[name], name).not.toMatch(/"[a-z-]+=/);
    }
  });

  it('files every glyph under exactly one group', () => {
    const grouped = ICON_GROUPS.flatMap((g) => g.names);
    expect([...grouped].sort()).toEqual([...NAMES].sort());
  });

  it('names a glyph for every fill', () => {
    for (const name of Object.keys(ICON_FILLS)) {
      expect(ICON_PATHS, name).toHaveProperty(name);
      expect(isFillable(name as IconName), name).toBe(true);
    }
  });

  it('draws the shade behind the stroke, and only when asked', () => {
    const { container: plain, unmount } = render(<Icon name="shapeHexagon" />);
    expect(plain.querySelectorAll('path')).toHaveLength(1);
    unmount();

    const { container } = render(<Icon name="shapeHexagon" filled />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('currentColor');
    expect(paths[0]?.getAttribute('stroke')).toBe('none');
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBe('0.16');
  });

  // A curve with poles or an unbounded branch encloses nothing, so `filled` has to
  // be a no-op on it rather than an error — a caller sets it across a whole set.
  it('ignores filled on a glyph with no enclosed region', () => {
    expect(isFillable('curveTangent')).toBe(false);
    const { container } = render(<Icon name="curveTangent" filled />);
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBeNull();
  });

  // A browser synthesizes `click` only if the node pointerdown hit is still in the
  // document at pointerup. Rebuilding the glyph on a re-render during the press
  // removes it, so the button the icon sits in never gets the click.
  it('keeps its drawn nodes across a re-render', () => {
    const { container, rerender } = render(<Icon name="export" size={16} />);
    const first = container.querySelector('svg')?.firstElementChild;
    expect(first).not.toBeNull();
    rerender(<Icon name="export" size={16} className="pressed" />);
    expect(container.querySelector('svg')?.firstElementChild).toBe(first);
  });

  it('marks the glyphs whose corners must stay points', () => {
    expect(ICON_PATHS.shapePentagram).toContain('stroke-linejoin="miter"');
    expect(ICON_PATHS.shapeCircle).not.toContain('stroke-linejoin');
    // A waveform's acute corners grow spikes under miter, so they stay round.
    expect(ICON_PATHS.arcZigzag).not.toContain('stroke-linejoin');
  });
});

describe('CheckIcon', () => {
  it('draws the check glyph as one open stroke, in the State family', () => {
    const { container } = render(<CheckIcon label="Handled" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Handled');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(ICON_PATHS.check.match(/d="([^"]+)"/)?.[1]);
    expect(ICON_PATHS.check).toMatch(/^<path d="M[^"Zz]+"\/>$/);
    expect(ICON_GROUPS.find((g) => g.names.includes('check'))?.label).toBe('State');
  });
});

// These three are drawn here but live in core, which ships them on its actions.
describe('core-owned action glyphs', () => {
  it.each([
    ['undo', UndoIcon], ['redo', RedoIcon], ['delete', DeleteIcon],
  ] as const)('draws %s the same as <Icon>', (name, Component) => {
    const a = render(<Component size={16} label="x" className="c" />).container.innerHTML;
    const b = render(<Icon name={name} size={16} label="x" className="c" />).container.innerHTML;
    expect(a).toBe(b);
  });
});

describe('core action glyph re-exports', () => {
  it('passes the align and distribute glyphs through by identity', async () => {
    const ui = await import('./index');
    const core = await import('@weasel-js/core');
    for (const name of [
      'AlignLeftIcon', 'AlignCenterXIcon', 'AlignRightIcon',
      'AlignTopIcon', 'AlignCenterYIcon', 'AlignBottomIcon',
      'DistributeHorizontalIcon', 'DistributeVerticalIcon',
    ] as const) {
      expect(ui[name], name).toBe(core[name]);
      expect(ui[name], name).toBeTypeOf('function');
    }
  });
});

describe('ShapeKindIcon', () => {
  const GLYPHS = {
    rect: RectIcon, ellipse: EllipseIcon, line: LineIcon, polygon: PolygonIcon, star: StarIcon,
    pen: PenIcon, pencil: PencilIcon, lasso: LassoIcon, text: TextIcon, image: ImageIcon,
  };

  it('draws the insertion tool glyph for every built-in shape kind', () => {
    for (const kind of [...KIT_SHAPE_KINDS, 'image'] as const) {
      const Glyph = GLYPHS[kind];
      const a = render(<ShapeKindIcon kind={kind} size={16} />).container.innerHTML;
      const b = render(<Glyph size={16} />).container.innerHTML;
      expect(a, kind).toBe(b);
    }
  });

  it('falls back to the unknown glyph for a kind the kit does not ship', () => {
    const a = render(<ShapeKindIcon kind="sprocket" />).container.innerHTML;
    const b = render(<UnknownIcon />).container.innerHTML;
    expect(a).toBe(b);
  });
});
