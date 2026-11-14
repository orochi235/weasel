import { copyText } from '@weasel-js/react';
import { Badge, lookProps } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { PropertyPanel } from '@weasel-js/ui/components/Properties';
import { useState } from 'react';
import type { ComposeConfig } from './composeConfig';
import { LAB_PRESETS, presetShape } from './presets';
import { composeSnippet } from './snippet';
import s from './Compose.module.css';

/**
 * Every preset, drawn in the lab's colors and label; one press loads one as a single undo step. Copy writes the
 * `<Badge>` JSX for the badge on the stage.
 */
export function PresetsPanel({ config, setConfig }: { config: ComposeConfig; setConfig: (path: string, value: unknown) => void }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { look } = config;
  const copy = () => {
    const text = composeSnippet(config);
    setSnippet(text);
    setCopied(false);
    void copyText(text).then(setCopied);
  };
  return (
    <PropertyPanel title="Presets" actions={<Button variant="ghost" size="sm" onClick={copy}>Copy JSX</Button>}>
      {snippet !== null && (
        <>
          <textarea readOnly aria-label="Badge JSX" className={s.snippet} value={snippet} rows={Math.min(20, snippet.split('\n').length + 1)} />
          {copied && <p role="status" className={s.note}>Copied to the clipboard.</p>}
        </>
      )}
      <ul className={s.presets}>
        {LAB_PRESETS.map((preset) => (
          <li key={preset.name} className={s.preset}>
            <Button variant="ghost" aria-label={`Load ${preset.name}`} onClick={() => setConfig('shape', presetShape(preset))}>
              <Badge
                base={preset.base}
                baseParams={preset.baseParams as never}
                effects={preset.effects as never}
                {...lookProps(look.look, look.tint)}
                variant={look.variant}
                bloat={look.bloat}
                size={look.size}
              >
                {look.label}
              </Badge>
            </Button>
            <code className={s.presetName}>{preset.name}</code>
          </li>
        ))}
      </ul>
    </PropertyPanel>
  );
}
