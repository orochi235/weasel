import type { Preview } from '@storybook/react-vite';
import React from 'react';
import '@orochi235/weasel-theme/tokens.css';

// Paint the preview iframe canvas with our themed surface color so stories
// don't render on raw white. Lives outside the React tree so it applies even
// when the story root unmounts.
if (typeof document !== 'undefined') {
  const id = 'storybook-canvas-bg';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = 'html, body { background: var(--wzl-surface); color: var(--wzl-fg); }';
    document.head.appendChild(style);
  }
}

if (typeof document !== 'undefined') {
  const id = 'storybook-font-picker-link';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700;1,900&family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap';
    document.head.appendChild(link);
  }
}

interface FontInfo {
  family: string;
  weights: number[];
  italics: boolean[];
  stretches: React.CSSProperties['fontStretch'][];
}

const FONTS: Record<string, FontInfo> = {
  oswald:     { family: 'Oswald, system-ui, sans-serif',                 weights: [300, 400, 500, 600, 700],         italics: [false],       stretches: ['normal'] },
  helvetica:  { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', weights: [100, 300, 400, 500, 700, 900],   italics: [false, true], stretches: ['ultra-condensed', 'condensed', 'normal'] },
  futura:     { family: 'Futura, "Trebuchet MS", Arial, sans-serif',     weights: [400, 500, 700],                   italics: [false, true], stretches: ['condensed', 'normal'] },
  inter:      { family: 'Inter, system-ui, sans-serif',                  weights: [300, 400, 500, 600, 700],         italics: [false, true], stretches: ['normal'] },
  roboto:     { family: 'Roboto, system-ui, sans-serif',                 weights: [300, 400, 500, 700, 900],         italics: [false, true], stretches: ['normal'] },
  openSans:   { family: '"Open Sans", system-ui, sans-serif',            weights: [300, 400, 500, 600, 700],         italics: [false, true], stretches: ['normal'] },
  lato:       { family: 'Lato, system-ui, sans-serif',                   weights: [300, 400, 700, 900],              italics: [false, true], stretches: ['normal'] },
  montserrat: { family: 'Montserrat, system-ui, sans-serif',             weights: [300, 400, 500, 600, 700, 800],    italics: [false, true], stretches: ['normal'] },
  plexSans:   { family: '"IBM Plex Sans", system-ui, sans-serif',        weights: [300, 400, 500, 600, 700],         italics: [false, true], stretches: ['normal'] },
  plexMono:   { family: '"IBM Plex Mono", ui-monospace, monospace',      weights: [300, 400, 500, 600, 700],         italics: [false, true], stretches: ['normal'] },
  jetbrains:  { family: '"JetBrains Mono", ui-monospace, monospace',     weights: [300, 400, 500, 600, 700],         italics: [false, true], stretches: ['normal'] },
  system:     { family: 'system-ui, -apple-system, sans-serif',          weights: [100, 300, 400, 500, 600, 700, 900], italics: [false, true], stretches: ['normal'] },
  serif:      { family: 'ui-serif, Georgia, serif',                      weights: [400, 700],                        italics: [false, true], stretches: ['normal'] },
  mono:       { family: 'ui-monospace, SFMono-Regular, Menlo, monospace', weights: [400, 700],                       italics: [false, true], stretches: ['normal'] },
};

function snapNumber(value: number, supported: number[]): number {
  if (supported.includes(value)) return value;
  return supported.reduce((closest, v) => Math.abs(v - value) < Math.abs(closest - value) ? v : closest, supported[0]);
}

function snapStretch(value: React.CSSProperties['fontStretch'], supported: React.CSSProperties['fontStretch'][]): React.CSSProperties['fontStretch'] {
  if (supported.includes(value)) return value;
  return supported.includes('normal' as never) ? 'normal' : supported[0];
}

const preview: Preview = {
  initialGlobals: {
    theme: 'dark',
    fontFamily: 'oswald',
    fontWeight: '500',
    fontStretch: 'normal',
    fontStyle: 'normal',
    fontSize: 'default',
  },
  globalTypes: {
    // `theme` is driven by the manager-side toggle button in `manager.tsx`;
    // no `toolbar` config here so it doesn't render as a dropdown.
    fontFamily: {
      name: 'Font',
      description: 'Preview font family',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'oswald',     title: 'Oswald' },
          { value: 'helvetica',  title: 'Helvetica' },
          { value: 'futura',     title: 'Futura' },
          { value: 'inter',      title: 'Inter' },
          { value: 'roboto',     title: 'Roboto' },
          { value: 'openSans',   title: 'Open Sans' },
          { value: 'lato',       title: 'Lato' },
          { value: 'montserrat', title: 'Montserrat' },
          { value: 'plexSans',   title: 'IBM Plex Sans' },
          { value: 'plexMono',   title: 'IBM Plex Mono' },
          { value: 'jetbrains',  title: 'JetBrains Mono' },
          { value: 'system',     title: 'System' },
          { value: 'serif',      title: 'Serif' },
          { value: 'mono',       title: 'Mono' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    fontWeight: {
      name: 'Weight',
      description: 'Snapped to the nearest weight the current font ships',
      toolbar: {
        icon: 'bold',
        items: [
          { value: '100', title: 'Thin (100)' },
          { value: '300', title: 'Light (300)' },
          { value: '400', title: 'Regular (400)' },
          { value: '500', title: 'Medium (500)' },
          { value: '600', title: 'Semibold (600)' },
          { value: '700', title: 'Bold (700)' },
          { value: '800', title: 'Extrabold (800)' },
          { value: '900', title: 'Black (900)' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    fontStretch: {
      name: 'Width',
      description: 'Snapped to the nearest width the current font ships',
      toolbar: {
        icon: 'compress',
        items: [
          { value: 'ultra-condensed', title: 'Ultra Condensed' },
          { value: 'extra-condensed', title: 'Extra Condensed' },
          { value: 'condensed',       title: 'Condensed' },
          { value: 'semi-condensed',  title: 'Semi Condensed' },
          { value: 'normal',          title: 'Normal' },
          { value: 'semi-expanded',   title: 'Semi Expanded' },
          { value: 'expanded',        title: 'Expanded' },
          { value: 'extra-expanded',  title: 'Extra Expanded' },
          { value: 'ultra-expanded',  title: 'Ultra Expanded' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    fontStyle: {
      name: 'Italic',
      description: 'Disabled when the current font has no italic face',
      toolbar: {
        icon: 'italic',
        items: [
          { value: 'normal', title: 'Regular' },
          { value: 'italic', title: 'Italic' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    fontSize: {
      name: 'Size',
      description: 'Override badge font size (applies via !important so it overrides the Badge sm/md defaults)',
      toolbar: {
        icon: 'ruler',
        items: [
          { value: 'default', title: 'Default' },
          { value: '9',  title: '9px'  },
          { value: '10', title: '10px' },
          { value: '12', title: '12px' },
          { value: '14', title: '14px' },
          { value: '16', title: '16px' },
          { value: '20', title: '20px' },
          { value: '24', title: '24px' },
          { value: '32', title: '32px' },
          { value: '48', title: '48px' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = String(context.globals.theme ?? 'dark');
      }
      return Story();
    },
    (Story, context) => {
      const key = String(context.globals.fontFamily ?? 'oswald');
      const font = FONTS[key] ?? FONTS.oswald;

      const requestedWeight = Number(context.globals.fontWeight ?? 500);
      const weight = snapNumber(requestedWeight, font.weights);

      const requestedStretch = String(context.globals.fontStretch ?? 'normal') as React.CSSProperties['fontStretch'];
      const stretch = snapStretch(requestedStretch, font.stretches);

      const requestedItalic = String(context.globals.fontStyle ?? 'normal') === 'italic';
      const italic = font.italics.includes(requestedItalic) ? requestedItalic : font.italics[0];
      const style: React.CSSProperties['fontStyle'] = italic ? 'italic' : 'normal';

      const sizeRaw = String(context.globals.fontSize ?? 'default');
      const sizeOverride = sizeRaw !== 'default' ? Number(sizeRaw) : null;

      return (
        <>
          {sizeOverride !== null && (
            <style>{`.sb-font-size-override .badge { font-size: ${sizeOverride}px !important; --badge-font-size: ${sizeOverride}px !important; }`}</style>
          )}
          <div
            className={sizeOverride !== null ? 'sb-font-size-override' : undefined}
            style={{
              fontFamily: font.family,
              fontWeight: weight as React.CSSProperties['fontWeight'],
              fontStretch: stretch,
              fontStyle: style,
              ...(sizeOverride !== null && { fontSize: `${sizeOverride}px` }),
            }}
          >
            <Story />
          </div>
        </>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'padded',
  },
};

void React;
export default preview;
