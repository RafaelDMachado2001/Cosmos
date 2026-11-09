import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import styles from './AccountSlot.module.css';
import { accountPath } from '../../core/routing';
import { displayName } from '../../core/session';
import type { Member } from '../../core/session';
import { useLocale } from '../../i18n/useLocale';
import { useSession } from '../../session/useSession';
import { Avatar } from '../Avatar/Avatar';

function PersonIcon() {
  return (
    <svg className={styles.person} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="5.5" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MemberMenu({ member }: { member: Member }) {
  const { locale, t } = useLocale();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = (): HTMLElement[] => [
    ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (next: number): void => {
      event.preventDefault();
      list[(next + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.member}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.memberButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`@${member.handle} · ${t.account.menu}`}
        onClick={() => {
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Avatar url={member.avatarUrl} name={member.name} handle={member.handle} size="xs" />
        <span className={styles.handle}>@{member.handle}</span>
        <svg className={styles.chevron} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label={t.account.menu}
          onKeyDown={onMenuKeyDown}
        >
          <div className={styles.who}>
            <span className={styles.whoName}>{displayName(member)}</span>
            <span className={styles.whoHandle}>@{member.handle}</span>
          </div>
          <a className={styles.item} role="menuitem" tabIndex={-1} href={accountPath(locale)}>
            {t.account.myAccount}
          </a>
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              close(true);
              void signOut().catch(() => undefined);
            }}
          >
            {t.account.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

export function AccountSlot() {
  const { t } = useLocale();
  const { state, openLogin } = useSession();

  return (
    <div className={styles.slot} data-state={state.kind}>
      {state.kind === 'loading' && (
        <div className={styles.skeleton} aria-busy="true">
          <span className="visually-hidden">{t.account.loading}</span>
        </div>
      )}
      {state.kind === 'anonymous' && (
        <button
          type="button"
          className={styles.signIn}
          onClick={() => {
            openLogin();
          }}
        >
          <PersonIcon />
          <span className={styles.signInText}>{t.account.signIn}</span>
        </button>
      )}
      {state.kind === 'member' && <MemberMenu member={state.member} />}
    </div>
  );
}
