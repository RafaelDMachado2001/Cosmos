import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import styles from './AccountPage.module.css';
import { fill } from '../../core/format';
import { accountPath, homePath } from '../../core/routing';
import {
  DELETED_NOTICE_KEY,
  NAME_MAX_LENGTH,
  PROVIDERS,
  confirmsHandle,
  isHandleFormat,
  maskEmail,
} from '../../core/session';
import type { Member } from '../../core/session';
import { LOCALES } from '../../core/types';
import type { Locale } from '../../core/types';
import { ValidationError } from '../../data/http';
import { useStaticPage } from '../../hooks/useStaticPage';
import { useLocale } from '../../i18n/useLocale';
import { useSession } from '../../session/useSession';
import { useAnnounce } from '../Announcer/announce';
import { Avatar } from '../Avatar/Avatar';
import { Dialog } from '../Dialog/Dialog';
import { PageFrame } from '../PageFrame/PageFrame';

const PROVIDER_LABEL = { google: 'Google', github: 'GitHub' } as const;
const LOCALE_LABEL: Record<Locale, string> = { pt: 'Português', en: 'English' };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'rejected' | 'failed';
type FieldError = 'name' | 'handleFormat' | 'handleUnavailable';

function ProfileForm({ member }: { member: Member }) {
  const { t } = useLocale();
  const { update } = useSession();
  const announce = useAnnounce();
  const [name, setName] = useState(member.name);
  const [handle, setHandle] = useState(member.handle);
  const [preferred, setPreferred] = useState<Locale>(member.locale);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errors, setErrors] = useState<ReadonlySet<FieldError>>(new Set());

  const nameInvalid = errors.has('name');
  const handleError = errors.has('handleFormat')
    ? t.account.handleHint
    : errors.has('handleUnavailable')
      ? t.account.handleUnavailable
      : null;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = name.trim();
    const local = new Set<FieldError>();
    if (trimmed === '' || [...trimmed].length > NAME_MAX_LENGTH) local.add('name');
    if (!isHandleFormat(handle)) local.add('handleFormat');
    setErrors(local);
    if (local.size > 0) {
      setStatus('rejected');
      return;
    }

    setStatus('saving');
    update({ name: trimmed, handle, locale: preferred })
      .then((saved) => {
        setName(saved.name);
        setHandle(saved.handle);
        setStatus('saved');
        announce(t.account.saved);
      })
      .catch((error: unknown) => {
        if (error instanceof ValidationError) {
          const server = new Set<FieldError>();
          if ('name' in error.fields) server.add('name');
          if ('handle' in error.fields) server.add('handleUnavailable');
          setErrors(server);
          setStatus('rejected');
          return;
        }
        setStatus('failed');
      });
  };

  const saving = status === 'saving';
  const statusText =
    status === 'saved'
      ? `✓ ${t.account.saved}`
      : status === 'rejected'
        ? t.account.rejected
        : status === 'failed'
          ? t.account.failed
          : '';

  return (
    <form className={styles.form} noValidate aria-labelledby="perfil-titulo" onSubmit={onSubmit}>
      <div className={styles.profileTop}>
        <Avatar url={member.avatarUrl} name={member.name} handle={member.handle} size="lg" />
        <h2 id="perfil-titulo" className={styles.sectionTitle}>
          {t.account.profile}
        </h2>
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="perfil-nome" className={styles.label}>
            {t.account.name}
          </label>
          <span className={styles.counter} aria-hidden="true">
            {[...name].length}/{NAME_MAX_LENGTH}
          </span>
        </div>
        <input
          id="perfil-nome"
          className={styles.input}
          data-invalid={nameInvalid}
          value={name}
          maxLength={NAME_MAX_LENGTH}
          disabled={saving}
          autoComplete="name"
          aria-invalid={nameInvalid}
          {...(nameInvalid ? { 'aria-describedby': 'perfil-nome-erro' } : {})}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        {nameInvalid && (
          <span id="perfil-nome-erro" className={styles.error}>
            ! {t.account.nameInvalid}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="perfil-handle" className={styles.label}>
          {t.account.handle}
        </label>
        <div className={styles.handleBox} data-invalid={handleError !== null}>
          <span className={styles.at} aria-hidden="true">
            @
          </span>
          <input
            id="perfil-handle"
            className={styles.handleInput}
            value={handle}
            disabled={saving}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={handleError !== null}
            aria-describedby={
              handleError === null ? 'perfil-handle-regra' : 'perfil-handle-regra perfil-handle-erro'
            }
            onChange={(event) => {
              setHandle(event.target.value.toLowerCase());
            }}
          />
        </div>
        <span id="perfil-handle-regra" className={styles.hint}>
          {t.account.handleHint}
        </span>
        {handleError !== null && (
          <span id="perfil-handle-erro" className={styles.error}>
            ! {handleError}
          </span>
        )}
      </div>

      <fieldset className={styles.fieldset} disabled={saving}>
        <legend className={styles.label}>{t.account.language}</legend>
        <div className={styles.choices}>
          {LOCALES.map((option) => (
            <label key={option} className={styles.choice} data-checked={option === preferred}>
              <input
                type="radio"
                name="perfil-idioma"
                value={option}
                checked={option === preferred}
                onChange={() => {
                  setPreferred(option);
                }}
              />
              {LOCALE_LABEL[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? t.account.saving : t.account.save}
        </button>
        <span
          className={styles.status}
          data-tone={status === 'rejected' || status === 'failed' ? 'danger' : 'ok'}
          role="status"
        >
          {statusText}
        </span>
      </div>
    </form>
  );
}

function DeleteAccount({ member }: { member: Member }) {
  const { locale, t } = useLocale();
  const { remove } = useSession();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const confirmed = confirmsHandle(typed, member.handle);

  const close = (): void => {
    if (busy) return;
    setOpen(false);
    setTyped('');
    setFailed(false);
  };

  const onConfirm = (): void => {
    if (!confirmed || busy) return;
    setBusy(true);
    setFailed(false);
    remove()
      .then(() => {
        try {
          window.sessionStorage.setItem(DELETED_NOTICE_KEY, '1');
        } catch {
        }
        window.location.assign(homePath(locale));
      })
      .catch(() => {
        setBusy(false);
        setFailed(true);
      });
  };

  return (
    <section className={styles.danger} aria-labelledby="apagar-titulo">
      <h2 id="apagar-titulo" className={styles.dangerTitle}>
        {t.account.deleteTitle}
      </h2>
      <p className={styles.paragraph}>{t.account.deleteBody}</p>
      <button
        type="button"
        className={styles.dangerButton}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t.account.deleteButton}
      </button>

      {open && (
        <Dialog
          role="alertdialog"
          labelledBy={titleId}
          describedBy={bodyId}
          tone="danger"
          width="danger"
          initialFocusRef={inputRef}
          onClose={close}
        >
          <h2 id={titleId} className={styles.dialogTitle}>
            {t.account.deleteDialogTitle}
          </h2>
          <p id={bodyId} className={styles.paragraph}>
            {t.account.deleteBody}
          </p>
          <label htmlFor="apagar-confirma" className={styles.confirmLabel}>
            {fill(t.account.deletePrompt, { handle: member.handle })}
          </label>
          <input
            ref={inputRef}
            id="apagar-confirma"
            className={styles.confirmInput}
            value={typed}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            {...(failed ? { 'aria-describedby': 'apagar-erro' } : {})}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onConfirm();
            }}
          />
          {failed && (
            <span id="apagar-erro" className={styles.error} role="alert">
              {t.account.deleteFailed}
            </span>
          )}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondary} onClick={close}>
              {t.account.cancel}
            </button>
            <button
              type="button"
              className={styles.dangerConfirm}
              disabled={!confirmed || busy}
              onClick={onConfirm}
            >
              {t.account.deleteButton}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function MemberAccount({ member, exportUrl }: { member: Member; exportUrl: string | null }) {
  const { t } = useLocale();

  return (
    <>
      <ProfileForm member={member} />

      <section className={styles.section} aria-labelledby="ligadas-titulo">
        <h2 id="ligadas-titulo" className={styles.sectionTitle}>
          {t.account.linked}
        </h2>
        <ul className={styles.providers}>
          {PROVIDERS.map((provider) => {
            const linked = member.providers.includes(provider);
            return (
              <li key={provider} className={styles.provider}>
                <div className={styles.providerText}>
                  <span className={styles.providerName}>{PROVIDER_LABEL[provider]}</span>
                  <span className={styles.hint}>
                    {linked && member.email !== null ? maskEmail(member.email) : '—'}
                  </span>
                </div>
                <span className={styles.providerStatus} data-linked={linked}>
                  {linked ? t.account.linkedOn : t.account.linkedOff}
                </span>
              </li>
            );
          })}
        </ul>
        <p className={styles.hint}>{t.account.linkedHint}</p>
      </section>

      {exportUrl !== null && (
        <section className={styles.section} aria-labelledby="dados-titulo">
          <h2 id="dados-titulo" className={styles.sectionTitle}>
            {t.account.yourData}
          </h2>
          <p className={styles.paragraph}>{t.account.dataHint}</p>
          <a className={styles.download} href={exportUrl} download>
            {t.account.download}
            <span aria-hidden="true"> ↓</span>
          </a>
        </section>
      )}

      <DeleteAccount member={member} />
    </>
  );
}

export interface AccountPageProps {
  readonly otherLocaleHref?: string;
}

export function AccountPage({ otherLocaleHref }: AccountPageProps) {
  const { locale, t } = useLocale();
  const { state, exportUrl, openLogin, retry } = useSession();
  useStaticPage(accountPath, t.account.myAccount);

  return (
    <PageFrame width="account" {...(otherLocaleHref === undefined ? {} : { otherLocaleHref })}>
      <div className={styles.stack}>
        <div className={styles.heading}>
          <p className={styles.kicker}>{t.account.kicker}</p>
          <h1 className={styles.title}>{t.account.myAccount}</h1>
        </div>

        {state.kind === 'loading' && (
          <div className={styles.skeletons} aria-busy="true">
            <span className="visually-hidden">{t.account.loading}</span>
            <div className={styles.skeletonShort} />
            <div className={styles.skeletonTall} />
          </div>
        )}

        {state.kind === 'error' && (
          <div className={styles.unavailable} role="status">
            <span>{t.account.unavailable}</span>
            <button type="button" className={styles.textButton} onClick={retry}>
              {t.account.retry}
            </button>
          </div>
        )}

        {state.kind === 'anonymous' && (
          <div className={styles.invite}>
            <span>{t.account.anonymous}</span>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                openLogin(accountPath(locale));
              }}
            >
              {t.account.signIn}
            </button>
          </div>
        )}

        {state.kind === 'member' && (
          <MemberAccount key={state.member.id} member={state.member} exportUrl={exportUrl} />
        )}
      </div>
    </PageFrame>
  );
}
