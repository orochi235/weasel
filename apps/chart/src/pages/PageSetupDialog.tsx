import { Button } from '@weasel-js/ui/components/Button';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { PropertyField, PropertyList } from '@weasel-js/ui/components/Properties';
import { useState, type ReactElement } from 'react';
import { PAPER_SIZES, paperSize, setupOf, type Orientation, type PageSize, type PageSetup, type PaperId } from './pageSizes';

const PAPERS = [...PAPER_SIZES.map((p) => ({ value: p.id as PaperId, label: p.label })), { value: 'custom' as PaperId, label: 'Custom' }];
const ORIENTATIONS = [{ value: 'portrait' as Orientation, label: 'Portrait' }, { value: 'landscape' as Orientation, label: 'Landscape' }];

export interface PageSetupDialogProps {
  /** The page being set up, by its name and current size; `null` while the dialog is shut. */
  page: { name: string; size: PageSize } | null;
  onApply(size: PageSize): void;
  onClose(): void;
}

/** Page › Page Setup: a listed paper either way up, or a custom size. */
export function PageSetupDialog({ page, onApply, onClose }: PageSetupDialogProps): ReactElement | null {
  return page && <SetupDialog page={page} onApply={onApply} onClose={onClose} />;
}

function SetupDialog({ page, onApply, onClose }: { page: { name: string; size: PageSize } } & Omit<PageSetupDialogProps, 'page'>) {
  const [setup, setSetup] = useState<PageSetup>(() => setupOf(page.size));
  const choose = (paper: PaperId, orientation: Orientation) =>
    setSetup((s) => ({ ...s, paper, orientation, ...(paperSize(paper, orientation) ?? turned(s, orientation)) }));
  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button stance="confirm" onClick={() => { onApply({ width: setup.width, height: setup.height }); onClose(); }}>Apply</Button>
    </>
  );
  return (
    <Dialog isOpen onOpenChange={(open) => { if (!open) onClose(); }} title={`Page Setup: ${page.name}`} isDismissable footer={footer}>
      <PropertyList>
        <PropertyField kind="enum" control="select" label="Size" value={setup.paper} options={PAPERS}
          onChange={(paper) => choose(paper, setup.orientation)} />
        <PropertyField kind="enum" control="select" label="Orientation" value={setup.orientation} options={ORIENTATIONS}
          onChange={(orientation) => choose(setup.paper, orientation)} />
        <PropertyField kind="number" label="Width" value={setup.width} min={1} disabled={setup.paper !== 'custom'}
          onChange={(width) => setSetup((s) => ({ ...s, width }))} />
        <PropertyField kind="number" label="Height" value={setup.height} min={1} disabled={setup.paper !== 'custom'}
          onChange={(height) => setSetup((s) => ({ ...s, height }))} />
      </PropertyList>
    </Dialog>
  );
}

/** A custom size turned to `orientation`: its long side runs that way. */
function turned(size: PageSize, orientation: Orientation): PageSize {
  const long = Math.max(size.width, size.height);
  const short = Math.min(size.width, size.height);
  return orientation === 'landscape' ? { width: long, height: short } : { width: short, height: long };
}
