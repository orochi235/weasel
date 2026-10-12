import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';
import { PropertyPanel } from './Properties';
import p from './Properties/Properties.module.css';

// Whether a hook reaches the property it is for is a cascade question: jsdom
// resolves no `var()`, so only a real browser can say what a face ends up with.

afterEach(cleanup);

const RED = 'inset 1px 1px 0 rgb(255, 0, 0)';
const BLUE = 'inset 2px 2px 0 rgb(0, 0, 255)';
/** How Chromium serializes the two above. */
const RED_SHADOW = 'rgb(255, 0, 0) 1px 1px 0px 0px inset';
const BLUE_SHADOW = 'rgb(0, 0, 255) 2px 2px 0px 0px inset';

function Scope({ vars, children }: { vars?: Record<string, string>; children: ReactNode }) {
  return <div style={vars as CSSProperties}>{children}</div>;
}

const css = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo);
const panel = () => screen.getByText('x').closest(`.${p.panel}`)!;

describe('with no hook set', () => {
  test('a button keeps its glass face, a field its plain frame, and a panel no shadow', () => {
    render(
      <Scope>
        <Button>Go</Button>
        <Input aria-label="Name" />
        <PropertyPanel title="Panel">x</PropertyPanel>
      </Scope>,
    );
    const button = css(screen.getByRole('button', { name: 'Go' }));
    expect(button.backgroundImage).toMatch(/^linear-gradient/);
    expect(button.boxShadow.split('rgb').length - 1).toBe(5);
    expect(css(screen.getByRole('button', { name: 'Go' }), '::before').opacity).toBe('1');
    const frame = css(screen.getByRole('textbox', { name: 'Name' }).parentElement!);
    expect(frame.boxShadow).toBe('none');
    expect(frame.borderTopWidth).toBe('1px');
    expect(css(panel()).boxShadow).toBe('none');
  });
});

describe('--wzl-bevel-raised', () => {
  test('is the shadow of a secondary and a primary button, and of a panel', () => {
    render(
      <Scope vars={{ '--wzl-bevel-raised': RED }}>
        <Button>Plain</Button>
        <Button variant="primary">Main</Button>
        <PropertyPanel title="Panel">x</PropertyPanel>
      </Scope>,
    );
    expect(css(screen.getByRole('button', { name: 'Plain' })).boxShadow).toBe(RED_SHADOW);
    expect(css(screen.getByRole('button', { name: 'Main' })).boxShadow).toBe(RED_SHADOW);
    expect(css(panel()).boxShadow).toBe(RED_SHADOW);
  });

  test('gives way to --wzl-button-primary-bevel on a primary button only', () => {
    render(
      <Scope vars={{ '--wzl-bevel-raised': RED, '--wzl-button-primary-bevel': BLUE }}>
        <Button>Plain</Button>
        <Button variant="primary">Main</Button>
      </Scope>,
    );
    expect(css(screen.getByRole('button', { name: 'Plain' })).boxShadow).toBe(RED_SHADOW);
    expect(css(screen.getByRole('button', { name: 'Main' })).boxShadow).toBe(BLUE_SHADOW);
  });
});

test('--wzl-bevel-pressed is the shadow of a button that stays down', () => {
  render(
    <Scope vars={{ '--wzl-bevel-raised': RED, '--wzl-bevel-pressed': BLUE }}>
      <Button pressed>Held</Button>
    </Scope>,
  );
  expect(css(screen.getByRole('button', { name: 'Held' })).boxShadow).toBe(BLUE_SHADOW);
});

describe('the button face hooks', () => {
  const FACE = {
    '--wzl-button-surface': 'rgb(1, 2, 3)',
    '--wzl-button-primary-surface': 'rgb(4, 5, 6)',
    '--wzl-button-primary-fg': 'rgb(7, 8, 9)',
    '--wzl-button-radius': '0px',
    '--wzl-button-gloss': '0',
    '--wzl-button-text-shadow': 'none',
  };

  test('replace the glass of a secondary button with a flat face', () => {
    render(
      <Scope vars={FACE}>
        <Button>Plain</Button>
      </Scope>,
    );
    const el = screen.getByRole('button', { name: 'Plain' });
    expect(css(el).backgroundColor).toBe('rgb(1, 2, 3)');
    expect(css(el).backgroundImage).toBe('none');
    expect(css(el).borderRadius).toBe('0px');
    expect(css(el).textShadow).toBe('none');
    expect(css(el, '::before').opacity).toBe('0');
  });

  test('and of a primary one, with its own text color', () => {
    render(
      <Scope vars={FACE}>
        <Button variant="primary">Main</Button>
      </Scope>,
    );
    const el = screen.getByRole('button', { name: 'Main' });
    expect(css(el).backgroundColor).toBe('rgb(4, 5, 6)');
    expect(css(el).backgroundImage).toBe('none');
    expect(css(el).color).toBe('rgb(7, 8, 9)');
    expect(css(el).textShadow).toBe('none');
  });
});

describe('a field frame', () => {
  const frameOf = (name: string) => screen.getByRole('textbox', { name }).parentElement!;

  test('takes --wzl-bevel-sunken as its shadow and --wzl-field-border as its border', () => {
    render(
      <Scope vars={{ '--wzl-bevel-sunken': RED, '--wzl-field-border': '0 solid transparent' }}>
        <Input aria-label="Name" />
      </Scope>,
    );
    expect(css(frameOf('Name')).boxShadow).toBe(RED_SHADOW);
    expect(css(frameOf('Name')).borderTopWidth).toBe('0px');
  });

  test('takes --wzl-field-focus-shadow while it holds focus', async () => {
    render(
      <Scope vars={{ '--wzl-bevel-sunken': RED, '--wzl-field-focus-shadow': BLUE }}>
        <Input aria-label="Name" />
      </Scope>,
    );
    screen.getByRole('textbox', { name: 'Name' }).focus();
    // The frame eases its shadow in, so the first read is mid-way.
    await expect.poll(() => css(frameOf('Name')).boxShadow).toBe(BLUE_SHADOW);
  });
});
