/**
 * Whether the inspected page has a weasel hook, watched across navigations.
 * An app installs its hook when its first canvas mounts, which can be well
 * after load, so the check repeats until a hook turns up.
 */
import type { ExtensionApi } from './browserApi';
import { probeRequest } from './envelope';

export interface PresenceOptions {
  /** Answer the probe in the inspected page. */
  probe(): Promise<boolean>;
  /** Hear each navigation of the inspected page. Returns the unsubscribe. */
  onNavigated(listener: () => void): () => void;
  /** Delays between checks after a navigation, in ms. Once they run out the page reads as absent, and
   *  the check repeats at the last delay until a hook appears. */
  delays?: readonly number[];
}

const DEFAULT_DELAYS = [0, 250, 500, 1000, 2000, 4000];

/** Report `present` on every change of answer, starting with the first. Returns the stop. */
export function watchHookPresence(opts: PresenceOptions, report: (present: boolean) => void): () => void {
  const delays = opts.delays ?? DEFAULT_DELAYS;
  let generation = 0;
  let last: boolean | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tell = (present: boolean): void => {
    if (present === last) return;
    last = present;
    report(present);
  };
  const poll = (gen: number, step: number): void => {
    timer = setTimeout(() => {
      opts.probe().catch(() => false).then((present) => {
        if (gen !== generation) return;
        if (present) return tell(true);
        if (step + 1 >= delays.length) tell(false);
        poll(gen, Math.min(step + 1, delays.length - 1));
      });
    }, delays[step]);
  };
  const restart = (): void => {
    generation++;
    if (timer) clearTimeout(timer);
    // The old page and its hook are gone; the panel drops its view before the new page answers.
    if (last) tell(false);
    last = null;
    poll(generation, 0);
  };

  const off = opts.onNavigated(restart);
  restart();
  return () => {
    generation++;
    if (timer) clearTimeout(timer);
    off();
  };
}

/** {@link watchHookPresence}'s inputs in a devtools page. The background probes every frame of the tab, since
 *  `inspectedWindow.eval` reaches only one frame and weasel may run in an iframe alone. */
export function inspectedPresence(api: ExtensionApi): PresenceOptions {
  const tabId = api.devtools!.inspectedWindow.tabId;
  return {
    probe: () => api.runtime.sendMessage(probeRequest(tabId)).then((present) => present === true),
    onNavigated(listener) {
      const onNavigated = api.devtools!.network.onNavigated;
      onNavigated.addListener(listener);
      return () => onNavigated.removeListener(listener);
    },
  };
}
