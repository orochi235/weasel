import { ThemeProvider } from '@weasel-js/theme/react';
import { PACKAGES_ID } from '../../shared/packageRoutes';
import { DEMOS_ID, GET_STARTED_ID, RELEASES_ID } from '../routes';
import { projectTheme } from './projectTheme';
import { TAGLINE } from './tagline';
import { VersionPill } from './VersionPill';
import { Wordmark } from './Wordmark';
import s from './FrontPage.module.css';

const DARK = { mode: 'dark' } as const;

const LINKS = [
  { href: `#${GET_STARTED_ID}`, title: 'Get started', note: 'Install, first scene' },
  { href: `#${PACKAGES_ID}`, title: 'Packages', note: 'Guides and API reference' },
  { href: `#${DEMOS_ID}`, title: 'Demos', note: 'Live, with source' },
  { href: './docs/ui/forge/', title: 'Components', note: 'The UI workshop' },
  { href: './draw/', title: 'WeaselDraw', note: 'The app built on it' },
  { href: './chart/', title: 'WeaselChart', note: 'A diagram editor built on it' },
  { href: `#${RELEASES_ID}`, title: 'Releases', note: 'Every version' },
];

/** The site's root: a pitch and a door to each section, with nothing else on screen. */
export function FrontPage() {
  return (
    <ThemeProvider theme={projectTheme} selection={DARK} className={s.page}>
      <main className={s.pitch}>
        <div className={s.masthead}>
          <h1 className={s.title}>
            <Wordmark />
          </h1>
          <VersionPill className={s.version} />
        </div>
        <p className={s.tagline}>{TAGLINE}</p>
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
    </ThemeProvider>
  );
}
