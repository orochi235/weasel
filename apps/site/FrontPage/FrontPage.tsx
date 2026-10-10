import { useState } from 'react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { ToggleBar } from '@weasel-js/ui';
import { DEMOS_ID, GET_STARTED_ID, RELEASES_ID } from '../routes';
import { PALETTES, storePalette, storedPalette } from './palettes';
import { Wordmark } from './Wordmark';
import s from './FrontPage.module.css';

const PALETTE_ITEMS = PALETTES.map((p) => ({ value: p.id, label: p.label }));

const LINKS = [
  { href: `#${GET_STARTED_ID}`, title: 'Get started', note: 'Install, first scene' },
  { href: './api/', title: 'API docs', note: 'Every package' },
  { href: `#${DEMOS_ID}`, title: 'Demos', note: 'Live, with source' },
  { href: './docs/ui/forge/', title: 'Components', note: 'The UI workshop' },
  { href: './draw/', title: 'WeaselDraw', note: 'The app built on it' },
  { href: `#${RELEASES_ID}`, title: 'Releases', note: 'Every version' },
];

/** The site's root: a pitch and a door to each section, with nothing else on screen. */
export function FrontPage() {
  const [palette, setPalette] = useState(storedPalette);

  return (
    <ThemeProvider theme={palette.theme} selection={palette.selection} className={s.page}>
      <main className={s.pitch}>
        <h1 className={s.title}>
          <Wordmark />
        </h1>
        <p className={s.tagline}>A 2D scene-graph canvas engine for React.</p>
        <code className={s.install}>npm i @weasel-js/core</code>
        <nav className={s.links} aria-label="Sections">
          {LINKS.map((link) => (
            <a key={link.title} href={link.href} className={s.link}>
              <span className={s.linkTitle}>{link.title}</span>
              <span className={s.linkNote}>{link.note}</span>
            </a>
          ))}
        </nav>
      </main>
      <ToggleBar
        className={s.palette}
        ariaLabel="Color theme"
        size="sm"
        items={PALETTE_ITEMS}
        value={palette.id}
        onChange={(id) => {
          const next = PALETTES.find((p) => p.id === id);
          if (!next) return;
          storePalette(next);
          setPalette(next);
        }}
      />
    </ThemeProvider>
  );
}
