import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// How long a tapped tooltip stays on a phone, where there is no "mouse left" to close it.
const TAP_HIDE_MS = 4000;
// Space kept between the tooltip and the screen edge.
const EDGE = 8;

type Props = {
  /** Why the control is disabled. Leave empty when it is enabled, or only busy ("Saving…"). */
  reason?: string | false | null;
  children: ReactNode;
  className?: string;
};

/**
 * Explains why a control is disabled: shown on hover with a mouse, on tap on a touch screen, and
 * on keyboard focus. Ecosystem rule (ecosystem-knowledge ui-guidelines.md): a control that is
 * disabled for a reason the user can act on always says why.
 *
 * A disabled button gets no pointer events, so the wrapper takes them instead.
 */
export function DisabledReason({ reason, children, className = '' }: Props) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef<string>('mouse');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(
    null,
  );

  const hide = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    setOpen(false);
    setPosition(null);
  }, []);

  // Place it above the control, or below when there is no room, and keep it on screen.
  useLayoutEffect(() => {
    if (!open || !wrapperRef.current || !tipRef.current) return;
    const target = wrapperRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const centered = target.left + target.width / 2 - tip.width / 2;
    const left = Math.min(Math.max(centered, EDGE), window.innerWidth - tip.width - EDGE);
    const below = target.top - tip.height - EDGE < 0;
    const top = below ? target.bottom + 6 : target.top - tip.height - 6;
    setPosition({ left, top, below });
  }, [open]);

  // Close on a tap elsewhere, Escape, or scrolling, like a native tooltip.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) hide();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  if (!reason) return <>{children}</>;

  const show = () => {
    window.clearTimeout(hideTimer.current);
    setOpen(true);
  };

  return (
    <span
      ref={wrapperRef}
      // Focusable, so keyboard users can reach the reason too.
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      className={`relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&>*]:pointer-events-none ${className || 'inline-flex'}`}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
      }}
      onClick={() => {
        // A mouse click keeps the hover tooltip open.
        if (lastPointer.current === 'mouse') return show();
        // A tap on a phone: toggle, and close on its own after a while.
        if (open) return hide();
        show();
        hideTimer.current = window.setTimeout(hide, TAP_HIDE_MS);
      }}
      // Keyboard focus only: a tap also focuses, and its click already toggles the tooltip.
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && show()}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{
            left: position?.left ?? 0,
            top: position?.top ?? 0,
            visibility: position ? 'visible' : 'hidden',
          }}
          className="fixed z-50 w-max max-w-64 rounded-xl bg-foreground/90 px-3 py-2 backdrop-blur-md text-left text-xs leading-snug font-normal text-background shadow-lg"
        >
          {reason}
        </span>
      )}
    </span>
  );
}
