import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Clock,
  Inbox,
  Plus,
  Send,
  ShieldAlert,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { courrierApi } from '../api/courrierApi'
import { messageApi } from '../api/messageApi'
import { useAuth } from '../context/auth-context'
import { buildPageCacheKey, invalidatePageCache, getPageCache, setPageCache } from '../lib/pageCache'
import CourrierDetails from '../components/CourrierDetails'
import CourrierTable from '../components/CourrierTable'
import SkeletonLoader, { ModalSkeleton } from '../components/SkeletonLoader'

const CourrierForm = lazy(() => import('../components/CourrierForm'))
const DASHBOARD_CACHE_KEY = buildPageCacheKey('dashboard', { page: 1 })
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState('sortant')
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [error, setError] = useState('')
  const canCreateIncoming = user?.permissions?.peut_creer_courrier_recu === true

  const getApiErrorMessage = (err) =>
    err.response?.data?.message ||
    err.response?.data?.detail ||
    err.response?.data?.error ||
    (err.response?.data?.errors
      ? Object.values(err.response.data.errors).flat()[0]
      : '') ||
    "L'action a echoue."

  const applyCourriers = useCallback((courriersList, preferredId = null) => {
    setCourriers(courriersList)
    setSelectedCourrier((current) => {
      const nextId = preferredId ?? current?.id

      return (
        courriersList.find((courrier) => courrier.id === nextId) ||
        courriersList[0] ||
        null
      )
    })
  }, [])

  const applyCachedData = useCallback(
    (cached) => {
      applyCourriers(cached.courriers || [], cached.selectedId)
      setStats(cached.stats || {})
      setUnreadMessages(cached.unreadMessages || 0)
      setError('')
      setLoading(false)
    },
    [applyCourriers],
  )

  const loadData = useCallback(
    async ({ preferCache = false, revalidate = false } = {}) => {
      const cached = getPageCache(DASHBOARD_CACHE_KEY)

      if (preferCache && cached) {
        applyCachedData(cached)

        if (!revalidate) {
          return
        }
      } else {
        setLoading(true)
      }

      try {
        setError('')

        const [courriersRes, statsRes, unreadRes] = await Promise.all([
          courrierApi.getReceived({ page: 1 }),
          courrierApi.stats(),
          messageApi.unreadCount(),
        ])

        const courriersList = courriersRes.data?.courriers?.data || []
        const nextStats = statsRes.data?.courriers || {}
        const nextUnreadMessages = unreadRes.data?.non_lus || 0
        const nextSelectedId =
          selectedCourrier?.id && courriersList.some((courrier) => courrier.id === selectedCourrier.id)
            ? selectedCourrier.id
            : courriersList[0]?.id || null

        applyCourriers(courriersList, nextSelectedId)
        setStats(nextStats)
        setUnreadMessages(nextUnreadMessages)

        setPageCache(
          DASHBOARD_CACHE_KEY,
          {
            courriers: courriersList,
            selectedId: nextSelectedId,
            stats: nextStats,
            unreadMessages: nextUnreadMessages,
          },
          DASHBOARD_CACHE_TTL,
        )
      } catch (err) {
        setError(getApiErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [applyCachedData, applyCourriers, selectedCourrier?.id],
  )

  useEffect(() => {
    loadData({ preferCache: true, revalidate: true })
  }, [loadData])

  const handleAction = async (action, id, data = {}) => {
    setActionLoading(true)
    setError('')

    try {
      if (action === 'archive') await courrierApi.archive(id)
      if (action === 'delete') await courrierApi.delete(id)
      if (action === 'validate') await courrierApi.validate(id)
      if (action === 'reject') await courrierApi.markAsNotValidated(id)
      if (action === 'transmit') await courrierApi.transmit(id, data)

      invalidatePageCache(['dashboard', 'received', 'archives', 'validation', 'sent'])
      await loadData({ revalidate: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong overflow-hidden rounded-[2rem] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <p className="w-fit rounded-full bg-blue-600/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              Espace de pilotage
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Bonjour, {user?.prenom}. <span className="gradient-text">Flux courrier centralise.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              Suivez les receptions recentes, les validations en attente et la messagerie interne
              depuis une vue plus legere et plus rapide a charger.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onMouseEnter={() => import('../components/CourrierForm')}
              onFocus={() => import('../components/CourrierForm')}
              onClick={() => setShowTypeSelector(true)}
              className="rounded-[1.25rem] bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-slate-800"
            >
              <span className="flex items-center gap-2">
                <Plus size={18} />
                Nouveau courrier
              </span>
            </button>
            <button
              onClick={() => navigate('/messages')}
              className="glass-panel rounded-[1.25rem] px-5 py-3 text-sm font-semibold text-slate-700 hover:-translate-y-0.5 hover:text-slate-950"
            >
              Messages non lus: {unreadMessages}
            </button>
          </div>
        </div>
      </section>

      {loading && !stats ? (
        <SkeletonLoader variant="stats" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatItem icon={<Inbox className="text-blue-600" />} label="Recus" value={stats?.recus || 0} />
          <StatItem icon={<Send className="text-indigo-600" />} label="Sortants" value={stats?.envoyes || 0} />
          <StatItem icon={<Clock className="text-amber-600" />} label="En attente" value={stats?.en_attente_reponse || 0} />
          <StatItem icon={<ShieldAlert className="text-rose-600" />} label="A valider" value={stats?.validation || 0} />
        </div>
      )}

      {error && (
        <div className="glass-panel rounded-[1.5rem] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700">
          <span className="flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0 space-y-6">
          <section className="table-shell overflow-hidden rounded-[2rem]">
            <div className="soft-divider flex items-center justify-between border-b bg-white/70 px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Receptions recentes
                </h3>
                <p className="mt-1 text-sm text-slate-500">Selection rapide et panneau de details persistant.</p>
              </div>
              <button
                onClick={() => navigate('/recus')}
                className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Voir tout
              </button>
            </div>
            <div className="overflow-x-auto">
              <CourrierTable
                courriers={courriers}
                loading={loading}
                selectedCourrier={selectedCourrier}
                onSelect={setSelectedCourrier}
              />
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <QuickLink
              title="Messagerie"
              count={unreadMessages}
              helper="Messages internes"
              icon={<Inbox size={16} />}
              link="/messages"
            />
            <QuickLink
              title="Archives"
              count={stats?.archives || 0}
              helper="Historique global"
              icon={<Archive size={16} />}
              link="/archives"
            />
          </div>
        </div>

        <div className="min-w-0">
          <CourrierDetails
            courrier={selectedCourrier}
            actionLoading={actionLoading}
            onArchive={() => handleAction('archive', selectedCourrier.id)}
            onDelete={() => handleAction('delete', selectedCourrier.id)}
            onValidate={() => handleAction('validate', selectedCourrier.id)}
            onReject={() => handleAction('reject', selectedCourrier.id)}
            onTransmit={(id, data) => handleAction('transmit', id, data)}
          />
        </div>
      </div>

      {showTypeSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="glass-panel-strong float-in w-full max-w-md rounded-[2rem] overflow-hidden">
            <div className="soft-divider border-b px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-950">Nouveau courrier</h3>
              <p className="mt-1 text-sm text-slate-500">Choisissez le flux a creer.</p>
            </div>

            <div className="space-y-3 p-6">
              <TypeCard
                title="Courrier sortant"
                description="Creer un nouveau courrier de depart."
                icon={<Send size={20} />}
                tone="blue"
                onClick={() => {
                  setFormType('sortant')
                  setShowTypeSelector(false)
                  setFormOpen(true)
                }}
              />

              {canCreateIncoming && (
                <TypeCard
                  title="Courrier recu"
                  description="Enregistrer un courrier entrant."
                  icon={<Inbox size={20} />}
                  tone="emerald"
                  onClick={() => {
                    setFormType('entrant')
                    setShowTypeSelector(false)
                    setFormOpen(true)
                  }}
                />
              )}
            </div>

            <div className="soft-divider flex justify-end border-t px-6 py-4">
              <button
                onClick={() => setShowTypeSelector(false)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <Suspense fallback={<ModalSkeleton title="Chargement du formulaire..." />}>
          <CourrierForm
            type={formType}
            onClose={() => {
              setFormOpen(false)
              setFormType('sortant')
            }}
            onSuccess={() => {
              setFormOpen(false)
              setFormType('sortant')
              invalidatePageCache(['dashboard', 'received', 'sent'])
              loadData({ revalidate: true })
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

function StatItem({ icon, label, value }) {
  return (
    <div className="glass-panel-strong metric-card rounded-[1.75rem] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickLink({ title, count, helper, icon, link }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate(link)}
      className="glass-panel group rounded-[1.75rem] p-5 text-left hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">{helper}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-900" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{count} element(s)</p>
    </button>
  )
}

function TypeCard({ title, description, icon, tone, onClick }) {
  const tones = {
    blue: {
      card: 'hover:border-blue-300 hover:bg-blue-50/70',
      icon: 'bg-blue-100 text-blue-600',
    },
    emerald: {
      card: 'hover:border-emerald-300 hover:bg-emerald-50/70',
      icon: 'bg-emerald-100 text-emerald-600',
    },
  }
  const toneClasses = tones[tone]

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-[1.5rem] border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 ${toneClasses.card}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses.icon}`}>
          {icon}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </button>
  )
}
