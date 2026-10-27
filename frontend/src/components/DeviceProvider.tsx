import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation } from '@apollo/client/react';
import { REGISTER_DEVICE, SET_DEVICE_NICKNAME, type ThisDevice } from '../graphql/device';
import { DeviceContext } from '../lib/deviceContext';
import { deviceLabel, getDeviceId, setDeviceId } from '../lib/device';

/** Registers this browser once per page load and shares the result through useDevice(). */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<ThisDevice | null>(null);
  const [register] = useMutation<{ registerDevice: ThisDevice }>(REGISTER_DEVICE);
  const [saveNickname] = useMutation<{ setDeviceNickname: ThisDevice }>(SET_DEVICE_NICKNAME);

  useEffect(() => {
    let cancelled = false;
    register({ variables: { deviceId: getDeviceId(), label: deviceLabel() } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        // The server may hand back an older id (localStorage was cleared, the cookie remembered).
        setDeviceId(data.registerDevice.deviceId);
        setDevice(data.registerDevice);
      })
      .catch((error: unknown) => console.warn('Could not register this device', error));
    return () => {
      cancelled = true;
    };
  }, [register]);

  const setNickname = useCallback(
    async (nickname: string) => {
      const { data } = await saveNickname({ variables: { nickname: nickname.trim() || null } });
      if (!data) throw new Error('Could not save the nickname');
      setDevice(data.setDeviceNickname);
      return data.setDeviceNickname;
    },
    [saveNickname],
  );

  const value = useMemo(() => ({ device, setNickname }), [device, setNickname]);
  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}
