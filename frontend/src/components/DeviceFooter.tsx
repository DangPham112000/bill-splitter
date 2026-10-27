import { useState } from 'react';
import { deviceName, useDevice } from '../lib/deviceContext';
import { DeviceNicknameDialog } from './DeviceNicknameDialog';

/** "This device: iPhone · Safari", tap to change its nickname. */
export function DeviceFooter() {
  const { device } = useDevice();
  const [open, setOpen] = useState(false);
  if (!device) return null;

  return (
    <footer className="mx-auto max-w-xl px-4 pb-6 text-center text-xs text-slate-500">
      <button type="button" onClick={() => setOpen(true)} className="hover:underline">
        This device: {deviceName(device)}
      </button>
      {open && <DeviceNicknameDialog reason="settings" onClose={() => setOpen(false)} />}
    </footer>
  );
}
