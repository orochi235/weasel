import type { QualifiedIconName } from './index.ts';

declare const brand: unique symbol;

/** A qualified icon name (`namespace:name`) that came from `icon()` or `toIconRef`. */
export type IconRef = string & { readonly [brand]: 'IconRef' };

const QUALIFIED = /^([^:\s]+):([^:\s]+)$/;

/** `name` in `namespace`, unless it already names one. */
export function qualify(namespace: string, name: string): string {
  return name.includes(':') ? name : `${namespace}:${name}`;
}

/** The two halves of a qualified ref, or `undefined` for anything else. */
export function splitIconRef(ref: string): { namespace: string; name: string } | undefined {
  const m = QUALIFIED.exec(ref);
  return m ? { namespace: m[1]!, name: m[2]! } : undefined;
}

/** A string read at run time (a schema loaded as JSON) as a ref, when it is qualified. */
export function toIconRef(value: string | undefined): IconRef | undefined {
  return value !== undefined && QUALIFIED.test(value) ? (value as IconRef) : undefined;
}

/** A package's `icon()`: bare names resolve in `namespace` only. Generated into each package's `icons.gen.ts`. */
export function scopedIcon<Own extends string>(namespace: string) {
  return (name: Own | QualifiedIconName): IconRef => qualify(namespace, name) as IconRef;
}
