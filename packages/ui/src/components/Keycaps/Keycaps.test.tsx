import { render } from '@testing-library/react';
import { KeyCap } from './Keycap';
import { KeySequence } from './Keycaps';
import { keySpecFromKey, keySpecsFromMods, type Platform } from './keySpecsFromMods';

describe('KeyCap', () => {
  it('renders the label as a <kbd>', () => {
    const { container } = render(<KeyCap label="K" />);
    const kbd = container.querySelector('kbd');
    expect(kbd?.textContent).toBe('K');
  });

  it('tags modifier glyphs with data-kind="modifier"', () => {
    const { container } = render(<KeyCap label="⌘" />);
    expect(container.querySelector('kbd')?.getAttribute('data-kind')).toBe('modifier');
  });

  it('tags wide glyphs (tab/enter/space) with data-kind="wide"', () => {
    const { container } = render(<KeyCap label="␣" />);
    expect(container.querySelector('kbd')?.getAttribute('data-kind')).toBe('wide');
  });

  it('tags ordinary glyphs with data-kind="square"', () => {
    const { container } = render(<KeyCap label="K" />);
    expect(container.querySelector('kbd')?.getAttribute('data-kind')).toBe('square');
  });

  it('applies data-inverted when inverted prop is true', () => {
    const { container } = render(<KeyCap label="K" inverted />);
    expect(container.querySelector('kbd')?.hasAttribute('data-inverted')).toBe(true);
  });

  it('omits data-inverted by default', () => {
    const { container } = render(<KeyCap label="K" />);
    expect(container.querySelector('kbd')?.hasAttribute('data-inverted')).toBe(false);
  });

  it('omits data-variant for the default variant', () => {
    const { container } = render(<KeyCap label="K" />);
    expect(container.querySelector('kbd')?.hasAttribute('data-variant')).toBe(false);
  });

  it('tags data-variant="minimal" when variant="minimal"', () => {
    const { container } = render(<KeyCap label="K" variant="minimal" />);
    expect(container.querySelector('kbd')?.getAttribute('data-variant')).toBe('minimal');
  });

  it('omits inline font-family by default (inherits CSS-var token)', () => {
    const { container } = render(<KeyCap label="K" />);
    const kbd = container.querySelector('kbd') as HTMLElement;
    expect(kbd.style.fontFamily).toBe('');
  });

  it('applies font as inline font-family when the prop is set', () => {
    const { container } = render(<KeyCap label="K" font="Roboto Mono" />);
    const kbd = container.querySelector('kbd') as HTMLElement;
    expect(kbd.style.fontFamily).toMatch(/Roboto Mono/);
  });

  it('still surfaces data-inverted under variant="minimal" (rendered as dotted border)', () => {
    const { container } = render(<KeyCap label="K" variant="minimal" inverted />);
    const kbd = container.querySelector('kbd');
    expect(kbd?.hasAttribute('data-inverted')).toBe(true);
    expect(kbd?.getAttribute('data-variant')).toBe('minimal');
  });
});

