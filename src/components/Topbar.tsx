import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import Account from '../features/auth/Account'
import type { AccountState } from '../features/auth/useAccount'
import { Bug, PackageOpen, Store, UserRoundPlus } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../../convex/_generated/api'
import ModalShop from './ModalShop'
import ModalConsumableInventory from './ModalConsumableInventory'
import { useAppSnackbar } from './AppSnackbar'

type Props = {
  account: AccountState
  onInvitePlayers?: () => void
}

export default function Topbar({ account, onInvitePlayers }: Props) {
  const [shopOpen, setShopOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const shopData = useQuery(api.user.queries.shopData, {})
  const ensureConsumableCatalog = useMutation(
    api.user.mutations.ensureConsumableCatalog,
  )
  const snackbar = useAppSnackbar()

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
      {onInvitePlayers && (
        <button
          className='pp-button pp-button--invite pp-topbar-invite'
          type='button'
          onClick={onInvitePlayers}
        >
          <UserRoundPlus size={17} aria-hidden='true' /> Inviter à participer
        </button>
      )}
      <div className='pp-topbar-actions'>
        <button
          className='pp-button pp-button--secondary pp-button--inventory-nav'
          type='button'
          aria-label='Ouvrir l’inventaire'
          title='Ouvrir l’inventaire'
          onClick={() => setInventoryOpen(true)}
        >
          <PackageOpen size={17} aria-hidden='true' />
          <span>Inventaire</span>
        </button>
        <button
          className='pp-button pp-button--secondary pp-button--shop-nav'
          type='button'
          aria-label='Ouvrir la boutique'
          title='Ouvrir la boutique'
          onClick={() => setShopOpen(true)}
        >
          <Store size={17} aria-hidden='true' />
          <span>Boutique</span>
        </button>
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
          onClose={() => setShopOpen(false)}
        />
      )}
      {inventoryOpen && (
        <ModalConsumableInventory onClose={() => setInventoryOpen(false)} />
      )}
      <a
        className='pp-report-bug'
        href='https://github.com/EtienneS76/funny-poker-planning/issues/new'
        target='_blank'
        rel='noopener noreferrer'
      >
        <Bug size={17} aria-hidden='true' /> Signaler un bug
      </a>
    </header>
  )
}
