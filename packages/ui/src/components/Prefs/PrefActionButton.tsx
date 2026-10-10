import { useEffect, useRef, useState } from 'react';
import type { PrefAction } from '@weasel-js/prefs';
import { Button } from '../Button';

/** An `action` leaf's button, disabled while a promise its `run` returned is pending. */
export function PrefActionButton({ pref, path }: { pref: PrefAction; path: string }) {
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const press = (): void => {
    // A schema that has been through JSON, as a schema editor's saved draft has, comes back without `run`.
    const out = (pref.run as PrefAction['run'] | undefined)?.({ path });
    if (typeof out?.then !== 'function') return;
    setPending(true);
    void out.finally(() => {
      if (mounted.current) setPending(false);
    });
  };
  return (
    <Button size="sm" disabled={pending} onClick={press}>
      {pref.label ?? pref.name}
    </Button>
  );
}
