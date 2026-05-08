import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

import { courrierApi } from '../api/courrierApi'
import { useAuth } from '../context/auth-context'
import { buildPageCacheKey, invalidatePageCache, getPageCache, setPageCache } from '../lib/pageCache'
import CourrierTable from '../components/CourrierTable'
import CourrierDetails from '../components/CourrierDetails'
import Pagination from '../components/Pagination'
import SkeletonLoader from '../components/SkeletonLoader'

const CourrierForm = lazy(() => import('../components/CourrierForm'))
const CACHE_TTL = 5 * 60 * 1000

function Select({ items, value, onChange, allLabel = 'Tous' }) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-slate-200 transition cursor-pointer min-w-[130px]"
      >
        <option value="">{allLabel}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">{title}</h4>
      {children}
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-slate-400 shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">{value || '-'}</p>
      </div>
    </div>
  )
}

export default function ReceivedCourriers() {
  const { user } = useAuth()
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ statut: null, type: null })
  const [formOpen, setFormOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [error, setError] = useState('')
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const mountedRef = useRef(false)
  const canCreateIncoming = user?.permissions?.peut_creer_courrier_recu === true

  const getApiErrorMessage = (err) =>
    err.response?.data?.message ||
    err.response?.data?.detail ||
    err.response?.data?.error ||
    (err.response?.data?.errors
      ? Object.values(err.response.data.errors).flat()[0]
      : '') ||
    "L'action a echoue."

  const loadData = useCallback(
    async (params = {}, options = {}) => {
      const { skipCache = false, q, filterOverrides } = options
      const effectiveQ = q !== undefined ? q : search
      const effectiveFilters = filterOverrides ? { ...filters, ...filterOverrides } : filters
      const query = { ...params, ...effectiveFilters, q: effectiveQ || undefined }
      const cacheKey = buildPageCacheKey('received', query)
      const cached = getPageCache(cacheKey)

      if (!skipCache && !mountedRef.current && cached) {
        setCourriers(cached.courriers || [])
        setPagination(cached.pagination || null)
        setError('')
        setInitialLoading(false)
        mountedRef.current = true
        return
      }

      setError('')
      if (mountedRef.current) setRefreshing(true)

      try {
        const res = await courrierApi.getReceived(query)
        const items = res.data.courriers.data
        setCourriers(items)
        setPagination(res.data.courriers)
        setPageCache(cacheKey, { courriers: items, pagination: res.data.courriers }, CACHE_TTL)
      } catch (err) {
        setError(getApiErrorMessage(err) || 'Erreur lors du chargement.')
      } finally {
        setInitialLoading(false)
        setRefreshing(false)
        mountedRef.current = true
      }
    },
    [search, filters],
  )

  useEffect(() => {
    if (!mountedRef.current) {
      loadData({ page: 1 })
    }
  }, [])

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
      await loadData({ page: pagination?.current_page || 1 })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleSelect = (courrier) => {
    setSelectedCourrier(courrier)
    setShowMobileDetail(true)
  }

  const handleCloseDetail = () => {
    setSelectedCourrier(null)
    setShowMobileDetail(false)
  }

  const handleReply = (courrier) => {
    setReplyTo(courrier)
    setFormOpen(true)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    loadData({ page: 1 })
  }

  const handleResetFilters = () => {
    setSearch('')
    setFilters({ statut: null, type: null })
    loadData({ page: 1 }, { q: '', filterOverrides: { statut: null, type: null } })
  }

  const hasActiveFilters = search || filters.statut || filters.type

  if (initialLoading) {
    return (
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-5">
          <div className="h-5 w-40 skeleton rounded mb-2" />
          <div className="h-3 w-24 skeleton rounded" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <SkeletonLoader count={6} variant="table" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Courriers recus</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {pagination
              ? `${pagination.total} courrier${pagination.total > 1 ? 's' : ''}`
              : ''
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData({ page: pagination?.current_page || 1 })}
            disabled={refreshing}
            className="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
          {canCreateIncoming && (
            <button
              onClick={() => setFormOpen(true)}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Plus size={16} />
              Nouveau
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numero, objet..."
            className="w-full h-9 pl-9 pr-9 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-200 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); loadData({ page: 1 }, { q: '' }) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            items={[
              { value: 'RECU', label: 'Recu' },
              { value: 'TRANSMIS', label: 'Transmis' },
              { value: 'VALIDE', label: 'Valide' },
              { value: 'CREE', label: 'Cree' },
              { value: 'NON_VALIDE', label: 'Non valide' },
            ]}
            value={filters.statut}
            onChange={(v) => {
              const newFilters = { ...filters, statut: v }
              setFilters(newFilters)
              loadData({ page: 1 }, { filterOverrides: newFilters })
            }}
          />
          <Select
            items={[
              { value: 'arrivee', label: 'Arrivee' },
              { value: 'depart', label: 'Depart' },
              { value: 'interne', label: 'Interne' },
            ]}
            value={filters.type}
            onChange={(v) => {
              const newFilters = { ...filters, type: v }
              setFilters(newFilters)
              loadData({ page: 1 }, { filterOverrides: newFilters })
            }}
          />
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="h-9 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <X size={13} />
              Reinitialiser
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5">
        <div className={`flex-1 min-w-0 ${selectedCourrier && showMobileDetail ? 'hidden lg:block' : ''}`}>
          <div className="bg-white border border-slate-200 rounded-xl min-h-[400px] flex flex-col overflow-hidden">
            <div className="flex-1 relative">
              {refreshing && courriers.length > 0 && (
                <div className="absolute top-3 right-3 z-10">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              )}
              <CourrierTable
                courriers={courriers}
                loading={initialLoading || (refreshing && courriers.length === 0)}
                selectedCourrier={selectedCourrier}
                onSelect={handleSelect}
              />
            </div>
            <Pagination pagination={pagination} onPageChange={(page) => loadData({ page })} loading={refreshing || initialLoading} />
          </div>
        </div>

        {selectedCourrier && (
          <div className="hidden lg:block w-[400px] xl:w-[440px] shrink-0">
            <div className="sticky top-4 max-h-[calc(100vh-8rem)]">
              <CourrierDetails
                courrier={selectedCourrier}
                actionLoading={actionLoading}
                onValidate={(id) => handleAction('validate', id)}
                onArchive={(id) => handleAction('archive', id)}
                onDelete={(id) => handleAction('delete', id)}
                onTransmit={(id, data) => handleAction('transmit', id, data)}
                onReply={handleReply}
                onClose={handleCloseDetail}
                showCloseButton
              />
            </div>
          </div>
        )}

        {selectedCourrier && showMobileDetail && (
          <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <CourrierDetails
              courrier={selectedCourrier}
              actionLoading={actionLoading}
              onValidate={(id) => handleAction('validate', id)}
              onArchive={(id) => handleAction('archive', id)}
              onDelete={(id) => handleAction('delete', id)}
              onTransmit={(id, data) => handleAction('transmit', id, data)}
              onReply={handleReply}
              onClose={handleCloseDetail}
              showCloseButton
            />
          </div>
        )}
      </div>

      {formOpen && (
        <Suspense fallback={null}>
          <CourrierForm
            type={replyTo ? 'sortant' : 'entrant'}
            onClose={() => { setFormOpen(false); setReplyTo(null) }}
            initialData={replyTo ? { parent_courrier_id: replyTo.id, objet: 'Reponse: ' + replyTo.objet } : null}
            onSuccess={() => { setFormOpen(false); setReplyTo(null); invalidatePageCache(['dashboard', 'received', 'sent']); loadData() }}
          />
        </Suspense>
      )}
    </div>
  )
}
