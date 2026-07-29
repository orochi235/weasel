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
const resolveFontVariant = vi.fn();

vi.mock('@weasel-js/font', () => ({
  listFonts: () => listFonts(),
  resolveFontVariant: (...args: unknown[]) => resolveFontVariant(...args),
}));

const { FontFamilySelect } = await import('./FontFamilySelect');

function openListbox(): void {
  fireEvent.click(screen.getByRole('button'));
}

beforeEach(() => {
  listFonts.mockReset();
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

  it('shows a Mixed placeholder with no selection', () => {
    listFonts.mockReturnValue([{ family: 'sans-serif', variants: [] }]);
    render(<FontFamilySelect mixed onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Mixed');
  });
});
