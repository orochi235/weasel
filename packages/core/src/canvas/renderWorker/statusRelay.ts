/** One status for the workers behind a canvas, which outlives each of them: a restart replaces
 *  the workers, and whoever listens hears the new ones. */
import { createEmitter } from '@weasel-js/registry';
import type { AnyRenderWorker } from './liveClients';
import { combinedStatus, type RenderWorkerStatus } from './workerHealth';

export interface StatusRelay {
  status(): RenderWorkerStatus;
  subscribe(fn: () => void): () => void;
  /** Hear `client`'s changes from here on. Returns a stop. */
  follow(client: AnyRenderWorker): () => void;
  /** The workers themselves changed. */
  changed(): void;
}

export function createStatusRelay(clients: () => readonly AnyRenderWorker[]): StatusRelay {
  const changed = createEmitter();
  return {
    status: () => combinedStatus(clients().map((c) => c.status)),
    subscribe: changed.subscribe,
    follow: (client) => client.subscribeStatus(changed.emit),
    changed: changed.emit,
  };
}
