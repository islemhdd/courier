import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Archive,
  Bell,
  FileText,
  Inbox,
  LogOut,
  Menu,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'

import Dashboard from './pages/Dashboard'
import Messages from './pages/Messages'
import Archives from './pages/Archives'
import ReceivedCourriers from './pages/ReceivedCourriers'
import SentCourriers from './pages/SentCourriers'
import Validation from './pages/Validation'
import UsersPage from './pages/Users'
import Login from './pages/Login'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/auth-context'
import { Toaster, toast } from 'react-hot-toast'
import echo from './lib/echo'

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

// ─── Notification helpers ────────────────────────────────────────────────────

let _notifId = 0
function makeId() {
  return ++_notifId
}

function getNotifRoute(notification) {
  const type = notification.type || ''
  const dataType = notification.data?.type || ''

  if (
    type === 'validation_requested' ||
    dataType === 'validation_requested' ||
    type.includes('ValidationRequestedNotification')
  ) {
    return '/validation'
  }
  return '/recus'
}

// ─── Main authenticated shell ─────────────────────────────────────────────────

function AuthenticatedApp() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Notification state
  const [notifications, setNotifications] = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef(null)
  const bellMobileRef = useRef(null)
  const bellDesktopRef = useRef(null)

  const unreadCount = notifications.length

  // Subscribe to Echo channel when user is loaded
  useEffect(() => {
    if (!user) return

    const channel = echo.private(`App.Models.User.${user.id}`)
    channel.notification((notification) => {
      // Add to panel
      setNotifications((prev) => [
        { ...notification, _id: makeId(), _at: new Date() },
        ...prev,
      ])
      // Also show toast (custom render so we can add an X dismiss button)
      toast.custom(
        (t) => (
          <div
            className={`flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl transition-all ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
            style={{ background: '#1e293b', color: '#f8fafc', minWidth: '280px', maxWidth: '360px' }}
          >
            <span className="mt-0.5 text-lg leading-none">🔔</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug" style={{ color: '#f1f5f9' }}>
                {notification.titre || 'Notification'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                {notification.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="mt-0.5 flex-shrink-0 rounded-md p-1 transition hover:bg-white/10"
              aria-label="Fermer"
              style={{ color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          </div>
        ),
        { duration: 5000 },
      )
    })

    return () => {
      channel.stopListening('.Illuminate\\Notifications\\Events\\BroadcastNotificationCreated')
      echo.leave(`App.Models.User.${user.id}`)
    }
  }, [user])

  // Close panel when clicking outside (checks both mobile & desktop bell refs)
  useEffect(() => {
    function handleClickOutside(e) {
      const clickedBell =
        (bellMobileRef.current && bellMobileRef.current.contains(e.target)) ||
        (bellDesktopRef.current && bellDesktopRef.current.contains(e.target))
      const clickedPanel = panelRef.current && panelRef.current.contains(e.target)
      if (!clickedBell && !clickedPanel) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
    setPanelOpen(false)
  }, [])

  const handleNotificationClick = useCallback(
    (notification) => {
      setPanelOpen(false)
      dismissNotification(notification._id)
      navigate(getNotifRoute(notification))
    },
    [navigate, dismissNotification],
  )

  if (loading) return <LoadingScreen />
  if (!user) return <Login />

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <Toaster position="top-right" />
      <div className="flex min-h-screen">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
          <SidebarContent
            user={user}
            onLogout={handleLogout}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Mobile top header ── */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Gestion Courrier</p>
                  <p className="text-xs text-slate-500">{user.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Bell for mobile */}
                <div className="relative">
                  <button
                    ref={bellMobileRef}
                    id="notif-bell-mobile"
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    aria-label="Notifications"
                  >
                    <Bell size={19} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
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
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600"
                  aria-label="Ouvrir le menu"
                >
                  <Menu size={20} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Mobile slide-over menu ── */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden">
              <div className="h-full w-80 max-w-[85vw] bg-white px-4 py-5 shadow-xl">
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    aria-label="Fermer le menu"
                  >
                    <X size={20} />
                  </button>
                </div>
                <SidebarContent
                  user={user}
                  onLogout={handleLogout}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              </div>
            </div>
          )}

          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            {/* ── Desktop top bar ── */}
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Espace connecte
                </p>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Gestion des courriers
                </h1>
              </div>

              <div className="flex items-center gap-3">

                {/* ── Bell icon (desktop) ── */}
                <div className="relative">
                  <button
                    ref={bellDesktopRef}
                    id="notif-bell-desktop"
                    type="button"
                    onClick={() => setPanelOpen((v) => !v)}
                    className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                    aria-label="Notifications"
                  >
                    <Bell size={19} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
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
                </div>

                <UserSummary user={user} />
              </div>
            </div>

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/recus" element={<ReceivedCourriers />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/archives" element={<Archives />} />
              <Route path="/validation" element={<Validation />} />
              <Route path="/envoyes" element={<SentCourriers />} />
              <Route path="/utilisateurs" element={<UsersPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

// ─── Notification Panel ───────────────────────────────────────────────────────

import { forwardRef } from 'react'

const NotificationPanel = forwardRef(function NotificationPanel(
  { notifications, onDismiss, onDismissAll, onClose, onNotificationClick },
  ref,
) {
  return (
    <div
      ref={ref}
      id="notification-panel"
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[360px] max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={{ animation: 'notifSlideIn 180ms ease both' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">
            Notifications
          </span>
          {notifications.length > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-600">
              {notifications.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onDismissAll}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
              Tout supprimer
            </button>
          )}
          {/* Close panel button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer les notifications"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Bell size={22} />
            </div>
            <p className="text-sm font-medium text-slate-500">
              Aucune notification
            </p>
            <p className="text-xs text-slate-400">
              Vous recevrez une alerte pour chaque nouveau courrier.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif._id}
                notification={notif}
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
    courrier_received: { dot: 'bg-emerald-500', bg: 'hover:bg-emerald-50' },
    validation_requested: { dot: 'bg-amber-500', bg: 'hover:bg-amber-50' },
    message_sent: { dot: 'bg-sky-500', bg: 'hover:bg-sky-50' },
  }
  const rawType = notification.type || ''
  const dataType = notification.data?.type || ''
  const isValidation = rawType === 'validation_requested' || dataType === 'validation_requested' || rawType.includes('ValidationRequestedNotification')

  const colors = isValidation
    ? typeColors.validation_requested
    : typeColors[rawType] || typeColors[dataType] || { dot: 'bg-slate-400', bg: 'hover:bg-slate-50' }

  function formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `Il y a ${diffHrs} h`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <li className={`flex items-start gap-3 px-4 py-3.5 transition ${colors.bg}`}>
      {/* Clickable content */}
      <button
        type="button"
        onClick={() => onClick(notification)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        aria-label={`Voir le courrier: ${notification.titre || notification.message}`}
      >
        {/* Colored dot */}
        <div className="mt-1.5 flex-shrink-0">
          <span className={`block h-2.5 w-2.5 rounded-full ${colors.dot}`} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 leading-snug">
            {notification.titre || 'Notification'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
            {notification.message}
          </p>
          {notification.courrier_numero && (
            <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {notification.courrier_numero}
            </span>
          )}
          <p className="mt-1 text-[10px] text-slate-400">{formatTime(notification._at)}</p>
        </div>
      </button>

      {/* Dismiss X — always visible */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(notification._id)
        }}
        className="mt-1 flex-shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Supprimer la notification"
      >
        <X size={14} />
      </button>
    </li>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SidebarContent({ user, onLogout, onNavigate }) {
  const canValidateCourriers =
    user?.permissions?.peut_valider_courriers === true ||
    ['chef', 'admin'].includes(String(user?.role || '').trim().toLowerCase())

  return (
    <>
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
          <FileText size={22} />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-950">
            Gestion Courrier
          </h1>
          <p className="truncate text-sm text-slate-500">Tableau de bord</p>
        </div>
      </div>

      <nav className="space-y-1">
        <MenuLink to="/" icon={<Inbox size={18} />} onNavigate={onNavigate}>
          Tableau de bord
        </MenuLink>

        <MenuLink to="/recus" icon={<FileText size={18} />} onNavigate={onNavigate}>
          Courriers recus
        </MenuLink>

        <MenuLink to="/envoyes" icon={<Send size={18} />} onNavigate={onNavigate}>
          Courriers envoyes
        </MenuLink>

        <MenuLink
          to="/messages"
          icon={<MessageSquare size={18} />}
          onNavigate={onNavigate}
        >
          Messages
        </MenuLink>

        <MenuLink to="/archives" icon={<Archive size={18} />} onNavigate={onNavigate}>
          Archives
        </MenuLink>

        {canValidateCourriers && (
          <MenuLink
            to="/validation"
            icon={<ShieldAlert size={18} />}
            onNavigate={onNavigate}
          >
            Validation
          </MenuLink>
        )}

        {user?.permissions?.peut_gerer_utilisateurs && (
          <MenuLink
            to="/utilisateurs"
            icon={<Users size={18} />}
            onNavigate={onNavigate}
          >
            Utilisateurs
          </MenuLink>
        )}
      </nav>

      <div className="mt-auto pt-6">
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-900">
              {getInitials(user)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {user.nom_complet}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
            <ShieldCheck size={14} />
            Session active
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut size={17} />
          Deconnexion
        </button>
      </div>
    </>
  )
}

// ─── Small reusable components ────────────────────────────────────────────────

function MenuLink({ to, icon, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive
          ? 'bg-slate-950 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

function UserSummary({ user }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <UserRound size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">
          {user.nom_complet}
        </p>
        <p className="truncate text-xs text-slate-500">
          {user.service?.libelle || user.role}
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
        <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        Verification de la session...
      </div>
    </div>
  )
}

function getInitials(user) {
  return `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() || 'GC'
}

export default App
