import { icon } from '../icons.gen';
import type { StencilGroup } from '../diagramTypes/types';
import { DEVICE_SIZE } from '../outlines/network';
import type { DiagramStencil } from '../stencil';

/** Network devices, each labeled under its drawing. A database and a cloud wear the general figures, with their labels inside. */
export const NETWORK_STENCILS: readonly DiagramStencil[] = [
  { id: 'server', label: 'Server', outline: 'server', size: DEVICE_SIZE, icon: icon('server') },
  { id: 'database', label: 'Database', outline: 'cylinder', size: { width: 72, height: 84 }, icon: icon('database') },
  { id: 'cloud', label: 'Cloud', outline: 'cloud', size: { width: 120, height: 80 }, icon: icon('cloud') },
  { id: 'router', label: 'Router', outline: 'router', size: DEVICE_SIZE, icon: icon('router') },
  { id: 'switch', label: 'Switch', outline: 'switch', size: DEVICE_SIZE, icon: icon('switch') },
  { id: 'firewall', label: 'Firewall', outline: 'firewall', size: DEVICE_SIZE, icon: icon('firewall') },
  { id: 'laptop', label: 'Laptop', outline: 'laptop', size: DEVICE_SIZE, icon: icon('laptop') },
  { id: 'desktop', label: 'Desktop', outline: 'desktop', size: DEVICE_SIZE, icon: icon('desktop') },
  { id: 'phone', label: 'Phone', outline: 'phone', size: DEVICE_SIZE, icon: icon('phone') },
  { id: 'printer', label: 'Printer', outline: 'printer', size: DEVICE_SIZE, icon: icon('printer') },
  { id: 'user', label: 'User', outline: 'user', size: DEVICE_SIZE, icon: icon('user') },
  { id: 'internet', label: 'Internet', outline: 'globe', size: DEVICE_SIZE, icon: icon('internet') },
];

/** The network devices as a stencil group. */
export const NETWORK_GROUP: StencilGroup = { id: 'network', label: 'Network', stencils: NETWORK_STENCILS };
