import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  Bell,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/auth-context'

const loadDashboard = () => import('./pages/Dashboard')
const loadMessages = () => import('./pages/Messages')
const loadArchives = () => import('./pages/Archives')
const loadReceivedCourriers = () => import('./pages/ReceivedCourriers')
const loadSentCourriers = () => import('./pages/SentCourriers')
const loadValidation = () => import('./pages/Validation')
const loadUsersPage = () => import('./pages/Users')
const loadLogin = () => import('./pages/Login')

const Dashboard = lazy(loadDashboard)
const Messages = lazy(loadMessages)
const Archives = lazy(loadArchives)
const ReceivedCourriers = lazy(loadReceivedCourriers)
const SentCourriers = lazy(loadSentCourriers)
const Validation = lazy(loadValidation)
const UsersPage = lazy(loadUsersPage)
const Login = lazy(loadLogin)

const routes = [
  {
    path: '/',
    title: 'Dashboard',
    description: 'Vue globale, activite recente et statistiques.',
    icon: LayoutDashboard,
    component: Dashboard,
    preload: loadDashboard,
  },
  {
    path: '/recus',
    title: 'Courriers recus',
    description: 'Flux entrants et priorites a traiter.',
    icon: Inbox,
    component: ReceivedCourriers,
    preload: loadReceivedCourriers,
  },
  {
    path: '/envoyes',
    title: 'Courriers envoyes',
    description: 'Suivi des transmissions sortantes.',
    icon: Send,
    component: SentCourriers,
    preload: loadSentCourriers,
  },
  {
    path: '/messages',
    title: 'Messagerie',
    description: 'Communication interne et alertes metier.',
    icon: MessageSquare,
    component: Messages,
    preload: loadMessages,
  },
  {
    path: '/archives',
    title: 'Archives',
    description: 'Historique et recherche avancee.',
    icon: Archive,
    component: Archives,
    preload: loadArchives,
  },
  {
    path: '/validation',
    title: 'Validation',
    description: 'File des courriers en attente d arbitrage.',
    icon: ShieldAlert,
    component: Validation,
    preload: loadValidation,
  },
  {
    path: '/utilisateurs',
    title: 'Utilisateurs',
    description: 'Gestion des comptes, roles et acces.',
    icon: Users,
    component: UsersPage,
    preload: loadUsersPage,
  },
]

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

let notificationId = 0

function makeId() {
  notificationId += 1
  return notificationId
}

function getNotificationRoute(notification) {
  const rawType = notification.type || ''
  const dataType = notification.data?.type || ''

  if (
    rawType === 'validation_requested' ||
    dataType === 'validation_requested' ||
    rawType.includes('ValidationRequestedNotification')
  ) {
    return '/validation'
  }

  return '/recus'
}

