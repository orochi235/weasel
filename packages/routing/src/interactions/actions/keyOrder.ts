/**
 * The scopes pressed or scrolled in on the page, across every tree, oldest
 * first: a key that reaches the page goes to the last. A scope leaves the
 * list when it unmounts or its last canvas does, so the keys fall back to the
 * one used before it rather than to nothing.
 */
const order: object[] = [];

/** Put `holder` last, so it takes the keys. */
export function takeKeys(holder: object): void {
  dropKeysOf(holder);
  order.push(holder);
}

/** Whether `holder` is the scope the keys go to. */
export function holdsKeysNow(holder: object): boolean {
  return order.at(-1) === holder;
}

/** Take `holder` out of the list, wherever it sits. */
export function dropKeysOf(holder: object): void {
  const i = order.indexOf(holder);
  if (i !== -1) order.splice(i, 1);
}
