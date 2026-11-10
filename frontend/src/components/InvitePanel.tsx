import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { QRCodeSVG } from 'qrcode.react';
import { REGENERATE_INVITE_TOKEN, SET_JOINING_ENABLED, joinLink } from '../graphql/splitters';
import { btn, inputClass } from '../lib/styles';
import { Icon } from './ui';

type Props = {
  splitterId: string;
  splitterName: string;
  token: string;
  joiningEnabled: boolean;
};

const buttonClass = `${btn.secondary} px-3 py-1.5 text-sm`;

/** The admin's join link: copy, share to Zalo or Messenger, QR code, regenerate, turn off (DAN-36). */
export function InvitePanel({ splitterId, splitterName, token, joiningEnabled }: Props) {
  const link = joinLink(token);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [regenerate, regenerating] = useMutation(REGENERATE_INVITE_TOKEN);
  const [setJoining, settingJoining] = useMutation(SET_JOINING_ENABLED);
  const error = regenerating.error ?? settingJoining.error;
  // Phones have the share sheet; most desktop browsers don't.
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. not HTTPS): the link is still selectable.
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: splitterName,
        text: `Join "${splitterName}" on Bill Splitter to add what you paid:`,
        url: link,
      });
    } catch {
      // Closing the share sheet rejects too; nothing to do.
    }
  };

  const makeNewLink = () => {
    const ok = window.confirm(
      'Make a new link? The current link stops working right away. People who already joined stay in.',
    );
    if (ok) regenerate({ variables: { id: splitterId } }).catch(() => {});
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary-soft p-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-primary-soft-foreground">
          <Icon name="share" className="h-4 w-4" />
          Invite people
        </h2>
        <label className="flex items-center gap-2 text-sm text-primary-soft-foreground">
          <input
            type="checkbox"
            checked={joiningEnabled}
            disabled={settingJoining.loading}
            onChange={(e) =>
              setJoining({ variables: { id: splitterId, enabled: e.target.checked } }).catch(
                () => {},
              )
            }
            className="h-4 w-4 accent-primary"
          />
          Joining on
        </label>
      </div>

      {joiningEnabled ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label="Invite link"
              onFocus={(e) => e.target.select()}
              className={`${inputClass} min-w-0 flex-1 py-2 text-sm`}
            />
            <button type="button" onClick={copy} className={`${btn.primary} px-3 py-2 text-sm`}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {canShare && (
              <button type="button" onClick={share} className={buttonClass}>
                Share…
              </button>
            )}
            <button type="button" onClick={() => setShowQr(true)} className={buttonClass}>
              QR code
            </button>
            <button
              type="button"
              onClick={makeNewLink}
              disabled={regenerating.loading}
              className={buttonClass}
            >
              {regenerating.loading ? 'Making a new link…' : 'New link'}
            </button>
          </div>
          <p className="text-xs text-primary-soft-foreground/80">
            Anyone with this link can join. Make a new link if it reached the wrong people.
          </p>
        </>
      ) : (
        <p className="text-sm text-primary-soft-foreground">
          Joining is off: the link opens but nobody new can join. Members already in are not
          affected.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {showQr && <QrDialog link={link} name={splitterName} onClose={() => setShowQr(false)} />}
    </section>
  );
}

/** Full-screen QR code, big enough to scan across the table. */
function QrDialog({ link, name, onClose }: { link: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A portal, so a sticky parent (the desktop side column) cannot trap it under other parts.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`QR code to join ${name}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-card p-6 text-center shadow-xl"
      >
        <h2 className="text-lg font-semibold break-words">{name}</h2>
        <div className="rounded-2xl bg-white p-3">
          <QRCodeSVG value={link} size={512} marginSize={1} className="h-auto w-full max-w-72" />
        </div>
        <p className="text-sm text-muted-foreground">Scan with the phone camera or Zalo to join.</p>
        <button type="button" onClick={onClose} className={`${btn.secondary} w-full`}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
