import { useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Archive,
  FileText,
  Inbox,
  LogOut,
  Menu,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
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

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  )
}

function AuthenticatedApp() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Login />
  }

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
          <SidebarContent
            user={user}
            onLogout={handleLogout}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
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

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600"
                aria-label="Ouvrir le menu"
              >
                <Menu size={20} />
              </button>
            </div>
          </header>

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
            <div className="mb-6 hidden items-center justify-between lg:flex">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Espace connecte
                </p>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Gestion des courriers
                </h1>
              </div>

              <UserSummary user={user} />
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

function MenuLink({ to, icon, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive
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
