import { Badge } from '@weasel-js/ui/components/Badge';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Button } from '@weasel-js/ui/components/Button';
import { Callout } from '@weasel-js/ui/components/Callout';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { Powerline } from '@weasel-js/ui/components/Powerline';
import { createToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import { useMemo, useRef, useState } from 'react';
import { Cell } from './Cell';
import { Section } from './Section';

export function OverlaysAndFeedback() {
  const calloutAnchor = useRef<HTMLButtonElement>(null);
  const [calloutOpen, setCalloutOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const toasts = useMemo(() => createToastQueue(), []);
  return (
    <Section title="Overlays & feedback">
      <Cell label="Tooltip, Callout, Dialog, Toast">
        <div className="lk-specimen__row">
          <TooltipTrigger>
            <Focusable>
              <button type="button">Hover me</button>
            </Focusable>
            <Tooltip placement="bottom">Duplicates the selected layer</Tooltip>
          </TooltipTrigger>
          <button type="button" ref={calloutAnchor} onClick={() => setCalloutOpen(true)}>
            Callout
          </button>
          <Callout
            triggerRef={calloutAnchor}
            open={calloutOpen}
            onOpenChange={setCalloutOpen}
            grade="info"
            title="Info"
          >
            Neutral guidance.
          </Callout>
          <Button onClick={() => setDialogOpen(true)}>Dialog</Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Preferences"
            footer={
              <Button stance="confirm" onClick={() => setDialogOpen(false)}>
                OK
              </Button>
            }
          >
            <p>Dialog body.</p>
          </Dialog>
          <Button
            onClick={() =>
              toasts.add('success', 'Saved', { description: 'All changes stored.', ttlMs: null })
            }
          >
            Toast
          </Button>
          <ToastRegion queue={toasts} placement="bottom-right" />
        </div>
      </Cell>
      <Cell label="Powerline">
        <Powerline variant="solid" size="sm">
          <Badge emphasis="high" endCap="chevron">
            main
          </Badge>
          <Badge grade="info" endCap="slant">
            ✓ 12
          </Badge>
          <Badge emphasis="low">~/proj</Badge>
        </Powerline>
      </Cell>
      <Cell label="Status bar">
        <Bar framed="status" label="Editor status">
          <Bar.Readout>tool: select</Bar.Readout>
          <Bar.Readout>sel: 3</Bar.Readout>
          <Bar.Spacer />
          <Bar.Readout muted>0.7.0</Bar.Readout>
        </Bar>
      </Cell>
    </Section>
  );
}
