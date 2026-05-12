import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Plus, Search, Send } from 'lucide-react'

import { courrierApi } from '../api/courrierApi'
import { buildPageCacheKey, invalidatePageCache, getPageCache, setPageCache } from '../lib/pageCache'
import { useAuth } from '../context/auth-context'
import CourrierDetails from '../components/CourrierDetails'
import CourrierTable from '../components/CourrierTable'
import Pagination from '../components/Pagination'
import { ModalSkeleton } from '../components/SkeletonLoader'

const CourrierForm = lazy(() => import('../components/CourrierForm'))
const SENT_CACHE_TTL = 5 * 60 * 1000

export default function SentCourriers() {
  const { user } = useAuth()
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')

  // Vérifier si l'utilisateur peut créer un courrier sortant
  const canCreateOutgoingCourrier = () => {
    if (!user) return false
    const role = String(user.role || '').trim().toLowerCase()
    const scope = String(user.role_scope || '').trim().toLowerCase()

    // Admin peut toujours créer
    if (role === 'admin') return true

    // Chef général ou Secrétaire général peuvent créer
    if (scope === 'general' && (role === 'chef' || role === 'secretaire')) return true

    return false
  }

  const getApiErrorMessage = (err) =>
    err.response?.data?.message ||
    err.response?.data?.detail ||
    err.response?.data?.error ||
    (err.response?.data?.errors
      ? Object.values(err.response.data.errors).flat()[0]
      : '') ||
    "L'action a échoué."

  const selectedIdRef = useRef(null)

  const applyCourriers = useCallback((items, preferredId = null) => {
    setCourriers(items)
    const nextId = preferredId ?? selectedIdRef.current
    const next = items.find((item) => item.id === nextId) || null
    selectedIdRef.current = next?.id || null
    setSelectedCourrier(next)
  }, [])

  const loadData = useCallback(
    async (params = {}, options = {}) => {
      const { preferCache = false, revalidate = false } = options
      const query = { ...params, q: search || undefined }
      const cacheKey = buildPageCacheKey('sent', query)
      const cached = getPageCache(cacheKey)

      if (preferCache && cached) {
        applyCourriers(cached.courriers || [], cached.selectedId)
        setPagination(cached.pagination || null)
        setError('')
        setLoading(false)

        if (!revalidate) {
          return
        }
      } else {
        setLoading(true)
      }

      try {
        setError('')

        const res = await courrierApi.getSent(query)
        const items = res.data.courriers.data
        const nextSelectedId =
          selectedIdRef.current && items.some((item) => item.id === selectedIdRef.current)
            ? selectedIdRef.current
            : null

        applyCourriers(items, nextSelectedId)
        setPagination(res.data.courriers)

        setPageCache(
          cacheKey,
          {
            courriers: items,
            selectedId: nextSelectedId,
            pagination: res.data.courriers,
          },
          SENT_CACHE_TTL,
        )
      } catch (err) {
        setError(getApiErrorMessage(err) || 'Erreur lors du chargement des courriers envoyés.')
      } finally {
        setLoading(false)
      }
    },
    [applyCourriers, search],
  )

  useEffect(() => {
    loadData({}, { preferCache: true, revalidate: true })
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
      await loadData()
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Send size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Courriers envoyés</h2>
              <p className="mt-1 text-sm text-slate-500">
                Suivi rapide du flux sortant et accès direct aux transmissions.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="glass-panel relative rounded-[1.25rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loadData({ page: 1 })}
                placeholder="Rechercher un envoi..."
                className="h-11 w-full min-w-0 rounded-[1.25rem] border-0 bg-transparent pl-10 pr-4 text-sm outline-none sm:w-72"
              />
            </div>

            {canCreateOutgoingCourrier() && (
              <button
                onMouseEnter={() => import('../components/CourrierForm')}
                onFocus={() => import('../components/CourrierForm')}
                onClick={() => setFormOpen(true)}
                className="rounded-[1.25rem] px-4 py-3 text-sm font-semibold bg-slate-950 text-white shadow-lg shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-slate-800"
              >
                <span className="flex items-center justify-center gap-2">
                  <Plus size={16} />
                  Nouveau depart
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="glass-panel rounded-[1.5rem] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0">
          <div className="table-shell overflow-hidden rounded-[2rem]">
            <div className="overflow-x-auto">
              <CourrierTable
                courriers={courriers}
                loading={loading}
                selectedCourrier={selectedCourrier}
                onSelect={setSelectedCourrier}
              />
            </div>

            <div className="soft-divider border-t px-4 py-4">
              <Pagination pagination={pagination} onPageChange={(page) => loadData({ page })} />
            </div>
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

      {formOpen && (
        <Suspense fallback={<ModalSkeleton title="Chargement du formulaire..." />}>
          <CourrierForm
            type="sortant"
            onClose={() => setFormOpen(false)}
            onSuccess={() => {
              setFormOpen(false)
              invalidatePageCache(['dashboard', 'received', 'sent'])
              loadData()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
