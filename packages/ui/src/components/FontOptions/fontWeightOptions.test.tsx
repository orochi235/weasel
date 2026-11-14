import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const listFontWeights = vi.fn();

vi.mock('@weasel-js/font', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/font')>()),
  listFontWeights: (family: string) => listFontWeights(family),
}));

const { fontWeightOptions, useFontWeightOptions } = await import('./fontOptions');
const { Select } = await import('../Select');

function labels(args?: Parameters<typeof fontWeightOptions>[0]): unknown[] {
  return fontWeightOptions(args).map((o) => o.label);
}

beforeEach(() => {
  listFontWeights.mockReset();
  listFontWeights.mockReturnValue([]);
});

describe('fontWeightOptions', () => {
  it("offers the family's registered weights", () => {
    listFontWeights.mockReturnValue([300, 400, 700]);
    expect(labels({ family: 'Inter', value: 400 })).toEqual(['300 Light', '400 Regular', '700 Bold']);
    expect(listFontWeights).toHaveBeenCalledWith('Inter');
  });

  it('keeps a value the family has no face for as its own entry', () => {
    listFontWeights.mockReturnValue([400, 700]);
    expect(labels({ family: 'Inter', value: 550 })).toEqual(['400 Regular', '550', '700 Bold']);
  });

  it('offers the CSS weights for a family with none on file, or no family', () => {
    expect(labels({ family: 'system-ui', value: 400 })).toHaveLength(9);
    expect(labels()).toHaveLength(9);
  });

  it('keys each option by the weight as a string', () => {
    listFontWeights.mockReturnValue([400, 600]);
    expect(fontWeightOptions({ family: 'Inter' }).map((o) => o.value)).toEqual(['400', '600']);
  });
});

describe('useFontWeightOptions', () => {
  function WeightSelect({ mixed, onChange }: { mixed?: boolean; onChange: (weight: number) => void }) {
    const value = mixed ? undefined : 400;
    const options = useFontWeightOptions({ family: 'Inter', value });
    return (
      <Select<string>
        aria-label="Weight"
        options={options}
        selectedKey={value === undefined ? null : String(value)}
        mixed={mixed}
        onSelectionChange={(key) => onChange(Number(key))}
      />
    );
  }

  it('feeds a Select that reports the picked weight', () => {
    listFontWeights.mockReturnValue([400, 600]);
    const onChange = vi.fn();
    render(<WeightSelect onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: '600 Semibold' }));
    expect(onChange).toHaveBeenCalledWith(600);
  });

  it('shows Mixed and no selection when the sources disagree', () => {
    listFontWeights.mockReturnValue([400, 700]);
    render(<WeightSelect mixed onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Mixed');
  });
});
