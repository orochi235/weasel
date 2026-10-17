import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { Icon } from './Icon';
import { CheckIcon, DeleteIcon, RedoIcon, UndoIcon } from './index';
import { isFillable } from './Icon';
import { ICON_GROUPS, icon, type UiIconName } from '../icons.gen';
import { icons as uiIcons } from '../icons.table';
import { withIcons } from '../testing/withIcons';

const NAMES = Object.keys(uiIcons.icons) as UiIconName[];
const body = (name: string) => uiIcons.icons[name]!.body;
/** `name`'s body as the DOM serializes it once parsed. */
const parsed = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.innerHTML = body(name);
  return svg.innerHTML;
};
const MARKS = ICON_GROUPS.find((g) => g.label === 'Marks')!.names;
const draw = (ui: Parameters<typeof render>[0]) => render(ui, { wrapper: withIcons });

describe('icon set', () => {
  it('renders every glyph with drawable content', () => {
    for (const name of NAMES) {
      const { container, unmount } = draw(<Icon name={icon(name)} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
      expect(svg?.innerHTML, name).toBe(parsed(name));
      expect(svg?.children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('hides unlabeled glyphs from assistive tech and names labeled ones', () => {
    const { container: bare } = draw(<Icon name={icon('close')} />);
    expect(bare.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    const { container: named } = draw(<Icon name={icon('close')} label="Close trial" />);
    const svg = named.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBe('Close trial');
  });

  it('draws the placeholder for a name no registry in scope holds', () => {
    const { container } = render(<Icon name={icon('close')} />);
    expect(container.querySelector('svg circle')).not.toBeNull();
  });

  // Guards the emitter bug that fused `d="…"` to a following attribute.
  it('keeps every path element well formed', () => {
    for (const name of NAMES) {
      expect(body(name), name).not.toMatch(/"[a-z-]+=/);
    }
  });

  it('files every glyph under exactly one group', () => {
    const grouped = ICON_GROUPS.flatMap((g) => g.names);
    expect([...grouped].sort()).toEqual([...NAMES].sort());
  });

  it('reads fillability off the glyph', () => {
    for (const name of NAMES) {
      expect(isFillable(uiIcons.icons[name]), name).toBe(uiIcons.icons[name]!.fill !== undefined);
    }
    expect(isFillable(undefined)).toBe(false);
  });

  it('draws the shade behind the stroke, and only when asked', () => {
    const { container: plain, unmount } = draw(<Icon name={icon('shapeHexagon')} />);
    expect(plain.querySelectorAll('path')).toHaveLength(1);
    unmount();

    const { container } = draw(<Icon name={icon('shapeHexagon')} filled />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('fill')).toBe('currentColor');
    expect(paths[0]?.getAttribute('stroke')).toBe('none');
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBe('0.16');
  });

  // A curve with poles or an unbounded branch encloses nothing, so `filled` has to
  // be a no-op on it rather than an error — a caller sets it across a whole set.
  it('ignores filled on a glyph with no enclosed region', () => {
    expect(isFillable(uiIcons.icons.curveTangent)).toBe(false);
    const { container } = draw(<Icon name={icon('curveTangent')} filled />);
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBeNull();
  });

  // A browser synthesizes `click` only if the node pointerdown hit is still in the
  // document at pointerup. Rebuilding the glyph on a re-render during the press
  // removes it, so the button the icon sits in never gets the click.
  it('keeps its drawn nodes across a re-render', () => {
    const { container, rerender } = draw(<Icon name={icon('export')} size={16} />);
    const first = container.querySelector('svg')?.firstElementChild;
    expect(first).not.toBeNull();
    rerender(<Icon name={icon('export')} size={16} className="pressed" />);
    expect(container.querySelector('svg')?.firstElementChild).toBe(first);
  });

  it('marks the glyphs whose corners must stay points', () => {
    expect(body('shapePentagram')).toContain('stroke-linejoin="miter"');
    expect(body('shapeCircle')).not.toContain('stroke-linejoin');
    // A waveform's acute corners grow spikes under miter, so they stay round.
    expect(body('arcZigzag')).not.toContain('stroke-linejoin');
  });
});

describe('a marked glyph', () => {
  it('draws the mark after the glyph, scaled into the corner at the glyph\'s own stroke weight', () => {
    const { container } = draw(<Icon name={icon('formPage')} mark={icon('markAdd')} />);
    const [glyph, mark] = [...container.querySelectorAll('svg > g')];
    expect(glyph?.querySelector('rect')).not.toBeNull();
    expect(mark?.querySelector('path')?.getAttribute('d')).toBe(body('markAdd').match(/d="([^"]+)"/)?.[1]);
    expect(mark?.getAttribute('transform')).toBe('translate(10.5 10.5) scale(0.5)');
    // 1.5 on the frame, once the group's scale has been applied to it.
    expect(Number(mark?.getAttribute('stroke-width')) * 0.5).toBeCloseTo(1.5);
  });

  it('clears the glyph from around the mark with a mask of its own', () => {
    const { container } = draw(<><Icon name={icon('formPage')} mark={icon('markAdd')} /><Icon name={icon('formTab')} mark={icon('markAdd')} /></>);
    const ids = [...container.querySelectorAll('svg')].map((svg) => {
      const id = svg.querySelector('mask')?.id;
      expect(svg.querySelector(':scope > g')?.getAttribute('mask')).toBe(`url(#${id})`);
      return id;
    });
    expect(new Set(ids).size).toBe(2);
  });

  it('cuts the mask from the mark itself, stroked wider by the band and filled', () => {
    const { container } = draw(<Icon name={icon('formPage')} mark={icon('markReset')} />);
    const cut = container.querySelector('mask > g');
    expect(cut?.getAttribute('transform')).toBe('translate(10.5 10.5) scale(0.5)');
    expect(cut?.getAttribute('fill')).toBe('#000');
    // 1.5 of stroke and 1.5 of band on each side of it, on the frame.
    expect(Number(cut?.getAttribute('stroke-width')) * 0.5).toBeCloseTo(4.5);
    const [arc, head] = [...(cut?.querySelectorAll('path') ?? [])];
    expect(arc?.getAttribute('d')).toBe(body('markReset').match(/d="([^"]+)"/)?.[1]);
    // The head is drawn without a stroke, so the band is all of its stroke here.
    expect(head?.getAttribute('stroke')).toBeNull();
    expect(Number(head?.getAttribute('stroke-width')) * 0.5).toBeCloseTo(3);
  });

  it('keeps the shade\'s tint off the mark and the mask', () => {
    const { container } = draw(<Icon name={icon('shapeHexagon')} filled mark={icon('markDot')} />);
    expect(container.querySelector('svg')?.getAttribute('fill-opacity')).toBe('0.16');
    expect(container.querySelector('mask')?.getAttribute('fill-opacity')).toBe('1');
    expect(container.querySelectorAll('svg > g')[1]?.getAttribute('fill-opacity')).toBe('1');
  });

  it('keeps its drawn nodes across a re-render', () => {
    const { container, rerender } = draw(<Icon name={icon('formPage')} mark={icon('markAdd')} />);
    const first = container.querySelector('svg')?.firstElementChild;
    rerender(<Icon name={icon('formPage')} mark={icon('markAdd')} className="pressed" />);
    expect(container.querySelector('svg')?.firstElementChild).toBe(first);
  });

  it('takes the Marks family, none of which sets a stroke width the slot would scale down', () => {
    expect(MARKS.length).toBeGreaterThan(0);
    for (const name of MARKS) expect(body(name), name).not.toContain('stroke-width');
  });
});

describe('CheckIcon', () => {
  it('draws the check glyph as one open stroke, in the State family', () => {
    const { container } = draw(<CheckIcon label="Handled" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Handled');
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe(body('check').match(/d="([^"]+)"/)?.[1]);
    expect(body('check')).toMatch(/^<path d="M[^"Zz]+"\/>$/);
    expect(ICON_GROUPS.find((g) => g.names.includes('check'))?.label).toBe('State');
  });
});

// Drawn in ui's definitions once, now core's to ship on its actions.
describe('core-owned action glyphs', () => {
  it.each([
    ['undo', UndoIcon], ['redo', RedoIcon], ['delete', DeleteIcon],
  ] as const)('draws %s the same as <Icon>', (name, Component) => {
    const a = render(<Component size={16} label="x" className="c" />).container.innerHTML;
    const b = draw(<Icon name={icon(`core:${name}`)} size={16} label="x" className="c" />).container.innerHTML;
    expect(a).toBe(b);
    expect(coreIcons.icons[name]).toBeDefined();
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

  it('passes the tool glyphs through by identity, so each has one drawing', async () => {
    const ui = await import('./index');
    const core = await import('@weasel-js/core');
    for (const name of ['SliceIcon', 'MeasureIcon'] as const) {
      expect(ui[name], name).toBe(core[name]);
    }
  });
});
