import { useEffect } from 'react';
import { disableMachineFontOutlines, enableMachineFontOutlines } from './fonts';
import { usePref } from './prefs';

/**
 * Follows the machine-font outlines preference. The switch is the user gesture the permission
 * prompt needs; on a later load the pref is already on and, with permission granted,
 * `queryLocalFonts` resolves without prompting again.
 */
export function useMachineFontOutlines(): void {
  const [machineOutlines, setMachineOutlines] = usePref('text.machineFontOutlines');
  useEffect(() => {
    if (!machineOutlines) {
      disableMachineFontOutlines();
      return;
    }
    void enableMachineFontOutlines().catch((err: unknown) => {
      // A refusal is the user's answer, so put the switch back to match it. Anything else — no
      // API in this browser, a transient failure — leaves the preference alone.
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setMachineOutlines(false);
        return;
      }
      console.warn('WeaselDraw: machine-font outlines unavailable —', err);
    });
  }, [machineOutlines, setMachineOutlines]);
}
