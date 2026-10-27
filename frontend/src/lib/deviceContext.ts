import { createContext, useContext } from 'react';
import type { ThisDevice } from '../graphql/device';

export type DeviceState = {
  /** Null until this browser is registered (one request after the page loads), or if it failed. */
  device: ThisDevice | null;
  /** Set or clear this device's nickname; resolves with the updated device. */
  setNickname: (nickname: string) => Promise<ThisDevice>;
};

export const DeviceContext = createContext<DeviceState | null>(null);

/** This browser as the server knows it. Needs <DeviceProvider>. */
export function useDevice(): DeviceState {
  const state = useContext(DeviceContext);
  if (!state) throw new Error('useDevice needs <DeviceProvider>');
  return state;
}

/** How a device is named to people: the nickname with the label, or just the label. */
export const deviceName = (device: Pick<ThisDevice, 'label' | 'nickname'>) =>
  device.nickname ? `${device.label} ("${device.nickname}")` : device.label;
