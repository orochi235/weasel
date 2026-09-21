import { useLabContext } from '@weasel-js/labkit';
import { Dialog } from '@weasel-js/ui';
import type { IndexEntry } from '../../story/types';
import { storyDossier } from './dossier';
import { StoryDossier } from './StoryDossier';

export interface StoryInfoDialogProps {
  index: readonly IndexEntry[];
  /** Whether a story's frame has reported its schema — `StoryRegistry.isReady`. */
  isReady: (id: string) => boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Get Info for the focused trial's story. Mount inside `<Lab>`: it reads the
 * lab's context, and renders nothing until it is opened.
 */
export function StoryInfoDialog({ index, isReady, isOpen, onOpenChange }: StoryInfoDialogProps) {
  const { focusedTrialId, trials, instruments } = useLabContext();
  const trial = trials.find((record) => record.id === focusedTrialId);
  const entry = trial ? index.find((candidate) => candidate.id === trial.instrumentName) : undefined;
  if (!entry) return null;
  const dossier = storyDossier({
    entry,
    instrument: instruments.find((candidate) => candidate.name === entry.id),
    config: trial?.config,
    ready: isReady(entry.id),
  });
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={`${dossier.title} / ${dossier.name}`}
      className="fg-info-dialog"
    >
      <StoryDossier dossier={dossier} />
    </Dialog>
  );
}
