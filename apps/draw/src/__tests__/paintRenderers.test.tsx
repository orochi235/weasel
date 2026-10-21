import { useEffect, useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ActionsProvider, createDispatcher, useActionsRegistry, type Action } from '@weasel-js/core';
import type { PropertyRenderContext } from '@weasel-js/ui/components/SelectionPanel';
import { WD_RENDERERS } from '../paintRenderers';
import { renderWithIcons } from '../testIcons';

/** The schema's own `data.stroke.paint` leaf: a `paint` leaf, so its default
 *  is a whole `Paint` and not a color string. */
const STROKE_PAINT_LEAF = {
  kind: 'paint',
  name: 'Color',
  default: { kind: 'solid', color: '#000000ff' },
  alpha: true,
} as unknown as PropertyRenderContext['pref'];

function ctxWith(value: unknown, selectionKey = ''): PropertyRenderContext {
  return {
    selectionKey,
    path: 'data.stroke.paint',
    pref: STROKE_PAINT_LEAF,
    value,
    mixed: false,
    unset: value === undefined,
    setValue: () => {},
    valueAt: () => ({ value: undefined, mixed: false, unset: true }),
  } as unknown as PropertyRenderContext;
}

const GRADIENT = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
  units: 'bounds',
  stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1, color: '#0000ffff' }],
};

function colorInputValue(value: unknown): string | undefined {
  const { container } = renderWithIcons(
    <ActionsProvider>{WD_RENDERERS['data.stroke.paint'](ctxWith(value))}</ActionsProvider>,
  );
  return container.querySelector<HTMLInputElement>('input[type="color"]')?.value;
}

describe("WeaselDraw's data.stroke.paint renderer", () => {
  it('shows the color of a solid stroke', () => {
    expect(colorInputValue({ kind: 'solid', color: '#123456ff' })).toBe('#123456');
  });

  it('shows None, not a default color, for no stroke', () => {
    renderWithIcons(<ActionsProvider>{WD_RENDERERS['data.stroke.paint'](ctxWith(undefined))}</ActionsProvider>);
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked();
  });

  it('edits a gradient stroke as a gradient', () => {
    renderWithIcons(
      <ActionsProvider>{WD_RENDERERS['data.stroke.paint'](ctxWith(GRADIENT))}</ActionsProvider>,
    );
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
    expect(screen.getByLabelText('Stop 1')).toBeInTheDocument();
  });
});

describe("WeaselDraw's paint renderers across selections", () => {
  /** Registers a `setFill` that records each paint it is started with. */
  function Recording({ seen, children }: { seen: unknown[]; children: ReactNode }) {
    const registry = useActionsRegistry();
    const [ready, setReady] = useState(false);
    useEffect(() => {
      if (!registry) return;
      registry.register({
        id: 'setFill',
        label: 'setFill',
        invoker: {
          timing: 'ongoing',
          start: (ctx) => {
            seen.push(ctx.params?.paint);
            return { onMove: () => {}, onEnd: () => {} };
          },
        },
      } as Action);
      registry.setDispatcher(createDispatcher({
        getAction: (id: string) => registry.list().find((a) => a.id === id),
      }));
      setReady(true);
    }, [registry, seen]);
    return ready ? <>{children}</> : null;
  }

  it('do not offer a new selection the last one\'s gradient', () => {
    const seen: unknown[] = [];
    const at = (value: unknown, key: string) => (
      <ActionsProvider>
        <Recording seen={seen}>{WD_RENDERERS['data.fill.paint'](ctxWith(value, key))}</Recording>
      </ActionsProvider>
    );
    const { rerender } = renderWithIcons(at(GRADIENT, 'a'));
    rerender(at({ kind: 'solid', color: '#123456ff' }, 'b'));
    fireEvent.click(screen.getByRole('radio', { name: 'Linear' }));

    const paint = seen.at(-1) as typeof GRADIENT;
    expect(paint.kind).toBe('linear-gradient');
    expect(paint.stops[0].color).toBe('#123456ff');
  });
});
