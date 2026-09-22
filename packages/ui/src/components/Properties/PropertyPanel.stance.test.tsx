import { render } from '@testing-library/react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { describe, expect, it } from 'vitest';
import { EffectCard, Subpanel } from './EffectCard';
import { PropertyGroup } from './PropertyGroup';
import { PropertyPanel } from './PropertyPanel';

const panelOf = (el: HTMLElement) => el.firstElementChild as HTMLElement;

describe('PropertyPanel stance and tone', () => {
  it('renders no stance attributes and no inline tone when given neither', () => {
    const { container } = render(<PropertyPanel title="T">x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.hasAttribute('data-tone')).toBe(false);
    expect(panel.hasAttribute('data-nested')).toBe(false);
    expect(panel.getAttribute('style')).toBeNull();
  });

  it('names its stance and resolves a tone index to the theme ramp’s custom property', () => {
    const { container } = render(
      <PropertyPanel stance="scope" tone={1}>
        x
      </PropertyPanel>,
    );
    const panel = panelOf(container);
    expect(panel.dataset.stance).toBe('scope');
    expect(panel.dataset.tone).toBe('1');
    expect(panel.style.getPropertyValue('--wzl-tone')).toBe('var(--wzl-swatch-green)');
  });

  it('takes a color given directly, with no stance', () => {
    const { container } = render(<PropertyPanel tone="#224a63">x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.style.getPropertyValue('--wzl-tone')).toBe('#224a63');
  });

  it('reads tones from the nearest provider', () => {
    const { container } = render(
      <ThemeProvider tones={['#101010', '#202020']}>
        <PropertyPanel tone={3}>x</PropertyPanel>
      </ThemeProvider>,
    );
    const panel = panelOf(container.firstElementChild as HTMLElement);
    expect(panel.style.getPropertyValue('--wzl-tone')).toBe('#202020');
  });

  it('marks a panel inside another as nested, and only that one', () => {
    const { container } = render(
      <PropertyPanel stance="scope">
        <PropertyPanel stance="scope">inner</PropertyPanel>
      </PropertyPanel>,
    );
    const outer = panelOf(container);
    const inner = outer.querySelector('[data-stance]') as HTMLElement;
    expect(outer.hasAttribute('data-nested')).toBe(false);
    expect(inner.hasAttribute('data-nested')).toBe(true);
  });
});

describe('the rest of the family takes stance and tone', () => {
  it('a group and a subpanel render both', () => {
    const { container } = render(
      <>
        <PropertyGroup title="G" stance="danger" tone={2}>
          x
        </PropertyGroup>
        <Subpanel title="S" stance="debug">
          y
        </Subpanel>
      </>,
    );
    const [group, sub] = [...container.children] as HTMLElement[];
    expect(group.dataset).toMatchObject({ stance: 'danger', tone: '2' });
    expect(group.style.getPropertyValue('--wzl-tone')).toBe('var(--wzl-swatch-sky)');
    expect(sub.dataset.stance).toBe('debug');
  });

  it('an effect card takes a tone in place of its accent', () => {
    const { container } = render(<EffectCard title="Tail" tone="#abcdef" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.tone).toBe('#abcdef');
    expect(card.hasAttribute('data-stance')).toBe(false);
    expect(card.style.getPropertyValue('--wzl-tone')).toBe('#abcdef');
  });
});
