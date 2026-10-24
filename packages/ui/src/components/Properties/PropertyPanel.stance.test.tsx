import { cssColorLiteral } from '@weasel-js/paint';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { describe, expect, it } from 'vitest';
import { Subpanel } from './Subpanel';
import { PropertyGroup } from './PropertyGroup';
import { PropertyPanel } from './PropertyPanel';

const panelOf = (el: HTMLElement) => el.firstElementChild as HTMLElement;

describe('PropertyPanel stance and tint', () => {
  it('renders no stance attributes and no inline tint when given neither', () => {
    const { container } = render(<PropertyPanel title="T">x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.hasAttribute('data-tint')).toBe(false);
    expect(panel.hasAttribute('data-nested')).toBe(false);
    expect(panel.getAttribute('style')).toBeNull();
  });

  it('names its stance and resolves a tint index to the theme ramp’s custom property', () => {
    const { container } = render(
      <PropertyPanel stance="clarify" tint={1}>
        x
      </PropertyPanel>,
    );
    const panel = panelOf(container);
    expect(panel.dataset.stance).toBe('clarify');
    expect(panel.dataset.tint).toBe('1');
    expect(panel.style.getPropertyValue('--wzl-tint')).toBe('var(--wzl-swatch-green)');
  });

  it('takes a color given directly, with no stance', () => {
    const { container } = render(<PropertyPanel tint={cssColorLiteral('#224a63')}>x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.style.getPropertyValue('--wzl-tint')).toBe('#224a63');
  });

  it('takes a color named in the theme, as its custom property', () => {
    const { container } = render(<PropertyPanel tint={{ ref: 'accent' }}>x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-tint')).toBe(true);
    expect(panel.style.getPropertyValue('--wzl-tint')).toBe('var(--wzl-accent)');
  });

  it('takes no tint from a name nothing answers', () => {
    const { container } = render(<PropertyPanel tint={{ ref: 'nope' }}>x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-tint')).toBe(false);
    expect(panel.style.getPropertyValue('--wzl-tint')).toBe('');
  });

  it('reads tints from the nearest provider', () => {
    const { container } = render(
      <ThemeProvider tints={['#101010', '#202020']}>
        <PropertyPanel tint={3}>x</PropertyPanel>
      </ThemeProvider>,
    );
    const panel = panelOf(container.firstElementChild as HTMLElement);
    expect(panel.style.getPropertyValue('--wzl-tint')).toBe('#202020');
  });

  it('marks a panel inside another as nested, and only that one', () => {
    const { container } = render(
      <PropertyPanel stance="clarify">
        <PropertyPanel stance="clarify">inner</PropertyPanel>
      </PropertyPanel>,
    );
    const outer = panelOf(container);
    const inner = outer.querySelector('[data-stance]') as HTMLElement;
    expect(outer.hasAttribute('data-nested')).toBe(false);
    expect(inner.hasAttribute('data-nested')).toBe(true);
  });
});

describe('the rest of the family takes stance, grade and tint', () => {
  it('a group and a subpanel render both', () => {
    const { container } = render(
      <>
        <PropertyGroup title="G" grade="danger" tint={2}>
          x
        </PropertyGroup>
        <Subpanel title="S" stance="debug">
          y
        </Subpanel>
      </>,
    );
    const [group, sub] = [...container.children] as HTMLElement[];
    expect(group.dataset).toMatchObject({ grade: 'danger', tint: '2' });
    expect(group.style.getPropertyValue('--wzl-tint')).toBe('var(--wzl-swatch-sky)');
    expect(sub.dataset.stance).toBe('debug');
  });

});
