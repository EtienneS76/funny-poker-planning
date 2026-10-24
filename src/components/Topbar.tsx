import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'
import { Backpack, PackageOpen, Store, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import ModalShop from './ModalShop'
import ModalConsumableInventory from './ModalConsumableInventory'
import ModalPokemonCollection from './ModalPokemonCollection'
import { useAppSnackbar } from './AppSnackbar'

type Props = {
  account: AccountState
  onInvitePlayers?: () => void
}

type ShopTabId = 'decorations' | 'pokemon' | 'star-wars'

export default function Topbar({ account, onInvitePlayers }: Props) {
  const [shopOpen, setShopOpen] = useState(false)
  const [shopInitialTab, setShopInitialTab] = useState<ShopTabId>('decorations')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const shopData = useQuery(api.user.queries.shopData, {})
  const ensureConsumableCatalog = useMutation(
    api.user.mutations.ensureConsumableCatalog,
  )
  const snackbar = useAppSnackbar()

  function openShop(tab: ShopTabId) {
    setShopInitialTab(tab)
    setInventoryOpen(false)
    setShopOpen(true)
  }

  function openInventory() {
    setShopOpen(false)
    setInventoryOpen(true)
  }

  useEffect(() => {
    void ensureConsumableCatalog({}).catch((error: unknown) => {
      snackbar.error(
        'Boutique indisponible',
        error instanceof Error
          ? error.message
          : 'Impossible de charger le catalogue.',
      )
    })
  }, [ensureConsumableCatalog, snackbar])

  return (
    <header className='pp-topbar'>
      <Link className='pp-brand' to='/'>
        Funny Poker Planning
      </Link>
      <div className='pp-topbar-actions'>
        {account.isAuthenticated && (
          <button
            className='pp-button pp-button--secondary pp-button--collection-nav'
            type='button'
            aria-label='Ouvrir la collection'
            title='Ouvrir la collection'
            onClick={() => setCollectionOpen(true)}
          >
            <Backpack size={17} aria-hidden='true' />
            <span>Collection</span>
          </button>
        )}
        <button
          className='pp-button pp-button--secondary pp-button--inventory-nav'
          type='button'
          aria-label='Ouvrir les consommables'
          title='Ouvrir les consommables'
          onClick={() => setInventoryOpen(true)}
        >
          <PackageOpen size={17} aria-hidden='true' />
          <span>Consommable</span>
        </button>
        <button
          className='pp-button pp-button--invite pp-floating-invite'
          type='button'
          aria-label='Ouvrir la boutique'
          title='Ouvrir la boutique'
          onClick={() => openShop('decorations')}
        >
          <Store size={17} aria-hidden='true' />
        </button>
        {onInvitePlayers && (
          <button
            className='pp-button pp-button--invite pp-floating-invite'
            type='button'
            aria-label='Inviter à participer'
            title='Inviter à participer'
            onClick={onInvitePlayers}
          >
            <UserRoundPlus size={17} aria-hidden='true' />
          </button>
        )}
        <Account account={account} />
      </div>
      {(account.error || account.configured === false) && (
        <p
          className='pp-auth-feedback'
          role={account.error ? 'alert' : 'status'}
        >
          {account.error ?? 'Connexion GitHub non configurée.'}
        </p>
      )}
      {shopOpen && (
        <ModalShop
          initialTab={shopInitialTab}
          balance={shopData?.balance ?? 0}
          catalog={shopData?.catalog ?? []}
          ownedIds={shopData?.ownedIds ?? []}
          consumables={shopData?.consumables ?? []}
          consumableInventory={shopData?.consumableInventory ?? []}
          isAuthenticated={account.isAuthenticated}
          canSignIn={
            account.configured === true && !account.loading && !account.pending
          }
          onSignIn={() => void account.signIn()}
          onOpenInventory={openInventory}
          onClose={() => setShopOpen(false)}
        />
      )}
      {inventoryOpen && (
        <ModalConsumableInventory
          onClose={() => setInventoryOpen(false)}
          onOpenShop={openShop}
        />
      )}
      {collectionOpen && (
        <ModalPokemonCollection onClose={() => setCollectionOpen(false)} />
      )}
    </header>
  )
}
