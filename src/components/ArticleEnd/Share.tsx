import { useEffect, useRef, useState } from 'react';

import styles from './ArticleEnd.module.css';
import { shareLinks } from '../../core/community';
import { useLocale } from '../../i18n/useLocale';
import { useAnnounce } from '../Announcer/announce';

const COPIED_MS = 2400;

const COPY_ICON = 'M6 3h7v7M13 3 7 9M10 9.5V13H3V6h3.5';
const CHECK_ICON = 'M3.5 8.5l3 3 6-7';
const SHARE_ICON = 'M8 10V1.5M4.8 4.6 8 1.5l3.2 3.1M3 8v6h10V8';

function Icon({ d }: { d: string }) {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function canShareNatively(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function Share({ url, title }: { url: string; title: string }) {
  const { t } = useLocale();
  const announce = useAnnounce();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const [native] = useState(canShareNatively);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  if (native) {
    return (
      <button
        type="button"
        className={styles.nativeShare}
        onClick={() => {
          navigator.share({ url, title }).catch(() => undefined);
        }}
      >
        <Icon d={SHARE_ICON} />
        {t.share.native}
      </button>
    );
  }

  const copy = (): void => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        window.clearTimeout(timerRef.current);
        setCopied(true);
        announce(t.share.copiedSay);
        timerRef.current = window.setTimeout(() => {
          setCopied(false);
        }, COPIED_MS);
      })
      .catch(() => undefined);
  };

  const label = { linkedin: 'LinkedIn', x: 'X', email: t.share.email } as const;

  return (
    <div className={styles.share}>
      <span className={styles.shareLabel}>{t.share.label}</span>
      <button
        type="button"
        className={styles.shareButton}
        data-kind="copy"
        data-copied={copied}
        onClick={copy}
      >
        <Icon d={copied ? CHECK_ICON : COPY_ICON} />
        {copied ? t.share.copied : t.share.copyLink}
      </button>
      {shareLinks(url, title).map((link) => (
        <a
          key={link.id}
          className={styles.shareButton}
          href={link.href}
          {...(link.id === 'email'
            ? { 'aria-label': t.share.email }
            : {
                'aria-label': `${t.share.shareOn} ${label[link.id]}`,
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
        >
          {label[link.id]}
        </a>
      ))}
    </div>
  );
}
