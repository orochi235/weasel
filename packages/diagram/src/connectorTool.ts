/**
 * The connector tool: drag from one shape to another to join them.
 *
 * The ambient connect starts only on a port. This tool starts from a shape's
 * body too, and lands on one, so an edge drawn with it glues to the shapes
 * rather than to a port on each and picks its sides as they move.
 */
import { useMemo } from 'react';
import { defineTool, type Tool } from '@weasel-js/core';
import { createConnectAction, type ConnectActionOptions } from './connect';

export const CONNECTOR_TOOL_ID = 'diagram.connector';
export const CONNECTOR_ACTION_ID = 'diagram.connectorDraw';

/** The connector tool's definition, outside React. `id`, `startFrom` and
 *  `bodies` are the tool's own. */
export function connectorTool<TPose>(opts: ConnectActionOptions<TPose>): Tool {
  return defineTool({
    id: CONNECTOR_TOOL_ID,
    hookName: 'useConnectorTool',
    cursor: 'crosshair',
    presentation: { label: 'Connector', group: 'draw' },
    actions: [createConnectAction({ ...opts, id: CONNECTOR_ACTION_ID, startFrom: 'body', bodies: true })],
    bindings: [{ spec: { kind: 'drag' }, actionId: CONNECTOR_ACTION_ID }],
  });
}

/** {@link connectorTool}, rebuilt when one of its options changes rather than
 *  when the bag holding them does. */
export function useConnectorTool<TPose>(opts: ConnectActionOptions<TPose>): Tool {
  const { participants, read, geometry, canConnect, showsPort, snapRadius, router, routers, commit } = opts;
  return useMemo(
    () => connectorTool(opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `opts` is the fields listed
    [participants, read, geometry, canConnect, showsPort, snapRadius, router, routers, commit],
  );
}
