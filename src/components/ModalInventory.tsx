import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AvatarFrame } from '../features/avatar/AvatarFrame'
import { useAccount } from '../features/auth/useAccount'

type Props = {
  onClose: () => void
}

export default function ModalInventory({ onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const account = useAccount()
  const data = useQuery(api.user.queries.shopData, {})
  const equipAvatarFrame = useMutation(api.user.mutations.equipAvatarFrame)
  const [pendingFrame, setPendingFrame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const displayName =
    account.profile?.displayName ?? account.user?.username ?? 'Joueur'
  const ownedFrames = data?.catalog.filter((frame) =>
    data.ownedIds.includes(frame.id),
  )

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

  async function setEquippedFrame(frameId: string | null) {
    setPendingFrame(frameId ?? 'none')
    setError(null)
    try {
      await equipAvatarFrame({ frameId })
    } catch (equipError) {
      setError(
        equipError instanceof Error
          ? equipError.message
          : 'Impossible de modifier ton cadre.',
      )
    } finally {
      setPendingFrame(null)
    }
  }

  return (
    <dialog
      className='pp-modal pp-inventory-modal'
      ref={dialog}
      aria-labelledby='inventory-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className='pp-modal-content pp-inventory-content'>
        <div className='pp-modal-heading'>
          <div>
            <span className='pp-inventory-kicker'>
              Profil de @{displayName}
            </span>
            <h2 id='inventory-title'>Inventaire</h2>
          </div>
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
        <section aria-label='Cadres possédés'>
          {data === undefined ? (
            <p className='pp-inventory-empty' role='status'>
              Chargement de ton inventaire…
            </p>
          ) : ownedFrames?.length ? (
            <div className='pp-frame-grid'>
              {ownedFrames.map((frame) => {
                const isEquipped = data.equippedId === frame.id
                return (
                  <article className='pp-frame-card' key={frame.id}>
                    <div className='pp-frame-preview'>
                      <AvatarFrame
                        frameId={frame.id}
                        className='pp-frame-avatar'
                      >
                        <span
                          className='pp-frame-avatar-initial'
                          aria-hidden='true'
                        >
                          {displayName.slice(0, 1).toUpperCase()}
                        </span>
                        {account.user?.avatarUrl && (
                          <img
                            className='pp-frame-avatar-image'
                            src={account.user.avatarUrl}
                            alt=''
                          />
                        )}
                      </AvatarFrame>
                    </div>
                    <div className='pp-frame-copy'>
                      <strong>{frame.name}</strong>
                      <p>{frame.description}</p>
                    </div>
                    {isEquipped ? (
                      <button
                        className='pp-button pp-button--secondary pp-frame-action'
                        type='button'
                        disabled={pendingFrame !== null}
                        onClick={() => void setEquippedFrame(null)}
                      >
                        {pendingFrame === 'none' ? 'Retrait...' : 'Retirer'}
                      </button>
                    ) : (
                      <button
                        className='pp-button pp-frame-action'
                        type='button'
                        disabled={pendingFrame !== null}
                        onClick={() => void setEquippedFrame(frame.id)}
                      >
                        {pendingFrame === frame.id
                          ? 'Équipement...'
                          : 'Équiper'}
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className='pp-inventory-empty'>
              Aucun cadre pour le moment. Tes prochains cadres apparaîtront ici.
            </p>
          )}
        </section>
        {error && (
          <p className='pp-form-error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </dialog>
  )
}
