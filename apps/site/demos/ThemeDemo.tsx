import { useMemo, useState } from 'react';
import { defineTheme, type TokenName } from '@weasel-js/theme';
import { ThemeProvider, useTheme } from '@weasel-js/theme/react';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { ColorField } from '@weasel-js/ui/components/ColorField';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import s from './ThemeDemo.module.css';

type Mode = 'light' | 'dark';

const MODES: { value: Mode; label: string }[] = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
];

const SHOWN: TokenName[] = ['--wzl-accent', '--wzl-surface', '--wzl-fg', '--wzl-border'];

/** What the themed subtree draws: kit controls, and the tokens they read as `useTheme()` resolves them. */
function Specimen() {
  const { resolved } = useTheme();
  const [checked, setChecked] = useState(true);
  return (
    <>
      <div className={s.controls}>
        <Button>Solid</Button>
        <Button variant="ghost">Ghost</Button>
        <Checkbox isSelected={checked} onChange={setChecked}>Checked</Checkbox>
      </div>
      <table className={s.table}>
        <tbody>
          {SHOWN.map((name) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{resolved[name]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function ThemeDemo() {
  const [accent, setAccent] = useState('#e0457b');
  const [mode, setMode] = useState<Mode>('light');
  // Pinning the primitive rebases every alias that reads it, `--wzl-accent` among them.
  const theme = useMemo(() => defineTheme({ name: 'demo', pins: { 'accent-base': accent } }), [accent]);

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <ColorField aria-label="Accent" value={accent} onInput={setAccent} onChange={setAccent} />
        <SegmentedBar aria-label="Mode" size="sm" items={MODES} value={mode} onChange={(v) => v && setMode(v)} />
      </div>
      <ThemeProvider theme={theme} selection={{ mode }} className={s.themed}>
        <Specimen />
      </ThemeProvider>
    </div>
  );
}
