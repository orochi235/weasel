import { ActionButton } from '@weasel-js/ui/components/ActionButton';
import { Button } from '@weasel-js/ui/components/Button';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { ToolGroup } from '@weasel-js/ui/components/ToolGroup';
import { ToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';
import { type CSSProperties, useState } from 'react';
import { Cell } from './Cell';
import { Dot } from './Dot';
import { Section } from './Section';

export function ToolChrome() {
  const [tool, setTool] = useState('select');
  const [paneWidth, setPaneWidth] = useState(160);
  return (
    <Section title="Tool chrome">
      <Cell label="ToolGroup, ActionButton">
        <ToolGroup aria-label="Tools">
          {['select', 'rect', 'ellipse'].map((id) => (
            <ActionButton
              key={id}
              icon={<Dot />}
              label={id}
              shortcut={id.slice(0, 1).toUpperCase()}
              active={tool === id}
              onPress={() => setTool(id)}
            />
          ))}
        </ToolGroup>
      </Cell>
      <Cell label="ToolOptionsBar">
        <ToolOptionsBar label="Text" size="sm">
          <Button variant="ghost" iconOnly aria-label="Bold">
            B
          </Button>
          <Button variant="ghost" iconOnly aria-label="Italic">
            I
          </Button>
        </ToolOptionsBar>
      </Cell>
      <Cell label="ResizeHandle">
        <div className="lk-specimen__box">
          <div className="lk-specimen__box-main">content</div>
          <ResizeHandle
            value={paneWidth}
            min={100}
            max={220}
            invert
            onInput={setPaneWidth}
            aria-label="Resize"
          />
          <div
            className="lk-specimen__pane"
            style={{ '--lk-specimen-pane-w': `${paneWidth}px` } as CSSProperties}
          >
            {paneWidth}px
          </div>
        </div>
      </Cell>
    </Section>
  );
}
