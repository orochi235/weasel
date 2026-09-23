import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailList, DetailRow } from './DetailList';

const css = readFileSync(resolve(__dirname, 'DetailList.module.css'), 'utf8');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`))?.[2] ?? '';
};

describe('DetailList', () => {
  it('renders a <dl> whose rows pair one <dt> with one <dd>', () => {
    const { container } = render(
      <DetailList>
        <DetailRow label="kind">shape</DetailRow>
        <DetailRow label="source">core</DetailRow>
      </DetailList>,
    );
    const dl = container.querySelector('dl')!;
    const rows = [...dl.children];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.tagName).toBe('DIV');
      expect([...row.children].map((c) => c.tagName)).toEqual(['DT', 'DD']);
    }
    expect(rows[0].querySelector('dt')!.textContent).toBe('kind');
    expect(rows[0].querySelector('dd')!.textContent).toBe('shape');
  });

  it('takes elements for both label and value', () => {
    render(
      <DetailList>
        <DetailRow label={<>vs <b>minimal</b></>}>
          <code>+lasso</code>
          <code>−marquee</code>
        </DetailRow>
      </DetailList>,
    );
    expect(screen.getByText('minimal').closest('dt')).not.toBeNull();
    expect(screen.getByText('−marquee').closest('dd')).not.toBeNull();
  });

  it('names the list by its title, as a heading above it', () => {
    render(
      <DetailList title="Diff vs other bundles">
        <DetailRow label="a">b</DetailRow>
      </DetailList>,
    );
    const heading = screen.getByRole('heading', { name: 'Diff vs other bundles' });
    const dl = heading.parentElement!.querySelector('dl')!;
    expect(dl.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('renders no heading without a title', () => {
    const { container } = render(<DetailList><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.firstElementChild!.tagName).toBe('DL');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('reports its layout, inline by default', () => {
    const { container, rerender } = render(<DetailList><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.querySelector('dl')!.getAttribute('data-layout')).toBe('inline');
    rerender(<DetailList layout="block"><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.querySelector('dl')!.getAttribute('data-layout')).toBe('block');
  });

  it('merges consumer classNames on the list and on a row', () => {
    const { container } = render(
      <DetailList className="mine"><DetailRow label="a" className="row-mine">b</DetailRow></DetailList>,
    );
    expect(container.querySelector('dl')!.className).toMatch(/\bmine\b/);
    expect(container.querySelector('dl > div')!.className).toMatch(/\brow-mine\b/);
  });

  it('puts a consumer className on the outermost element, the section when titled', () => {
    const { container } = render(<DetailList title="T" className="mine"><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.firstElementChild!.tagName).toBe('SECTION');
    expect(container.firstElementChild!.className).toBe('mine');
    expect(container.querySelector('dl')!.className).not.toMatch(/\bmine\b/);
  });
});

describe('DetailList styles', () => {
  it('sizes the label rail from the params label width, so it lines up with property rows', () => {
    expect(rule('.list')).toMatch(/grid-template-columns:\s*var\(--wzl-params-label-width,\s*auto\)\s+minmax\(0,\s*1fr\)/);
  });

  it('lets every row share the list tracks', () => {
    expect(rule('.row')).toMatch(/grid-template-columns:\s*subgrid/);
    expect(rule('.row')).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });

  it('stacks label over value in the block layout', () => {
    expect(css).toMatch(/\.list\[data-layout='block'\]\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('inherits the params label recipe', () => {
    const body = rule('.label');
    expect(body).toMatch(/text-transform:\s*var\(--wzl-params-label-case,\s*uppercase\)/);
    expect(body).toMatch(/letter-spacing:\s*var\(--wzl-params-label-tracking,\s*var\(--wzl-tracking-wide\)\)/);
    expect(body).toMatch(/justify-content:\s*var\(--wzl-params-label-align,\s*start\)/);
  });

  it('wraps a long value inside its column instead of widening the list', () => {
    const body = rule('.value');
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).toMatch(/flex-wrap:\s*wrap/);
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
