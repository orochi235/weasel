import React from 'react';
import { addons, types, useGlobals } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';
import { BeakerIcon } from '@storybook/icons';

const ADDON_ID = 'weasel/theme-toggle';
const TOOL_ID = `${ADDON_ID}/tool`;

const MoonSvg = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M12.5 8.5a5 5 0 0 1-7-7 5.5 5.5 0 1 0 7 7Z" />
  </svg>
);

const SunSvg = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="2.6" fill="currentColor" stroke="none" />
    <path d="M7 1v1.6M7 11.4V13M1 7h1.6M11.4 7H13M2.6 2.6l1.1 1.1M10.3 10.3l1.1 1.1M2.6 11.4l1.1-1.1M10.3 3.7l1.1-1.1" />
  </svg>
);

function ThemeToggle() {
  const [globals, updateGlobals] = useGlobals();
  const theme = (globals.theme as string | undefined) ?? 'dark';
  const isDark = theme === 'dark';
  return (
    <IconButton
      key={TOOL_ID}
      title={isDark ? 'Switch to day theme' : 'Switch to night theme'}
      onClick={() => updateGlobals({ theme: isDark ? 'light' : 'dark' })}
    >
      {isDark ? <MoonSvg /> : <SunSvg />}
    </IconButton>
  );
}

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Theme',
    render: () => <ThemeToggle />,
  });
});

// Prefix lab-style stories with a beaker icon in the sidebar. Matches any
// story whose name contains "Lab" (Button Lab, Compose Lab, etc.).
addons.setConfig({
  sidebar: {
    renderLabel: (item) => {
      const isLab = (item.type === 'story' || item.type === 'docs') && /\blab\b/i.test(item.name);
      if (!isLab) return item.name;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <BeakerIcon />
          {item.name}
        </span>
      );
    },
  },
});
