/**
 * The registry is stubbed rather than populated: `registerFont` needs a
 * `fetch` + `createImageBitmap` pair to bake an atlas, and none of that
 * exercises what the builder decides. What it decides is what to do with
 * the registry's *report* — which families to offer, and what to say about a
 * value the registry can't back.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

const listFonts = vi.fn();
const listCanvasFonts = vi.fn();
const resolveFontVariant = vi.fn();
const faces = { generation: 0, listeners: new Set<() => void>() };

vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  listFonts: () => listFonts(),
  listCanvasFonts: () => listCanvasFonts(),
  resolveFontVariant: (...args: unknown[]) => resolveFontVariant(...args),
  faceGeneration: () => faces.generation,
  subscribeGlyphReady: (cb: () => void) => {
    faces.listeners.add(cb);
    return () => faces.listeners.delete(cb);
  },
}));

const { fontFamilyOptions, useFontFamilyOptions } = await import('./fontOptions');
const { Select } = await import('../Select');

function labels(args?: Parameters<typeof fontFamilyOptions>[0]): unknown[] {
  return fontFamilyOptions(args).map((o) => o.label);
}

beforeEach(() => {
  listFonts.mockReset();
  listCanvasFonts.mockReset();
  listCanvasFonts.mockReturnValue([]);
  resolveFontVariant.mockReset();
  resolveFontVariant.mockReturnValue({ substituted: undefined });
});

describe('fontFamilyOptions', () => {
  it('offers every registered family', () => {
    listFonts.mockReturnValue([
      { family: 'sans-serif', variants: [{ weight: 400, style: 'normal' }] },
      { family: 'serif', variants: [{ weight: 400, style: 'normal' }] },
    ]);
    expect(fontFamilyOptions({ value: 'serif' })).toEqual([
      { value: 'sans-serif', label: 'sans-serif' },
      { value: 'serif', label: 'serif' },
    ]);
  });

  it('keeps an unregistered value and names what is actually rendering', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    resolveFontVariant.mockReturnValue({
      substituted: { requested: 'Inter', resolved: 'sans-serif' },
    });
    expect(fontFamilyOptions({ value: 'Inter' })).toContainEqual({
      value: 'Inter',
      label: 'Inter — not loaded, showing sans-serif',
    });
  });

  it('says only what it knows when nothing was substituted', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    expect(labels({ value: 'Inter' })).toEqual(['sans-serif', 'Inter — not loaded']);
  });

  it('probes the substitution at the variant the text actually renders at', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    fontFamilyOptions({ value: 'Inter', weight: 700, fontStyle: 'italic' });
    expect(resolveFontVariant).toHaveBeenCalledWith('Inter', 700, 'italic');
  });

  it('offers canvas-served families alongside baked ones', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    listCanvasFonts.mockReturnValue([
      { family: 'Georgia', enrollment: 'explicit' },
      { family: 'Impact', enrollment: 'explicit' },
    ]);
    expect(labels({ value: 'Georgia' })).toEqual(['sans-serif', 'Georgia', 'Impact']);
  });

  it('does not mark a canvas-served family as unloaded', () => {
    // Regression guard: before both tiers were listed, selecting one of these
    // fell through to the unregistered-value path and the menu claimed a
    // family that renders fine was "not loaded".
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    listCanvasFonts.mockReturnValue([{ family: 'Georgia', enrollment: 'explicit' }]);
    expect(labels({ value: 'Georgia' })).toEqual(['sans-serif', 'Georgia']);
  });

  it('lists a family once when both tiers report it', () => {
    listFonts.mockReturnValue([{ family: 'Georgia', variants: [] }]);
    listCanvasFonts.mockReturnValue([{ family: 'Georgia', enrollment: 'auto' }]);
    expect(labels({ value: 'Georgia' })).toEqual(['Georgia']);
  });
});

describe('useFontFamilyOptions', () => {
  function FamilySelect({ value, onChange }: { value?: string; onChange: (family: string) => void }) {
    const options = useFontFamilyOptions({ value });
    return <Select<string> aria-label="Font" options={options} selectedKey={value ?? null} onSelectionChange={onChange} />;
  }

  it('feeds a Select that reports the picked family', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    const onChange = vi.fn();
    render(<FamilySelect onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'sans-serif' }));
    expect(onChange).toHaveBeenCalledWith('sans-serif');
  });

  it('offers a family registered after it rendered', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    render(<FamilySelect value="Inter" onChange={vi.fn()} />);
    listFonts.mockReturnValue([
      { family: 'sans-serif', variants: [] },
      { family: 'Inter', variants: [] },
    ]);
    act(() => {
      faces.generation++;
      for (const cb of faces.listeners) cb();
    });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'Inter' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /not loaded/ })).not.toBeInTheDocument();
  });
});
