/**
 * The registry is stubbed rather than populated: `registerFont` needs a
 * `fetch` + `createImageBitmap` pair to bake an atlas, and none of that
 * exercises what this component decides. What it decides is what to do with
 * the registry's *report* — which families to offer, and what to say about a
 * value the registry can't back.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const listFonts = vi.fn();
const listCanvasFonts = vi.fn();
const resolveFontVariant = vi.fn();

vi.mock('@weasel-js/font', () => ({
  listFonts: () => listFonts(),
  listCanvasFonts: () => listCanvasFonts(),
  resolveFontVariant: (...args: unknown[]) => resolveFontVariant(...args),
}));

const { FontFamilySelect } = await import('./FontFamilySelect');

function openListbox(): void {
  fireEvent.click(screen.getByRole('button'));
}

beforeEach(() => {
  listFonts.mockReset();
  listCanvasFonts.mockReset();
  listCanvasFonts.mockReturnValue([]);
  resolveFontVariant.mockReset();
  resolveFontVariant.mockReturnValue({ substituted: undefined });
});

describe('FontFamilySelect', () => {
  it('offers every registered family', () => {
    listFonts.mockReturnValue([
      { family: 'sans-serif', variants: [{ weight: 400, style: 'normal' }] },
      { family: 'serif', variants: [{ weight: 400, style: 'normal' }] },
    ]);
    render(<FontFamilySelect value="serif" onChange={vi.fn()} />);
    openListbox();
    expect(screen.getByRole('option', { name: 'sans-serif' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'serif' })).toBeInTheDocument();
  });

  it('reports the selected family', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    const onChange = vi.fn();
    render(<FontFamilySelect value={undefined} onChange={onChange} />);
    openListbox();
    fireEvent.click(screen.getByRole('option', { name: 'sans-serif' }));
    expect(onChange).toHaveBeenCalledWith('sans-serif');
  });

  it('keeps an unregistered value and names what is actually rendering', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    resolveFontVariant.mockReturnValue({
      substituted: { requested: 'Inter', resolved: 'sans-serif' },
    });
    render(<FontFamilySelect value="Inter" onChange={vi.fn()} />);
    openListbox();
    expect(
      screen.getByRole('option', { name: 'Inter — not loaded, showing sans-serif' }),
    ).toBeInTheDocument();
  });

  it('says only what it knows when nothing was substituted', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    render(<FontFamilySelect value="Inter" onChange={vi.fn()} />);
    openListbox();
    expect(screen.getByRole('option', { name: 'Inter — not loaded' })).toBeInTheDocument();
  });

  it('probes the substitution at the variant the text actually renders at', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    render(
      <FontFamilySelect value="Inter" weight={700} fontStyle="italic" onChange={vi.fn()} />,
    );
    expect(resolveFontVariant).toHaveBeenCalledWith('Inter', 700, 'italic');
  });

  it('offers canvas-served families alongside baked ones', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    listCanvasFonts.mockReturnValue([
      { family: 'Georgia', enrollment: 'explicit' },
      { family: 'Impact', enrollment: 'explicit' },
    ]);
    render(<FontFamilySelect value="Georgia" onChange={vi.fn()} />);
    openListbox();
    expect(screen.getByRole('option', { name: 'sans-serif' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Georgia' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Impact' })).toBeInTheDocument();
  });

  it('does not mark a canvas-served family as unloaded', () => {
    // Regression guard: before both tiers were listed, selecting one of these
    // fell through to the unregistered-value path and the menu claimed a
    // family that renders fine was "not loaded".
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    listCanvasFonts.mockReturnValue([{ family: 'Georgia', enrollment: 'explicit' }]);
    render(<FontFamilySelect value="Georgia" onChange={vi.fn()} />);
    openListbox();
    expect(screen.queryByRole('option', { name: /not loaded/ })).not.toBeInTheDocument();
  });

  it('lists a family once when both tiers report it', () => {
    listFonts.mockReturnValue([{ family: 'Georgia', variants: [] }]);
    listCanvasFonts.mockReturnValue([{ family: 'Georgia', enrollment: 'auto' }]);
    render(<FontFamilySelect value="Georgia" onChange={vi.fn()} />);
    openListbox();
    expect(screen.getAllByRole('option', { name: 'Georgia' })).toHaveLength(1);
  });

  it('shows a Mixed placeholder with no selection', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    render(<FontFamilySelect mixed onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Mixed');
  });
});
