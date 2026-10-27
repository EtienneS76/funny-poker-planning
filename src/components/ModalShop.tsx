import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation } from 'convex/react'
import { Hexagon, Info, X } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AvatarFrame } from '../features/avatar/AvatarFrame'
import { CardDesignPreview } from './CardDesignPreview'
import { useAppSnackbar } from './AppSnackbar'

type Props = {
  initialTab: 'decorations' | 'pokemon' | 'star-wars' | 'card-designs'
  balance: number
  catalog: Array<{
    id: string
    name: string
    description: string
    rarity: 'common' | 'rare' | 'legendary' | 'ultimate'
    price: number
  }>
  cardDesigns: Array<{
    id: string
    name: string
    description: string
    rarity: 'rare' | 'epic' | 'legendary'
    price: number
    symbol: string
  }>
  ownedCardDesignIds: string[]
  equippedCardDesignId: string | null
  ownedIds: string[]
  consumables: Array<{
    id: string
    name: string
    description: string
    price: number
    sprite: string
    catchRates?: {
      commun: number
      rare: number
      epique: number
      legendaire: number
      ultime: number
    }
  }>
  consumableInventory: Array<{
    consumableId: string
    quantity: number
  }>
  isAuthenticated: boolean
  canSignIn: boolean
  onSignIn: () => void
  onOpenInventory?: () => void
  onClose: () => void
}

const shopTabs = [
  { id: 'avatar', label: 'Avatar' },
  { id: 'card-designs', label: 'Dos de carte' },
  { id: 'consumables', label: 'Consommable' },
] as const

type ShopTabId = (typeof shopTabs)[number]['id']

const rarityTiers = [
  { id: 'common', label: 'Communs' },
  { id: 'rare', label: 'Rares' },
  { id: 'legendary', label: 'Légendaires' },
  { id: 'ultimate', label: 'Ultime' },
] as const

