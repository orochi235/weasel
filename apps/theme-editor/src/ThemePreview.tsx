import { themeAxes, type Selection, type Theme } from '@weasel-js/theme';
import { ThemeProvider } from '@weasel-js/theme/react';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Input } from '@weasel-js/ui/components/Input';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { Switch } from '@weasel-js/ui/components/Switch';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { useState, type MouseEvent, type SyntheticEvent } from 'react';
import styles from './ThemeEditor.module.css';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from './icons.gen';

export interface PreviewVariant {
  readonly label: string;
  readonly theme: Theme;
}

export interface ThemePreviewProps {
  readonly variants: readonly PreviewVariant[];
  /** Every axis but `mode`, which the preview shows all of. */
  readonly selection: Selection;
  readonly inspecting?: boolean;
  readonly onInspect?: (target: Element, pane: Element) => void;
}

const ALIGN = [
  { value: 'left', label: <Icon name={icon('core:textAlignLeft')} size={16} />, ariaLabel: 'Left', tooltip: 'Left' },
  { value: 'center', label: <Icon name={icon('core:textAlignCenter')} size={16} />, ariaLabel: 'Center', tooltip: 'Center' },
  { value: 'right', label: <Icon name={icon('core:textAlignRight')} size={16} />, ariaLabel: 'Right', tooltip: 'Right' },
];

function Specimen({ caption }: { caption: string }) {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 40 }]);
  const [align, setAlign] = useState<string | null>('left');
  return (
    <SidebarPanel title={`Panel · ${caption}`}>
      <div className={styles.specimenBody}>
        <div className={styles.specimenRow}>
          <Button stance="confirm" size="sm">Primary</Button>
          <Button size="sm">Secondary</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
        </div>
        <Checkbox isSelected={checked} onChange={setChecked}>Checkbox</Checkbox>
        <Switch isSelected={on} onChange={setOn}>Switch</Switch>
        <Slider thumbs={thumbs} onInput={setThumbs} min={0} max={100} thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)" ariaLabel="Slider" />
        <ToggleBar size="sm" ariaLabel="Alignment" items={ALIGN} value={align} onChange={setAlign} />
        <div className={styles.sunken}>
          <Input label="Sunken field" defaultValue="Text" />
        </div>
      </div>
    </SidebarPanel>
  );
}

/** Real kit components under the draft theme, one pane per mode, so an edit shows in both at once. */
export function ThemePreview({ variants, selection, inspecting = false, onInspect }: ThemePreviewProps) {
  const swallow = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const capture = (e: MouseEvent<HTMLDivElement>) => {
    swallow(e);
    onInspect?.(e.target as Element, e.currentTarget);
  };
  return (
    <div className={styles.preview}>
      {variants.map((variant) => {
        const modes = Object.keys(themeAxes(variant.theme).mode?.values ?? {});
        return (
          <section key={variant.label} className={styles.previewVariant} aria-label={variant.label}>
            {variants.length > 1 && <h2 className={styles.previewLabel}>{variant.label}</h2>}
            <div className={styles.previewModes}>
              {(modes.length > 0 ? modes : [undefined]).map((mode) => (
                <ThemeProvider
                  key={mode ?? 'default'}
                  theme={variant.theme}
                  selection={mode === undefined ? selection : { ...selection, mode }}
                  className={styles.previewPane}
                >
                  <div
                    className={inspecting ? styles.inspecting : undefined}
                    onPointerDownCapture={inspecting ? swallow : undefined}
                    onMouseDownCapture={inspecting ? swallow : undefined}
                    onClickCapture={inspecting ? capture : undefined}
                  >
                    <Specimen caption={mode ?? 'default'} />
                  </div>
                </ThemeProvider>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
