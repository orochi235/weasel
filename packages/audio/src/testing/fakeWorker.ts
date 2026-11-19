/** A dedicated-Worker double. Nothing runs in it: a test reads what was posted
 *  and delivers the worker's replies by hand. */
export class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly url: string;
  readonly posted: unknown[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Set<(e: unknown) => void>>();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeWorker.instances.push(this);
  }

  postMessage(data: unknown): void {
    if (!this.terminated) this.posted.push(data);
  }

  addEventListener(type: string, fn: (e: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Test hook: the worker posts `data` to the main thread. */
  _reply(data: unknown): void {
    if (this.terminated) return;
    for (const fn of [...(this.listeners.get('message') ?? [])]) fn({ data });
  }

  /** Test hook: the worker failed — a CSP refusal arrives this way. */
  _fail(): void {
    if (this.terminated) return;
    for (const fn of [...(this.listeners.get('error') ?? [])]) fn({ type: 'error' });
  }
}

/** Installs `Worker`, `Blob` and the object-URL pair as globals, recording every
 *  script the code under test builds. `restore` puts the environment back. */
export function stubWorkerGlobals() {
  FakeWorker.instances = [];
  const scripts: string[] = [];
  const revoked: string[] = [];
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;

  class RecordingBlob {
    readonly type: string;
    constructor(parts: string[], opts?: { type?: string }) {
      scripts.push(parts.join(''));
      this.type = opts?.type ?? '';
    }
  }

  // Only these two are put back, so a global the test stubbed itself survives.
  const g = globalThis as Record<string, unknown>;
  const saved = (['Worker', 'Blob'] as const).map((key) => [key, Object.getOwnPropertyDescriptor(g, key)] as const);
  const install = (key: string, value: unknown): void => {
    Object.defineProperty(g, key, { value, writable: true, configurable: true, enumerable: false });
  };
  install('Worker', FakeWorker);
  install('Blob', RecordingBlob);
  URL.createObjectURL = (() => `blob:fake/${scripts.length}`) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => { revoked.push(url); }) as typeof URL.revokeObjectURL;

  return {
    workers: FakeWorker.instances,
    scripts,
    revoked,
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(g, key, descriptor);
        else delete g[key];
      }
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
    },
  };
}
