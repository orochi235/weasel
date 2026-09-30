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

describe('DetailRow status and absence', () => {
  it('draws a decorative dot before the value for a status, and names the status on the row', () => {
    const { container } = render(
      <DetailList><DetailRow label="lock" status="success">locked</DetailRow></DetailList>,
    );
    const row = container.querySelector('dl > div')!;
    expect(row.getAttribute('data-status')).toBe('success');
    const dd = row.querySelector('dd')!;
    const dot = dd.firstElementChild!;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.textContent).toBe('');
    expect(dd.textContent).toBe('locked');
  });

  it('draws no dot without a status', () => {
    const { container } = render(<DetailList><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.querySelector('dl > div')!.hasAttribute('data-status')).toBe(false);
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('keeps a row with no value, showing a dash in its place', () => {
    const { container } = render(
      <DetailList>
        <DetailRow label="margin">{undefined}</DetailRow>
        <DetailRow label="score">{null}</DetailRow>
        <DetailRow label="zero">{0}</DetailRow>
      </DetailList>,
    );
    const dds = [...container.querySelectorAll('dd')];
    expect(dds.map((d) => d.textContent)).toEqual(['–', '–', '0']);
    expect(dds.map((d) => d.hasAttribute('data-empty'))).toEqual([true, true, false]);
  });

  it('takes a placeholder of its own for an absent value', () => {
    render(<DetailList><DetailRow label="a" placeholder="n/a" /></DetailList>);
    expect(screen.getByText('n/a').closest('dd')).not.toBeNull();
  });

  it("keeps an absent row's status dot, so the row does not shift when the value arrives", () => {
    const { container } = render(<DetailList><DetailRow label="a" status="danger" /></DetailList>);
    expect(container.querySelector('dd > [aria-hidden]')).not.toBeNull();
  });

  it('reports its value style, text by default', () => {
    const { container, rerender } = render(<DetailList><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.querySelector('dl')!.getAttribute('data-values')).toBe('text');
    rerender(<DetailList values="figures"><DetailRow label="a">b</DetailRow></DetailList>);
    expect(container.querySelector('dl')!.getAttribute('data-values')).toBe('figures');
  });
});

describe('DetailRow values', () => {
  it("marks a row that sets its value against the list's", () => {
    const { container } = render(
      <DetailList values="figures">
        <DetailRow label="a">1</DetailRow>
        <DetailRow label="b" values="text">a sentence</DetailRow>
      </DetailList>,
    );
    const [a, b] = [...container.querySelectorAll('dl > div')];
    expect(a.hasAttribute('data-values')).toBe(false);
    expect(b.getAttribute('data-values')).toBe('text');
  });

  // The proxy class names only prove the component asked for `figures`; the style test below proves the rule.
  it("sets a row's value as figures from its own values or its list's", () => {
    const { container } = render(
      <>
        <DetailList values="figures">
          <DetailRow label="a">1</DetailRow>
          <DetailRow label="b" values="text">a sentence</DetailRow>
        </DetailList>
        <DetailList>
          <DetailRow label="c" values="figures">2</DetailRow>
          <DetailRow label="d">prose</DetailRow>
        </DetailList>
      </>,
    );
    const figures = [...container.querySelectorAll('dd')].map((dd) => /_figures_/.test(dd.className));
    expect(figures).toEqual([true, false, true, false]);
  });
});

describe('DetailList styles', () => {
  it('sets figures right-aligned in a minimum-width column, in equal-width digits, spaces kept', () => {
    expect(css).toMatch(
      /\.list\[data-values='figures'\]\s*\{\s*grid-template-columns:\s*var\(--wzl-params-label-width,\s*auto\)\s+minmax\(min-content,\s*1fr\)/,
    );
    const body = rule('.figures');
    expect(body).toMatch(/composes:\s*numeric from '@weasel-js\/theme\/numeric\.module\.css'/);
    expect(body).toMatch(/justify-content:\s*flex-end/);
    expect(body).toMatch(/text-align:\s*end/);
    expect(body).toMatch(/min-width:\s*var\(--wzl-detail-figure-min-width,\s*8ch\)/);
    expect(body).toMatch(/white-space:\s*pre/);
  });

  it('paints each status dot from its semantic token', () => {
    expect(rule(".row[data-status='success'] .dot")).toMatch(/var\(--wzl-success\)/);
    expect(rule(".row[data-status='warn'] .dot")).toMatch(/var\(--wzl-warning\)/);
    expect(rule(".row[data-status='danger'] .dot")).toMatch(/var\(--wzl-danger\)/);
  });

  it('mutes the placeholder', () => {
    expect(rule('.value[data-empty]')).toMatch(/color:\s*var\(--wzl-fg-muted\)/);
  });

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
