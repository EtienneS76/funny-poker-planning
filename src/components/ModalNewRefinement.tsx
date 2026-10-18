import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, GitBranch, Link, X } from 'lucide-react'
import type { AccountState } from '../features/auth/useAccount'
import {
  parseIssueUrl,
  sizings,
  upcomingThemes,
  type RefinementDraft,
} from '../features/refinement/options'

type Props = {
  account: AccountState
  onClose: () => void
  onSubmit: (draft: RefinementDraft, creatorName: string) => void
}

export default function ModalNewRefinement({
  account,
  onClose,
  onSubmit,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [guestName, setGuestName] = useState(account.guestName)
  const [sizing, setSizing] = useState<RefinementDraft['sizing']>('fib')
  const [issueInput, setIssueInput] = useState('')
  const [issue, setIssue] = useState<ReturnType<typeof parseIssueUrl>>(null)
  const [funInteractionsEnabled, setFunInteractionsEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedSizing = sizings.find((option) => option.id === sizing)!

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  function linkIssue() {
    const linked = parseIssueUrl(issueInput.trim())
    if (!linked) {
      setError(
        'Saisis un lien GitHub valide, par exemple github.com/org/repo/issues/142.',
      )
      return
    }
    setIssue(linked)
    setError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account.isAuthenticated && !guestName.trim()) {
      setError('Choisis un pseudo pour rejoindre la salle.')
      return
    }
    if (account.isAuthenticated && issueInput.trim() && !issue) {
      setError('Lie cette issue ou efface son lien avant de continuer.')
      return
    }
    onSubmit(
      {
        sizing,
        issueUrl: account.isAuthenticated ? (issue?.url ?? null) : null,
        funInteractionsEnabled,
      },
      account.isAuthenticated
        ? (account.user?.username ?? account.guestName)
        : guestName.trim(),
    )
  }

  return (
    <dialog
      className='pp-modal'
      ref={dialog}
      aria-labelledby='refinement-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <form className='pp-modal-content' onSubmit={submit}>
        <div className='pp-modal-heading'>
          <h2 id='refinement-title'>Nouvelle partie</h2>
          <button
            className='pp-icon-button'
            type='button'
            aria-label='Fermer'
            title='Fermer'
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {!account.isAuthenticated && (
          <label className='pp-field'>
            <span>Pseudo</span>
            <input
              required
              maxLength={36}
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
            />
          </label>
        )}

        <fieldset className='pp-fieldset'>
          <legend>Mode de jeu</legend>
          <div className='universe-grid universe-grid--classic'>
            <label className='universe-option universe-option--classic'>
              <input
                type='radio'
                name='universe'
                value='classic'
                checked
                readOnly
              />
              <span className='universe-swatches' aria-hidden='true'>
                <span />
                <span />
              </span>
              <span>Poker planning classique</span>
              <Check className='universe-check' size={16} aria-hidden='true' />
            </label>
          </div>
        </fieldset>

        <fieldset className='pp-fieldset'>
          <legend>Thèmes</legend>
          <div className='universe-grid'>
            {upcomingThemes.map((theme) => (
              <label
                key={theme.id}
                className={`universe-option universe-option--${theme.id} universe-option--upcoming`}
                aria-disabled='true'
              >
                <input type='radio' name='universe' value={theme.id} disabled />
                <span className='universe-swatches' aria-hidden='true'>
                  <span />
                  <span />
                </span>
                <span>{theme.label}</span>
                <span className='universe-coming-soon'>Prochainement</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className='pp-fieldset'>
          <legend>Sizing</legend>
          <div className='sizing-options'>
            {sizings.map((option) => (
              <label className='sizing-option' key={option.id}>
                <input
                  type='radio'
                  name='sizing'
                  checked={sizing === option.id}
                  onChange={() => setSizing(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className='sizing-preview' aria-live='polite'>
            {selectedSizing.cards.join(' · ')}
          </p>
        </fieldset>

        <div className='pp-field'>
          <span>
            Issue GitHub <span className='pp-optional'>(optionnel)</span>
          </span>
          {!account.isAuthenticated ? (
            <button
              type='button'
              className='pp-connect-issue'
              disabled={
                account.loading ||
                account.pending ||
                account.configured !== true
              }
              onClick={account.signIn}
            >
              <GitBranch size={18} aria-hidden='true' />
              {account.pending
                ? 'Connexion...'
                : 'Se connecter avec GitHub pour lier une issue'}
            </button>
          ) : issue ? (
            <div className='linked-issue'>
              <a href={issue.url} target='_blank' rel='noopener noreferrer'>
                <Link size={16} aria-hidden='true' />
                {issue.label}
              </a>
              <button
                className='pp-icon-button'
                type='button'
                aria-label='Retirer l’issue'
                title='Retirer l’issue'
                onClick={() => {
                  setIssue(null)
                  setIssueInput('')
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className='pp-issue-input'>
              <input
                aria-label='Lien de l’issue GitHub'
                placeholder='github.com/org/repo/issues/142'
                value={issueInput}
                onChange={(event) => setIssueInput(event.target.value)}
              />
              <button
                type='button'
                className='pp-button pp-button--small'
                onClick={linkIssue}
              >
                Lier
              </button>
            </div>
          )}
        </div>

        <label className='pp-room-setting-option'>
          <span>
            <strong>Interactions fun</strong>
            <small>Autoriser les lancers d’émojis pendant la partie</small>
          </span>
          <span className='pp-switch'>
            <input
              className='pp-switch-input'
              type='checkbox'
              role='switch'
              checked={funInteractionsEnabled}
              onChange={(event) =>
                setFunInteractionsEnabled(event.target.checked)
              }
            />
            <span className='pp-switch-track' aria-hidden='true' />
          </span>
        </label>

        {(error || account.error) && (
          <p className='pp-form-error' role='alert'>
            {error ?? account.error}
          </p>
        )}

        <div className='pp-modal-actions'>
          <button
            type='button'
            className='pp-button pp-button--secondary'
            onClick={onClose}
          >
            Annuler
          </button>
          <button type='submit' className='pp-button'>
            Préparer la salle
          </button>
        </div>
      </form>
    </dialog>
  )
}
