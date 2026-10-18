import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { parseIssueUrl } from './options'

type Props = {
  url: string | null
  onClose: () => void
  onSave: (url: string | null) => Promise<boolean>
}

export function ModalEditIssue({ url, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = value.trim()
    const parsed = trimmed ? parseIssueUrl(trimmed) : null
    if (trimmed && !parsed) {
      setError(
        'Saisis un lien GitHub valide, par exemple github.com/org/repo/issues/142.',
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (await onSave(parsed?.url ?? null)) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      className='pp-modal'
      ref={dialog}
      aria-labelledby='edit-issue-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <form className='pp-modal-content' onSubmit={submit}>
        <div className='pp-modal-heading'>
          <h2 id='edit-issue-title'>Issue GitHub</h2>
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
        <label className='pp-field'>
          <span>
            Lien de l’issue <span className='pp-optional'>(optionnel)</span>
          </span>
          <input
            autoFocus
            aria-label='Lien de l’issue GitHub'
            placeholder='github.com/org/repo/issues/142'
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        {error && (
          <p className='pp-form-error' role='alert'>
            {error}
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
          <button type='submit' className='pp-button' disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
