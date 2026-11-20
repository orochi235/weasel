import { Button, CLOSE_BUTTON_PROPS } from '@weasel-js/ui/components/Button';
import { useLabCommands } from '../lab/LabContext';

/**
 * Stands in for a trial whose record or instrument is gone, such as a saved layout naming a story
 * that was since renamed. It has no chrome of its own, so it carries the close the chrome would.
 */
export function MissingTrial({
  id,
  isLastTrial = false,
  children,
}: {
  id: string;
  /** Whether this is the lab's only trial, which Close keeps, so the button is disabled. */
  isLastTrial?: boolean;
  children: string;
}) {
  const lab = useLabCommands();
  return (
    <div className="lk-trial lk-trial--unknown">
      <span>{children}</span>
      <Button
        {...CLOSE_BUTTON_PROPS}
        aria-label="Close trial"
        disabled={isLastTrial}
        disabledReason="It is the last trial"
        onClick={() => lab.closeTrial(id)}
      />
    </div>
  );
}
