import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Bell,
  CircleAlert,
  CircleCheck,
  LogOut,
  UserRoundPlus,
  X,
} from 'lucide-react'

type SnackbarTone = 'arrival' | 'departure' | 'success' | 'error' | 'info'
type SnackbarInput = {
  tone: SnackbarTone
  title: string
  description?: string
}
type SnackbarNotice = SnackbarInput & { id: number }
type SnackbarApi = {
  notify: (notice: SnackbarInput) => void
  playerJoined: (name: string) => void
  playerLeft: (name: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const SnackbarContext = createContext<SnackbarApi | null>(null)
const icons = {
  arrival: UserRoundPlus,
  departure: LogOut,
  success: CircleCheck,
  error: CircleAlert,
  info: Bell,
}
export function AppSnackbarProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<SnackbarNotice[]>([])
  const stack = useRef<HTMLDivElement>(null)
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const notify = useCallback(
    (notice: SnackbarInput) => {
      const id = ++nextId.current
      setNotices((current) => [...current, { ...notice, id }].slice(-4))
      timers.current.set(id, window.setTimeout(() => dismiss(id), 5_000))
    },
    [dismiss],
  )

  const playerJoined = useCallback(
    (name: string) =>
      notify({
        tone: 'arrival',
        title: name,
        description: 'a rejoint la partie',
      }),
    [notify],
  )
  const playerLeft = useCallback(
    (name: string) =>
      notify({
        tone: 'departure',
        title: name,
        description: 'a quitté la partie',
      }),
    [notify],
  )
  const success = useCallback(
    (title: string, description?: string) =>
      notify({ tone: 'success', title, description }),
    [notify],
  )
  const error = useCallback(
    (title: string, description?: string) =>
      notify({ tone: 'error', title, description }),
    [notify],
  )
  const info = useCallback(
    (title: string, description?: string) =>
      notify({ tone: 'info', title, description }),
    [notify],
  )

  const api = useMemo(
    () => ({ notify, playerJoined, playerLeft, success, error, info }),
    [notify, playerJoined, playerLeft, success, error, info],
  )

  useLayoutEffect(() => {
    const snackbarStack = stack.current
    if (!snackbarStack) return
    const isOpen = snackbarStack.matches(':popover-open')
    if (isOpen) snackbarStack.hidePopover()
    if (notices.length > 0) snackbarStack.showPopover()
  }, [notices])

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer)
      timers.current.clear()
    },
    [],
  )

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      <div
        className='app-snackbar-stack'
        ref={stack}
        popover='manual'
        aria-live='polite'
        aria-relevant='additions'
      >
        {notices.map((notice) => {
          const Icon = icons[notice.tone]
          return (
            <article
              className={`app-snackbar app-snackbar--${notice.tone}`}
              key={notice.id}
              role={notice.tone === 'error' ? 'alert' : 'status'}
            >
              <span className='app-snackbar-icon' aria-hidden='true'>
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <span className='app-snackbar-copy'>
                <strong className='app-snackbar-title'>{notice.title}</strong>
                {notice.description && (
                  <span className='app-snackbar-description'>
                    {notice.description}
                  </span>
                )}
              </span>
              <button
                className='app-snackbar-dismiss'
                type='button'
                aria-label='Fermer la notification'
                onClick={() => dismiss(notice.id)}
              >
                <X size={16} aria-hidden='true' />
              </button>
            </article>
          )
        })}
      </div>
    </SnackbarContext.Provider>
  )
}

export function useAppSnackbar(): SnackbarApi {
  const snackbar = useContext(SnackbarContext)
  if (!snackbar) {
    throw new Error('useAppSnackbar doit être utilisé dans AppSnackbarProvider')
  }
  return snackbar
}
