import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useThemeOptional } from '@weasel-js/theme/react';
import { SiteColorModeContext } from '../../colorMode';
import { HudDemo } from '../HudDemo';
import { HudGalleryDemo } from '../HudGalleryDemo';
import { LoupeDemo } from '../LoupeDemo';
import { HudContextMenuDemo } from '../HudContextMenuDemo';

// The hud takes its colors from the theme in force where `useHud` is called.
const seen: (string | undefined)[] = [];
vi.mock('@weasel-js/hud/react', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/hud/react')>();
  return {
    ...real,
    useHud: ((...args: Parameters<typeof real.useHud>) => {
      seen.push(useThemeOptional()?.selection.mode);
      return real.useHud(...args);
    }) as typeof real.useHud,
  };
});

beforeAll(() => {
  // jsdom has none; the gallery's sprite never arrives, which this test does not need.
  vi.stubGlobal('createImageBitmap', () => new Promise(() => {}));
});
afterEach(() => {
  cleanup();
  seen.length = 0;
});

const demos: [string, ComponentType][] = [
  ['hud', HudDemo],
  ['hud-gallery', HudGalleryDemo],
  ['loupe', LoupeDemo],
  ['hud-context-menu', HudContextMenuDemo],
];

describe('the hud demos follow the site color mode', () => {
  for (const [id, Demo] of demos) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${id} draws its hud in ${mode} when the site shows ${mode}`, () => {
        render(
          <SiteColorModeContext.Provider value={mode}>
            <Demo />
          </SiteColorModeContext.Provider>,
        );
        expect(seen.length).toBeGreaterThan(0);
        expect(new Set(seen)).toEqual(new Set([mode]));
      });
    }
  }
});
