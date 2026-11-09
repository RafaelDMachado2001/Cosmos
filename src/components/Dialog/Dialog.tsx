import { useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import styles from './Dialog.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  readonly role?: 'dialog' | 'alertdialog';
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly tone?: 'default' | 'danger';
  readonly width: 'login' | 'confirm' | 'danger';
  readonly initialFocusRef?: RefObject<HTMLElement>;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

export function Dialog({
  role = 'dialog',
  labelledBy,
  describedBy,
  tone = 'default',
  width,
  initialFocusRef,
  onClose,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useLayoutEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return;
    (initialFocusRef?.current ?? focusables(panel)[0] ?? panel).focus();
  }, [initialFocusRef]);

  useEffect(
    () => () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    },
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const items = focusables(panel);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (!panel.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={styles.scrim}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        data-tone={tone}
        data-width={width}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
