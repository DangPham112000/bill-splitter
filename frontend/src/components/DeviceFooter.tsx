import { useState } from 'react';
import { deviceName, useDevice } from '../lib/deviceContext';
import { DeviceNicknameDialog } from './DeviceNicknameDialog';
import { Icon } from './ui';

/** "This device: iPhone · Safari", tap to change its nickname. */
export function DeviceFooter() {
  const { device } = useDevice();
  const [open, setOpen] = useState(false);
  if (!device) return null;

  return (
    <footer className="flex justify-center text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-muted hover:text-foreground"
      >
        <Icon name="device" className="h-4 w-4 shrink-0" />
        <span className="truncate">This device: {deviceName(device)}</span>
      </button>
      {open && <DeviceNicknameDialog reason="settings" onClose={() => setOpen(false)} />}
    </footer>
  );
}