export default function ModalShop({
  initialTab,
  balance,
  catalog,
  cardDesigns,
  ownedCardDesignIds,
  equippedCardDesignId,
  ownedIds,
  consumables,
  consumableInventory,
  isAuthenticated,
  canSignIn,
  onSignIn,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [activeTab, setActiveTab] = useState<ShopTabId>(
    initialTab === 'decorations'
      ? 'avatar'
      : initialTab === 'card-designs'
        ? 'card-designs'
        : 'consumables',
  )
  const [buyingFrame, setBuyingFrame] = useState<string | null>(null)
  const [buyingCardDesign, setBuyingCardDesign] = useState<string | null>(null)
  const [buyingConsumable, setBuyingConsumable] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const formattedBalance = new Intl.NumberFormat('fr-FR').format(balance)
  const pokemonConsumables = consumables.filter(
    (item) => item.id !== 'holocron',
  )
  const starWarsConsumables = consumables.filter(
    (item) => item.id === 'holocron',
  )
  const buyAvatarFrame = useMutation(api.user.mutations.buyAvatarFrame)
  const buyCardDesignMutation = useMutation(api.user.mutations.buyCardDesign)
  const buyConsumable = useMutation(api.user.mutations.buyConsumable)
  const snackbar = useAppSnackbar()

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
        error instanceof Error
          ? error.message
          : 'Achat impossible pour le moment.',
      )
    } finally {
      setBuyingFrame(null)
    }
  }

  async function purchaseCardDesign(designId: string) {
    setBuyingCardDesign(designId)
    setPurchaseError(null)
    try {
      await buyCardDesignMutation({ designId })
      const designName =
        cardDesigns.find((design) => design.id === designId)?.name ??
        'Design de carte'
      snackbar.success(
        'Achat effectué',
        `${designName} ajouté à ta collection.`,
      )
    } catch (error) {
      setPurchaseError(
        error instanceof Error
          ? error.message
          : 'Achat impossible pour le moment.',
      )
    } finally {
      setBuyingCardDesign(null)
    }
  }

  async function purchaseConsumable(consumableId: string) {
    setBuyingConsumable(consumableId)
    setPurchaseError(null)
    try {
      await buyConsumable({ consumableId })
      const itemName =
        consumables.find((item) => item.id === consumableId)?.name ??
        'Consommable'
      snackbar.success(
        'Achat effectué',
        `${itemName} ajouté à t'es consommables.`,
      )
    } catch (error) {
      setPurchaseError(
        error instanceof Error
          ? error.message
          : 'Achat impossible pour le moment.',
      )
    } finally {
      setBuyingConsumable(null)
    }
  }

  function renderConsumableCard(item: Props['consumables'][number]) {
    const canAfford = balance >= item.price
    const quantity =
      consumableInventory.find(
        (ownedItem) => ownedItem.consumableId === item.id,
      )?.quantity ?? 0
    return (
      <article
        className='pp-consumable-card'
        key={item.id}
        data-consumable={item.id}
      >
        <div className='pp-consumable-art'>
          {item.id === 'holocron' ? (
            <Hexagon
              className='pp-consumable-holocron-icon'
              size={56}
              strokeWidth={1.5}
              aria-hidden='true'
            />
          ) : (
            <img
              src={item.sprite}
              alt=''
              width={96}
              height={96}
              loading='lazy'
            />
          )}
        </div>
        <div className='pp-consumable-copy'>
          <div className='pp-consumable-title'>
            <h4>{item.name}</h4>
            {quantity > 0 && (
              <span className='pp-consumable-owned'>En stock : {quantity}</span>
            )}
          </div>
          <p>{item.description}</p>
          {item.catchRates && item.id !== 'master-ball' ? (
            <dl className='pp-consumable-rates'>
              <div>
                <dt>Commun</dt>
                <dd>{item.catchRates.commun}%</dd>
              </div>
              <div>
                <dt>Rare</dt>
                <dd>{item.catchRates.rare}%</dd>
              </div>
              <div>
                <dt>Épique</dt>
                <dd>{item.catchRates.epique}%</dd>
              </div>
              <div>
                <dt>Légendaire</dt>
                <dd>{item.catchRates.legendaire}%</dd>
              </div>
              <div>
                <dt>Ultime</dt>
                <dd>{item.catchRates.ultime}%</dd>
              </div>
            </dl>
          ) : null}
          <span className='pp-consumable-price'>{item.price} Pokisous</span>
        </div>
        <button
          className='pp-button pp-consumable-action'
          type='button'
          disabled={
            (isAuthenticated && !canAfford) ||
            (!isAuthenticated && !canSignIn) ||
            buyingConsumable !== null
          }
          onClick={() => {
            if (isAuthenticated) {
              void purchaseConsumable(item.id)
            } else {
              onSignIn()
            }
          }}
        >
          {buyingConsumable === item.id
            ? 'Achat…'
            : isAuthenticated
              ? canAfford
                ? 'Acheter'
                : 'Solde insuffisant'
              : 'Connexion requise'}
        </button>
      </article>
    )
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
              aria-label={`${formattedBalance} Pokisous`}
            >
              <span className='pp-shop-coin' aria-hidden='true'>
                P
              </span>
              <span className='pp-shop-currency-value'>{formattedBalance}</span>
            </div>
            <details className='pp-shop-help'>
              <summary
                className='pp-icon-button pp-shop-help-trigger'
                aria-label='Comment gagner des Pokisous ?'
                title='Comment gagner des Pokisous ?'
              >
                <Info size={20} aria-hidden='true' />
              </summary>
              <div className='pp-shop-help-panel' role='note'>
                <strong>Gagner des Pokisous</strong>
                <p>
                  Une manche révélée rapporte des Pokisous à tous les joueurs
                  connectés actifs, même s’ils n’ont pas voté. Il faut au moins
                  3 joueurs actifs, dont 2 comptes connectés.
                </p>
                <ul>
                  <li>10 Pokisous par joueur si les votes diffèrent.</li>
                  <li>25 Pokisous par joueur si tous votent pareil.</li>
                </ul>
                <p>Les joueurs invités ne reçoivent pas de Pikisous.</p>
              </div>
            </details>
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
          className='pokemon-collection-tabs'
          role='tablist'
          aria-label='Sections de la boutique'
          onKeyDown={handleTabKeyDown}
        >
          {shopTabs.map((tab) => (
            <button
              key={tab.id}
              className='pokemon-collection-tab'
              id={`shop-tab-${tab.id}`}
              type='button'
              role='tab'
              aria-selected={activeTab === tab.id}
              aria-controls='shop-panel'
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div
          className={`pp-shop-panel${activeTab === 'avatar' ? ' pp-shop-panel--frames' : ' pp-shop-panel--pokemon'}`}
          id='shop-panel'
          role='tabpanel'
          aria-labelledby={`shop-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'avatar' ? (
            <div className='pp-avatar-shop-section'>
              <div className='pp-shop-section-heading'>
                <h3>Cadres</h3>
              </div>
              <div className='pp-frame-tiers'>
                {rarityTiers.map((tier) => {
                  const tierFrames = catalog.filter(
                    (frame) => frame.rarity === tier.id,
                  )
                  if (!tierFrames.length) return null

                  return (
                    <section
                      className={`pp-frame-tier pp-frame-tier--${tier.id}`}
                      key={tier.id}
                    >
                      <div className='pp-frame-tier-heading'>
                        <h3>{tier.label}</h3>
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
                                  <span
                                    className='pp-frame-avatar-initial'
                                    aria-hidden='true'
                                  >
                                    A
                                  </span>
                                </AvatarFrame>
                              </div>
                              <div className='pp-frame-copy'>
                                <strong>{frame.name}</strong>
                                <p>{frame.description}</p>
                                <span className='pp-frame-price'>
                                  {frame.price} Pokisous
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
              </div>
            </div>
          ) : activeTab === 'card-designs' ? (
            <div className='pp-card-design-shop'>
              <div className='pp-shop-section-heading'>
                <h3>Designs de carte</h3>
                <p>
                  Choisis le style des cartes dans tes mains et sur la table.
                </p>
              </div>
              <div className='pp-card-design-grid'>
                {cardDesigns.map((design) => {
                  const isOwned = ownedCardDesignIds.includes(design.id)
                  const isEquipped = equippedCardDesignId === design.id
                  const canAfford = balance >= design.price
                  const rarityLabel =
                    design.rarity === 'rare'
                      ? 'Rare'
                      : design.rarity === 'epic'
                        ? 'Épique'
                        : 'Légendaire'
                  return (
                    <article
                      className={`pp-card-design-card pp-card-design-card--${design.id}`}
                      key={design.id}
                    >
                      <div className='pp-card-design-copy'>
                        <span
                          className={`pp-card-design-rarity pp-card-design-rarity--${design.rarity}`}
                        >
                          {rarityLabel}
                        </span>
                        <h4>{design.name}</h4>
                        <p>{design.description}</p>
                        <ul>
                          <li>Face et dos assortis</li>
                          <li>Visible par les autres joueurs</li>
                        </ul>
                        <strong className='pp-card-design-price'>
                          {new Intl.NumberFormat('fr-FR').format(design.price)}{' '}
                          Pokisous
                        </strong>
                        {isEquipped && (
                          <span className='pp-card-design-equipped'>
                            Design équipé
                          </span>
                        )}
                      </div>
                      <CardDesignPreview design={design} />
                      <button
                        className='pp-button pp-card-design-action'
                        type='button'
                        disabled={
                          isOwned ||
                          (!isOwned && isAuthenticated && !canAfford) ||
                          (!isAuthenticated && !canSignIn) ||
                          buyingCardDesign !== null
                        }
                        onClick={() => {
                          if (!isAuthenticated) {
                            onSignIn()
                          } else {
                            void purchaseCardDesign(design.id)
                          }
                        }}
                      >
                        {buyingCardDesign === design.id
                          ? 'Achat…'
                          : isOwned
                            ? 'Possédé'
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
            </div>
          ) : (
            <div className='pp-consumable-shop'>
              <section className='pp-consumable-section'>
                <div className='pp-consumable-section-heading'>
                  <h3>Pokémon</h3>
                  <p>Objets de capture et Poké Balls mystères</p>
                </div>
                <div className='pp-consumable-grid'>
                  {pokemonConsumables.map(renderConsumableCard)}
                </div>
              </section>
              <section className='pp-consumable-section'>
                <div className='pp-consumable-section-heading'>
                  <h3>Star Wars</h3>
                  <p>Holocrons de personnages</p>
                </div>
                <div className='pp-consumable-grid'>
                  {starWarsConsumables.map(renderConsumableCard)}
                </div>
              </section>
            </div>
          )}
          {purchaseError && (
            <p className='pp-form-error pp-frame-error' role='alert'>
              {purchaseError}
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
