import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation } from 'convex/react'
import { X } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AvatarFrame } from '../features/avatar/AvatarFrame'

type Props = {
  balance: number
  catalog: Array<{
    id: string
    name: string
    description: string
    rarity: 'common' | 'rare' | 'legendary' | 'ultimate'
    price: number
  }>
  ownedIds: string[]
  isAuthenticated: boolean
  canSignIn: boolean
  onSignIn: () => void
  onClose: () => void
}

const shopTabs = [
  { id: 'decorations', label: 'Décorations' },
  { id: 'pokemon', label: 'Pokémon', upcoming: true },
  { id: 'star-wars', label: 'Star Wars', upcoming: true },
] as const

type ShopTabId = (typeof shopTabs)[number]['id']

const rarityTiers = [
  { id: 'common', label: 'Communs' },
  { id: 'rare', label: 'Rares' },
  { id: 'legendary', label: 'Légendaires' },
  { id: 'ultimate', label: 'Ultime' },
] as const

export default function ModalShop({
  balance,
  catalog,
  ownedIds,
  isAuthenticated,
  canSignIn,
  onSignIn,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [activeTab, setActiveTab] = useState<ShopTabId>('decorations')
  const [buyingFrame, setBuyingFrame] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const formattedBalance = new Intl.NumberFormat('fr-FR').format(balance)
  const buyAvatarFrame = useMutation(api.user.mutations.buyAvatarFrame)

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

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )
    const currentIndex = tabs.indexOf(event.target as HTMLButtonElement)
    let nextIndex: number | undefined

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    }
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined) return

    event.preventDefault()
    tabs[nextIndex]?.focus()
    tabs[nextIndex]?.click()
  }

  async function purchaseFrame(frameId: string) {
    setBuyingFrame(frameId)
    setPurchaseError(null)
    try {
      await buyAvatarFrame({ frameId })
    } catch (error) {
      setPurchaseError(
        error instanceof Error ? error.message : 'Achat impossible pour le moment.',
      )
    } finally {
      setBuyingFrame(null)
    }
  }

  return (
    <dialog
      className='pp-modal pp-shop-modal'
      ref={dialog}
      aria-labelledby='shop-title'
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
    >
      <div className='pp-modal-content pp-shop-content'>
        <div className='pp-modal-heading pp-shop-toolbar'>
          <h2 id='shop-title'>Boutique</h2>
          <div className='pp-shop-toolbar-actions'>
            <div
              className='pp-shop-currency'
              role='img'
              aria-label={`${formattedBalance} Wikisous`}
            >
              <span className='pp-shop-coin' aria-hidden='true'>
                W
              </span>
              <span className='pp-shop-currency-value'>{formattedBalance}</span>
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
        </div>
        <div
          className='pp-shop-tabs'
          role='tablist'
          aria-label='Catégories de la boutique'
          onKeyDown={handleTabKeyDown}
        >
          {shopTabs.map((tab) => (
            <button
              key={tab.id}
              className='pp-shop-tab'
              id={`shop-tab-${tab.id}`}
              type='button'
              role='tab'
              aria-selected={activeTab === tab.id}
              aria-controls='shop-panel'
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {'upcoming' in tab && tab.upcoming && (
                <span className='pp-shop-tab-status'>Prochainement</span>
              )}
            </button>
          ))}
        </div>
        <div
          className={`pp-shop-panel${activeTab === 'decorations' ? ' pp-shop-panel--frames' : ''}`}
          id='shop-panel'
          role='tabpanel'
          aria-labelledby={`shop-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'decorations' ? (
            <div className='pp-frame-tiers'>
              {rarityTiers.map((tier) => {
                const tierFrames = catalog.filter(
                  (frame) => frame.rarity === tier.id,
                )
                if (!tierFrames.length) return null

                return (
                  <section className={`pp-frame-tier pp-frame-tier--${tier.id}`} key={tier.id}>
                    <div className='pp-frame-tier-heading'>
                      <h3>{tier.label}</h3>
                      <span>{tierFrames[0].price} Wikisous</span>
                    </div>
                    <div className='pp-frame-grid'>
                      {tierFrames.map((frame) => {
                        const isOwned = ownedIds.includes(frame.id)
                        const canAfford = balance >= frame.price
                        return (
                          <article
                            className={`pp-frame-card pp-frame-card--${frame.rarity}`}
                            key={frame.id}
                          >
                            <div className='pp-frame-preview'>
                              <AvatarFrame
                                frameId={frame.id}
                                className='pp-frame-avatar'
                              >
                                <span className='pp-frame-avatar-initial' aria-hidden='true'>
                                  A
                                </span>
                              </AvatarFrame>
                            </div>
                            <div className='pp-frame-copy'>
                              <strong>{frame.name}</strong>
                              <p>{frame.description}</p>
                              <span className='pp-frame-price'>
                                {frame.price} Wikisous
                              </span>
                            </div>
                            <button
                              className='pp-button pp-frame-action'
                              type='button'
                              disabled={
                                isOwned ||
                                (isAuthenticated && !canAfford) ||
                                (!isAuthenticated && !canSignIn) ||
                                buyingFrame !== null
                              }
                              onClick={() => {
                                if (isAuthenticated) {
                                  void purchaseFrame(frame.id)
                                } else {
                                  onSignIn()
                                }
                              }}
                            >
                              {isOwned
                                ? 'Possédé'
                                : buyingFrame === frame.id
                                  ? 'Achat...'
                                  : isAuthenticated
                                    ? canAfford
                                      ? 'Acheter'
                                      : 'Solde insuffisant'
                                    : 'Connexion requise'}
                            </button>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              {purchaseError && (
                <p className='pp-form-error pp-frame-error' role='alert'>
                  {purchaseError}
                </p>
              )}
            </div>
          ) : (
            <p className='pp-shop-coming'>
              Les articles {activeTab === 'pokemon' ? 'Pokémon' : 'Star Wars'}{' '}
              seront bientôt disponibles.
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
