import { adoptCss, KitSettingsProvider, styleRootOf, type KitSettingsOverrides } from '@weasel-js/react';
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { prefsCss, prefsCssAttributes } from './css';
import type { PrefGroup } from './groups';
import { prefValueAtPath } from './helpers';
import { kitSettingsCssOptions } from './kitCss';
import type { PrefsStore } from './store';

/**
 * Kit settings from a prefs store: everything inside reads the store's values
 * at `at` (the whole store without it) through `useKitSetting`, kept current
 * as the store changes.
 *
 * With `css`, the same subtree is written as `--wzl-kit-*` custom properties
 * (`kitSettingsCssOptions(at)`) into a sheet of the document or shadow root
 * the component renders in, and the selectors' attributes are set on that
 * root's element — `<html>`, or the shadow host, matched as `:root` or
 * `:host`. That root is found from a hidden `<span>` rendered ahead of the
 * children. Both are rewritten on every store change and removed on unmount.
 */
export function KitSettingsFromPrefs<S extends PrefGroup>({
  store,
  at,
  css = false,
  children,
}: {
  store: PrefsStore<S>;
  at?: string;
  css?: boolean;
  children?: ReactNode;
}): ReactNode {
  const values = useSyncExternalStore(store.subscribe, store.values, store.values);
  const value = (at ? prefValueAtPath(values, at) : values) ?? {};
  const anchor = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = anchor.current;
    if (!css || !el) return;
    const root = styleRootOf(el);
    const host = 'host' in root ? root.host : root.documentElement;
    const options = { ...kitSettingsCssOptions(at), root: 'host' in root ? ':host' : ':root' };
    const sheet = adoptCss(root, prefsCss(store, options));
    let set: string[] = [];
    const write = (): void => {
      for (const name of set) host.removeAttribute(name);
      const attributes = prefsCssAttributes(store, options);
      for (const [name, option] of Object.entries(attributes)) host.setAttribute(name, option);
      set = Object.keys(attributes);
    };
    write();
    const stop = store.subscribe(() => {
      sheet.write(prefsCss(store, options));
      write();
    });
    return () => {
      stop();
      sheet.release();
      for (const name of set) host.removeAttribute(name);
    };
  }, [store, at, css]);

  return (
    <KitSettingsProvider value={value as KitSettingsOverrides}>
      {css && <span hidden ref={anchor} />}
      {children}
    </KitSettingsProvider>
  );
}
