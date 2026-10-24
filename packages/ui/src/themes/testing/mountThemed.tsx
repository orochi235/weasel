import '@weasel-js/theme/tokens.css';
import { applyTheme, type Selection, type Theme } from '@weasel-js/theme';
import { cleanup, render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { DefaultMotif } from '../../components/MotifFrame';
import { titlebar } from '../../components/MotifFrame/motifs';
import { PropertyGroup, PropertyPanel } from '../../components/Properties';
import p from '../../components/Properties/Properties.module.css';

/** Test support: one of everything a desktop theme restyles, under `theme` at `selection`. */
export function mountThemed(theme: Theme, selection: Selection) {
  const host = document.createElement('div');
  document.body.append(host);
  const release = applyTheme(host, theme, selection);
  render(
    <DefaultMotif group={titlebar()}>
      <PropertyPanel title="Panel">
        <Button>Plain</Button>
        <Button variant="primary">Main</Button>
        <Button pressed>Held</Button>
        <Input aria-label="Name" />
        <div style={{ color: 'var(--wzl-fg)' }}>
          <span data-testid="fg">text</span>
          <span data-testid="muted" style={{ color: 'var(--wzl-fg-muted)' }}>
            muted
          </span>
          <span data-testid="subtle" style={{ color: 'var(--wzl-fg-subtle)' }}>
            subtle
          </span>
        </div>
        <PropertyGroup title="Group">rows</PropertyGroup>
        <div style={{ '--wzl-bevel-raised': 'none' } as CSSProperties}>
          <Button>Quiet</Button>
        </div>
      </PropertyPanel>
    </DefaultMotif>,
    { container: host },
  );

  const button = (name: string) => screen.getByRole('button', { name });
  const group = screen.getByRole('group', { name: 'Group' });
  const title = document.getElementById(group.getAttribute('aria-labelledby')!)!;
  return {
    host,
    button,
    panel: host.querySelector(`.${p.panel}`)!,
    frame: screen.getByRole('textbox', { name: 'Name' }).parentElement!,
    group,
    title,
    strip: title.parentElement!.parentElement!,
    text: (step: 'fg' | 'muted' | 'subtle') => screen.getByTestId(step),
    unmount() {
      cleanup();
      release();
      host.remove();
    },
  };
}

/** A mounted {@link mountThemed} fixture. */
export type Themed = ReturnType<typeof mountThemed>;
