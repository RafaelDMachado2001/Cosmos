import { useState } from 'react';

import styles from './Avatar.module.css';
import { initials } from '../../core/session';

export interface AvatarProps {
  readonly url: string | null;
  readonly name: string;
  readonly handle: string;
  readonly size: 'xs' | 'sm' | 'lg';
}

export function Avatar({ url, name, handle, size }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = url !== null && url !== failedUrl;

  return (
    <span className={styles.avatar} data-size={size} aria-hidden="true">
      {showImage ? (
        <img
          className={styles.image}
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => {
            setFailedUrl(url);
          }}
        />
      ) : (
        initials(name, handle)
      )}
    </span>
  );
}
