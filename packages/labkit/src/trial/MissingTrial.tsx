import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import { useLabCommands } from '../lab/LabContext';

/**
 * Stands in for a trial whose record or instrument is gone, such as a saved layout naming a story
 * that was since renamed. It has no chrome of its own, so it carries the close the chrome would.
 */
export function MissingTrial({ id, children }: { id: string; children: string }) {
  const lab = useLabCommands();
  return (
    <div className="lk-trial lk-trial--unknown">
      <span>{children}</span>
      <CloseButton aria-label="Close trial" onClick={() => lab.closeTrial(id)} />
    </div>
  );
}