function AuthenticatedApp() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef(null)
  const bellMobileRef = useRef(null)
  const bellDesktopRef = useRef(null)

  const unreadCount = notifications.length

  const canValidateCourriers =
    user?.permissions?.peut_valider_courriers === true ||
    ['chef', 'admin'].includes(String(user?.role || '').trim().toLowerCase())

  const navItems = useMemo(
    () =>
      routes.filter((route) => {
        if (route.path === '/validation') {
          return canValidateCourriers
        }

        if (route.path === '/utilisateurs') {
          return user?.permissions?.peut_gerer_utilisateurs === true
        }

        return true
      }),
    [canValidateCourriers, user?.permissions?.peut_gerer_utilisateurs],
  )

  const currentRoute =
    navItems.find((item) => item.path === location.pathname) ?? navItems[0] ?? routes[0]

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false
    let cleanup = () => {}

    const setupNotifications = async () => {
      const { default: echo } = await import('./lib/echo')

      if (cancelled) return

      const channel = echo.private(`App.Models.User.${user.id}`)

      channel.notification((notification) => {
        setNotifications((previous) => [
          { ...notification, _id: makeId(), _at: new Date() },
          ...previous,
        ])

        toast.custom(
          (toastState) => (
            <div
              className={`notification-enter flex items-start gap-3 rounded-2xl border border-white/15 bg-slate-950/95 px-4 py-3 text-slate-50 shadow-2xl ${
                toastState.visible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ minWidth: '280px', maxWidth: '360px' }}
            >
              <span className="mt-0.5 text-lg leading-none">🔔</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">
                  {notification.titre || 'Notification'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  {notification.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(toastState.id)}
                className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>
          ),
          { duration: 5000 },
        )
      })

      cleanup = () => {
        channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated')
        echo.leave(`App.Models.User.${user.id}`)
      }
    }

    setupNotifications()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedBell =
        bellMobileRef.current?.contains(event.target) ||
        bellDesktopRef.current?.contains(event.target)
      const clickedPanel = panelRef.current?.contains(event.target)

      if (!clickedBell && !clickedPanel) {
        setPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((previous) => previous.filter((notification) => notification._id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
    setPanelOpen(false)
  }, [])

  const handleNotificationClick = useCallback(
    (notification) => {
      setPanelOpen(false)
      dismissNotification(notification._id)
      navigate(getNotificationRoute(notification))
    },
    [dismissNotification, navigate],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    navigate('/', { replace: true })
  }, [logout, navigate])

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Login />
      </Suspense>
    )
  }

  const CurrentIcon = currentRoute.icon

  return (
    <div className="app-shell min-h-screen">
      <div className="ambient-orb ambient-orb--blue" />
      <div className="ambient-orb ambient-orb--cyan" />
      <div className="ambient-orb ambient-orb--violet" />

      <Toaster
        position="top-right"
        toastOptions={{
          className: 'glass-panel-strong !rounded-2xl !border !border-slate-200/80 !bg-white/90 !text-slate-900',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1680px] gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8 lg:py-6">
        <aside className="glass-panel hidden w-80 shrink-0 rounded-[2rem] p-5 lg:flex lg:flex-col">
          <SidebarContent
            user={user}
            items={navItems}
            onLogout={handleLogout}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="glass-panel-strong sticky top-4 z-30 rounded-[1.75rem] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="glass-panel flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 lg:hidden"
                  aria-label="Ouvrir le menu"
                >
                  <Menu size={20} />
                </button>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
                  <CurrentIcon size={22} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="rounded-full bg-blue-600/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
                      Plateforme courrier
                    </p>
                    <p className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      Session active
                    </p>
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    <span className="gradient-text">{currentRoute.title}</span>
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{currentRoute.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="glass-panel hidden rounded-2xl px-4 py-3 text-sm text-slate-600 md:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Priorite
                  </p>
                  <p className="mt-1 font-medium text-slate-800">Traitement fluide et temps reel</p>
                </div>

                <NotificationBell
                  ref={bellDesktopRef}
                  unreadCount={unreadCount}
                  panelOpen={panelOpen}
                  onToggle={() => setPanelOpen((value) => !value)}
                />

                <UserSummary user={user} />
              </div>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden">
              <div className="float-in glass-panel-strong h-full w-80 max-w-[88vw] rounded-r-[2rem] p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Navigation
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">Gestion courrier</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="glass-panel flex h-10 w-10 items-center justify-center rounded-2xl text-slate-600"
                    aria-label="Fermer le menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-4">
                  <NotificationBell
                    ref={bellMobileRef}
                    unreadCount={unreadCount}
                    panelOpen={panelOpen}
                    onToggle={() => setPanelOpen((value) => !value)}
                    fullWidth
                  />
                </div>

                <SidebarContent
                  user={user}
                  items={navItems}
                  onLogout={handleLogout}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </div>
          )}

          {panelOpen && (
            <NotificationPanel
              ref={panelRef}
              notifications={notifications}
              onDismiss={dismissNotification}
              onDismissAll={dismissAll}
              onClose={() => setPanelOpen(false)}
              onNotificationClick={handleNotificationClick}
            />
          )}

          <main className="min-w-0 flex-1">
            <Suspense fallback={<PageLoader title={currentRoute.title} description={currentRoute.description} />}>
              <div key={location.pathname} className="page-enter">
                <Routes location={location}>
                  {navItems.map((route) => {
                    const Component = route.component

                    return <Route key={route.path} path={route.path} element={<Component />} />
                  })}
                </Routes>
              </div>
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}

const NotificationBell = forwardRef(function NotificationBell(
  { unreadCount, panelOpen, onToggle, fullWidth = false },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      className={`glass-panel relative flex h-11 items-center justify-center gap-3 rounded-2xl px-4 text-slate-600 ${
        fullWidth ? 'w-full justify-between' : 'w-11'
      } ${panelOpen ? 'border-blue-200 bg-blue-50/70 text-blue-700' : ''}`}
      aria-label="Notifications"
    >
      <span className="flex items-center gap-3">
        <Bell size={18} />
        {fullWidth && <span className="text-sm font-medium">Notifications</span>}
      </span>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-lg shadow-rose-500/30">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
})

const NotificationPanel = forwardRef(function NotificationPanel(
  { notifications, onDismiss, onDismissAll, onClose, onNotificationClick },
  ref,
) {
  return (
    <div
      ref={ref}
      className="glass-panel-strong fixed right-4 top-24 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.75rem] shadow-2xl lg:absolute lg:right-8 lg:top-24"
    >
      <div className="soft-divider flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {notifications.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
              {notifications.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onDismissAll}
              className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              Tout supprimer
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer les notifications"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
              <Bell size={24} />
            </div>
            <p className="text-sm font-medium text-slate-500">Aucune notification</p>
            <p className="text-xs text-slate-400">
              Les nouvelles alertes apparaissent ici automatiquement.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification._id}
                notification={notification}
                onDismiss={onDismiss}
                onClick={onNotificationClick}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
})

function NotificationItem({ notification, onDismiss, onClick }) {
  const typeColors = {
    courrier_received: { dot: 'bg-emerald-500', bg: 'hover:bg-emerald-50/70' },
    validation_requested: { dot: 'bg-amber-500', bg: 'hover:bg-amber-50/70' },
    message_sent: { dot: 'bg-sky-500', bg: 'hover:bg-sky-50/70' },
  }

  const rawType = notification.type || ''
  const dataType = notification.data?.type || ''
  const isValidation =
    rawType === 'validation_requested' ||
    dataType === 'validation_requested' ||
    rawType.includes('ValidationRequestedNotification')

  const colors = isValidation
    ? typeColors.validation_requested
    : typeColors[rawType] || typeColors[dataType] || { dot: 'bg-slate-400', bg: 'hover:bg-slate-50/80' }

  function formatTime(value) {
    if (!value) return ''

    const date = new Date(value)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "A l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Il y a ${diffHours} h`

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <li className={`transition ${colors.bg}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => onClick(notification)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`Ouvrir la notification ${notification.titre || notification.message}`}
        >
          <div className="mt-1.5">
            <span className={`status-dot block h-2.5 w-2.5 rounded-full ${colors.dot}`} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {notification.titre || 'Notification'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {notification.message}
            </p>
            {notification.courrier_numero && (
              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {notification.courrier_numero}
              </span>
            )}
            <p className="mt-1 text-[10px] text-slate-400">{formatTime(notification._at)}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDismiss(notification._id)
          }}
          className="mt-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Supprimer la notification"
        >
          <X size={14} />
        </button>
      </div>
    </li>
  )
}

function SidebarContent({ user, items, onLogout, onNavigate }) {
  return (
    <>
      <div className="mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
            <FileText size={22} />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-950">Gestion Courrier</h1>
            <p className="truncate text-sm text-slate-500">Pilotage moderne des flux</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white shadow-xl shadow-slate-900/12">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles size={16} />
            <span className="text-xs font-semibold uppercase tracking-[0.24em]">Vue unifiee</span>
          </div>
          <p className="mt-3 text-sm text-slate-100">
            Navigation rapide, composants plus fluides et chargement progressif.
          </p>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => (
          <MenuLink key={item.path} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div className="glass-panel rounded-[1.5rem] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-900 shadow-sm">
              {getInitials(user)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{user.nom_complet}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700">
            <ShieldCheck size={14} />
            Session securisee
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="glass-panel mt-3 flex w-full items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-semibold text-slate-700 hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-600"
        >
          <LogOut size={17} />
          Deconnexion
        </button>
      </div>
    </>
  )
}

function MenuLink({ item, onNavigate }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      onMouseEnter={() => item.preload?.()}
      onFocus={() => item.preload?.()}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-[1.35rem] px-3 py-3 transition ${
          isActive
            ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/12'
            : 'text-slate-600 hover:bg-white/60 hover:text-slate-950'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              isActive ? 'bg-white/12 text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            <Icon size={18} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className={`truncate text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
              {item.description}
            </p>
          </div>
        </>
      )}
    </NavLink>
  )
}

function UserSummary({ user }) {
  const role = String(user?.role || '').trim().toLowerCase()
  const scope = String(user?.role_scope || '').trim().toLowerCase()

  const roleLabel = role === 'admin' ? 'admin' : [role, scope].filter(Boolean).join(' ')

  let scopeLabel = ''

  if (role === 'admin') {
    scopeLabel = 'Acces global'
  } else if (scope === 'general') {
    scopeLabel = 'Structure principale'
  } else if (scope === 'structure') {
    scopeLabel = user?.structure?.libelle || ''
  } else if (scope === 'service') {
    scopeLabel = user?.service?.libelle || ''
  }

  return (
    <div className="glass-panel hidden items-center gap-3 rounded-[1.35rem] px-3 py-2.5 sm:flex">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
        <UserRound size={18} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{user?.nom_complet}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel}</p>
        {scopeLabel && <p className="truncate text-xs text-slate-500">{scopeLabel}</p>}
      </div>
    </div>
  )
}

function PageLoader({ title, description }) {
  return (
    <div className="glass-panel-strong loading-grid rounded-[2rem] px-6 py-10 sm:px-8">
      <div className="mb-8">
        <div className="skeleton h-4 w-32" />
        <div className="mt-4 skeleton h-10 w-64 max-w-full" />
        <div className="mt-3 skeleton h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-panel rounded-[1.5rem] p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton h-12 w-12 rounded-2xl" />
              <div className="space-y-2">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-6 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="glass-panel rounded-[1.75rem] p-4">
          <div className="skeleton h-10 w-full rounded-2xl" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-18 w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="glass-panel rounded-[1.75rem] p-5">
          <div className="skeleton skeleton-avatar" />
          <div className="mt-4 skeleton skeleton-heading" />
          <div className="mt-3 skeleton skeleton-text" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="skeleton h-12 rounded-2xl" />
            <div className="skeleton h-12 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-slate-500">
        Chargement de <span className="font-semibold text-slate-700">{title}</span> — {description}
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4">
      <div className="ambient-orb ambient-orb--blue" />
      <div className="ambient-orb ambient-orb--cyan" />
      <div className="glass-panel-strong flex w-full max-w-md items-center gap-4 rounded-[2rem] px-6 py-5 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <FileText size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Verification de la session</p>
          <p className="mt-1 text-sm text-slate-500">Preparation de l espace de travail...</p>
        </div>
      </div>
    </div>
  )
}

function getInitials(user) {
  return `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`.toUpperCase() || 'GC'
}

export default App
