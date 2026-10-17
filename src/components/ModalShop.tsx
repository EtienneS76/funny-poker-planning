import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

type Props = {
  balance: number
  onClose: () => void
}

const shopTabs = [
  { id: 'decorations', label: 'Décorations' },
  { id: 'pokemon', label: 'Pokémon', upcoming: true },
  { id: 'star-wars', label: 'Star Wars', upcoming: true },
] as const

type ShopTabId = (typeof shopTabs)[number]['id']

export default function ModalShop({ balance, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [activeTab, setActiveTab] = useState<ShopTabId>('decorations')
  const formattedBalance = new Intl.NumberFormat('fr-FR').format(balance)

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
          className='pp-shop-panel'
          id='shop-panel'
          role='tabpanel'
          aria-labelledby={`shop-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'decorations' ? (
            <p className='pp-shop-coming'>
              Aucune décoration disponible pour le moment.
            </p>
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
