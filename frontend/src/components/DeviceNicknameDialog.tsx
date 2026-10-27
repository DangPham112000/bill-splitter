import { useState, type FormEvent } from 'react';
import { useDevice } from '../lib/deviceContext';

type Props = {
  onClose: () => void;
  /**
   * "join": asked right after someone first joins a splitter on this device (DAN-41), with a Skip
   * button. "settings": opened from the footer to change the nickname later.
   */
  reason: 'join' | 'settings';
};

/** Name this device, e.g. "Dang's phone". Shown when someone tries to edit its entries elsewhere. */
export function DeviceNicknameDialog({ onClose, reason }: Props) {
  const { device, setNickname } = useDevice();
  const [value, setValue] = useState(device?.nickname ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setNickname(value);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-nickname-title"
    >
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl bg-white p-5 shadow-lg"
      >
        <div className="flex flex-col gap-1">
          <h2 id="device-nickname-title" className="text-lg font-semibold">
            {reason === 'join' ? 'Name this device' : 'This device'}
          </h2>
          <p className="text-sm text-slate-600">
            {device ? <strong>{device.label}</strong> : 'This browser'}. What you add here can only
            be edited from this device, so give it a name your group will recognise.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nickname</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={50}
            placeholder="e.g. Dang's phone"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <p className="text-xs text-slate-500">
          Private browsing, clearing this site&apos;s data, or opening the link in another app (such
          as Zalo or Facebook) counts as a new device. Entries from the old one become read-only
          there; a treasurer or the admin can still change them.
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100"
          >
            {reason === 'join' ? 'Skip' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving || !device}
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
