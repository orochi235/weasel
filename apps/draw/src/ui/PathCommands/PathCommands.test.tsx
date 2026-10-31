import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const edits = vi.hoisted(() => new Map<string, { input: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }>());

vi.mock('@weasel-js/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/core')>()),
  useOngoingAction: (id: string) => {
    if (!edits.has(id)) edits.set(id, { input: vi.fn(), commit: vi.fn(), cancel: vi.fn() });
    return edits.get(id)!;
  },
}));

import { useState } from 'react';
import { drawPrefs } from '../../prefs';
import { drawToolOptionValues } from '../../toolOptions';
import { OffsetSlider, SimplifySlider, useSimplifyTolerance } from './PathCommands';

function Simplify() {
  const [tolerance, setTolerance] = useState(1);
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

function TunedSimplify() {
  const [tolerance, setTolerance] = useSimplifyTolerance();
  return <SimplifySlider tolerance={tolerance} onTolerance={setTolerance} />;
}

afterEach(() => {
  cleanup();
  edits.clear();
  drawPrefs().reset('tools.simplifyBrush');
});

describe('the path command sliders', () => {
  it('drives Simplify from its slider: a step previews and commits the tolerance', () => {
    render(<Simplify />);
    const slider = screen.getByRole('slider', { name: 'Simplify tolerance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
    });
    const simplify = edits.get('simplifyPath')!;
    expect(simplify.input).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
    expect(simplify.commit).toHaveBeenCalledWith({ tolerance: expect.closeTo(1.1, 5) });
  });

  it('drives Offset Path from its slider, by distance', () => {
    render(<OffsetSlider />);
    const slider = screen.getByRole('slider', { name: 'Offset distance' });
    act(() => {
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    });
    expect(edits.get('offsetPath')!.commit).toHaveBeenCalledWith({ distance: -0.5 });
  });

  it("keeps the tolerance as the Simplify brush's tolerance option", () => {
    render(<TunedSimplify />);
    act(() => {
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Simplify tolerance' }), { key: 'ArrowRight' });
    });
    expect(drawToolOptionValues().get('simplifyBrush').tolerance).toBeCloseTo(1.1, 5);
  });
});
