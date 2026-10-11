import type { Op } from '../types';
import { registerOpFactory } from '../registry';

interface ChildOrderAdapter {
  getChildren?(parentId: string | null): string[];
  setChildOrder?(parentId: string | null, ids: string[]): void;
}

/** One parent's children, in order. */
export interface ChildOrder {
  parentId: string | null;
  ids: string[];
}

/** Arguments to {@link createSetChildOrderOp}: the whole child order to write, per parent. */
export interface SetChildOrderArgs {
  orders: ChildOrder[];
  label?: string;
  /** Each parent's order before the write. Filled in on first apply;
   *  arrives populated when the op is rebuilt from a snapshot. */
  prevOrders?: ChildOrder[];
}

/** Op: write each listed parent's whole child order; inverts to a write of the
 *  orders it replaced. Where `createMoveToIndexOp` keeps the moved ids in their
 *  current relative order, this states every position. */
export function createSetChildOrderOp(args: SetChildOrderArgs): Op {
  const { orders, label } = args;
  const argsForSerial: SetChildOrderArgs = { orders, label, prevOrders: args.prevOrders };
  let before: ChildOrder[] | null = args.prevOrders ?? null;
  return {
    name: 'setChildOrder',
    args: argsForSerial,
    label,
    apply(adapter) {
      const a = adapter as ChildOrderAdapter;
      if (!a.setChildOrder) return false;
      const { getChildren } = a;
      if (before === null && getChildren) {
        before = orders.map((o) => ({ parentId: o.parentId, ids: getChildren.call(a, o.parentId).slice() }));
        argsForSerial.prevOrders = before;
      }
      for (const o of orders) a.setChildOrder(o.parentId, o.ids.slice());
      return undefined;
    },
    invert: () => createSetChildOrderOp({ orders: before ?? [], label, prevOrders: orders }),
  };
}

registerOpFactory<SetChildOrderArgs>('setChildOrder', (args) => createSetChildOrderOp(args));