describe('KeySequence', () => {
  function chips(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll('kbd'));
  }

  it('renders an em-dash when keys is undefined', () => {
    const { container } = render(<KeySequence keys={undefined} />);
    expect(container.textContent).toBe('—');
    expect(chips(container)).toHaveLength(0);
  });

  it('renders an em-dash when keys is empty', () => {
    const { container } = render(<KeySequence keys={[]} />);
    expect(container.textContent).toBe('—');
  });

  it('renders one KeyCap per entry, in order, when all are non-modifiers', () => {
    const { container } = render(<KeySequence keys={[{ label: 'A' }, { label: 'B' }]} />);
    expect(chips(container).map((c) => c.textContent)).toEqual(['A', 'B']);
  });

  it('inverts only entries marked optional', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘', optional: true }, { label: 'K' }]} />,
    );
    const cs = chips(container);
    expect(cs[0]?.hasAttribute('data-inverted')).toBe(true);
    expect(cs[1]?.hasAttribute('data-inverted')).toBe(false);
  });

  it('always renders modifiers first even when given out of order', () => {
    const { container } = render(
      <KeySequence keys={[{ label: 'K' }, { label: '⌘' }, { label: '⇧' }]} joins="none" />,
    );
    expect(chips(container).map((c) => c.textContent)).toEqual(['⌘', '⇧', 'K']);
  });

  it('preserves relative order within modifiers and within non-modifiers', () => {
    const { container } = render(
      <KeySequence
        keys={[{ label: 'B' }, { label: '⌥' }, { label: 'A' }, { label: '⌘' }]}
        joins="none"
      />,
    );
    expect(chips(container).map((c) => c.textContent)).toEqual(['⌥', '⌘', 'B', 'A']);
  });

  it('defaults the separator to "+"', () => {
    const { container } = render(<KeySequence keys={[{ label: '⌘' }, { label: 'K' }]} />);
    expect(container.textContent).toBe('⌘+K');
  });

  it('honors a custom separator string', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘' }, { label: 'K' }]} separator=" then " />,
    );
    expect(container.textContent).toBe('⌘ then K');
  });

  it('suppresses the separator with joins="none"', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘' }, { label: 'K' }]} joins="none" />,
    );
    expect(container.textContent).toBe('⌘K');
    expect(container.querySelector('kbd + span, span + kbd')).toBeNull();
  });

  it('joins="key" (the default) separates the modifiers from the key', () => {
    const keys = [{ label: '⌘' }, { label: '⇧' }, { label: 'K' }];
    const a = render(<KeySequence keys={keys} />);
    expect(a.container.textContent).toBe('⌘⇧+K');
    a.unmount();
    const b = render(<KeySequence keys={keys} joins="key" />);
    expect(b.container.textContent).toBe('⌘⇧+K');
  });

  it('joins="key" puts a separator before every non-modifier', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘' }, { label: 'K' }, { label: 'L' }]} joins="key" />,
    );
    expect(container.textContent).toBe('⌘+K+L');
  });

  it('joins="key" joins a sequence of plain keys but not one of modifiers', () => {
    const plain = render(<KeySequence keys={[{ label: 'A' }, { label: 'B' }]} joins="key" />);
    expect(plain.container.textContent).toBe('A+B');
    plain.unmount();
    const mods = render(<KeySequence keys={[{ label: '⌘' }, { label: '⇧' }]} joins="key" />);
    expect(mods.container.textContent).toBe('⌘⇧');
  });

  it('joins="all" separates every adjacent pair of chips', () => {
    const { container } = render(
      <KeySequence keys={[{ label: 'K' }, { label: '⌘' }, { label: '⇧' }]} joins="all" />,
    );
    expect(container.textContent).toBe('⌘+⇧+K');
    expect(container.querySelectorAll('kbd')).toHaveLength(3);
  });

  it('joins="all" separates modifier-only and key-only sequences too', () => {
    const mods = render(<KeySequence keys={[{ label: '⌘' }, { label: '⇧' }]} joins="all" />);
    expect(mods.container.textContent).toBe('⌘+⇧');
    mods.unmount();
    const plain = render(<KeySequence keys={[{ label: 'A' }, { label: 'B' }]} joins="all" separator=" then " />);
    expect(plain.container.textContent).toBe('A then B');
  });

  it('joins="all" renders no separator around a single chip', () => {
    const { container } = render(<KeySequence keys={[{ label: 'K' }]} joins="all" />);
    expect(container.textContent).toBe('K');
  });

  it('omits the separator when there are no non-modifiers', () => {
    const { container } = render(<KeySequence keys={[{ label: '⌘' }, { label: '⇧' }]} />);
    expect(container.textContent).toBe('⌘⇧');
  });

  it('places the separator at the modifier/non-modifier boundary even when input is unordered', () => {
    const { container } = render(
      <KeySequence keys={[{ label: 'K' }, { label: '⌘' }]} separator="+" />,
    );
    expect(container.textContent).toBe('⌘+K');
  });

  it.each<Platform>(['macos', 'windows', 'linux'])(
    'sorts and separates %s modifier labels, in every legend',
    (platform) => {
      for (const legend of ['auto', 'symbol', 'text'] as const) {
        const [alt, mod, meta] = keySpecsFromMods([{ name: 'alt' }, { name: 'mod' }, { name: 'meta' }], { platform, legend });
        const b = keySpecFromKey('b', { platform, legend });
        const { container, unmount } = render(<KeySequence keys={[{ label: 'A' }, alt, b, mod, meta]} separator="+" />);
        expect(container.textContent).toBe(`${alt.label}${mod.label}${meta.label}+A+B`);
        unmount();
      }
    },
  );

  it('forwards `font` to every KeyCap', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘' }, { label: 'K' }]} font="Courier" />,
    );
    for (const chip of chips(container)) {
      expect(chip.style.fontFamily).toMatch(/Courier/);
    }
  });

  it('forwards variant="minimal" to every KeyCap', () => {
    const { container } = render(
      <KeySequence keys={[{ label: '⌘' }, { label: 'K' }]} variant="minimal" />,
    );
    for (const chip of chips(container)) {
      expect(chip.getAttribute('data-variant')).toBe('minimal');
    }
  });
});
