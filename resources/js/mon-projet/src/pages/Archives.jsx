import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Archive, Filter, Search, X } from 'lucide-react'

import { courrierApi } from '../api/courrierApi'
import { buildPageCacheKey, invalidatePageCache, getPageCache, setPageCache } from '../lib/pageCache'
import Pagination from '../components/Pagination'
import CourrierTable from '../components/CourrierTable'
import CourrierDetails from '../components/CourrierDetails'

const ARCHIVES_CACHE_TTL = 5 * 60 * 1000

export default function Archives() {
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    type: '',
    date_from: '',
    date_to: '',
    structure_id: '',
  })

  const applyCourriers = useCallback((items, preferredId = null) => {
    setCourriers(items)
    setSelectedCourrier((current) => {
      const nextId = preferredId ?? current?.id

      return items.find((item) => item.id === nextId) || items[0] || null
    })
  }, [])

  const loadData = useCallback(
    async (params = {}, options = {}) => {
      const { preferCache = false, revalidate = false } = options
      const query = { ...filters, ...params }
      const cacheKey = buildPageCacheKey('archives', query)
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
        const res = await courrierApi.getArchived(query)
        const items = res.data.courriers.data
        const nextSelectedId =
          selectedCourrier?.id && items.some((item) => item.id === selectedCourrier.id)
            ? selectedCourrier.id
            : items[0]?.id || null

        applyCourriers(items, nextSelectedId)
        setPagination(res.data.courriers)
        setPageCache(
          cacheKey,
          {
            courriers: items,
            selectedId: nextSelectedId,
            pagination: res.data.courriers,
          },
          ARCHIVES_CACHE_TTL,
        )
      } catch {
        setError('Erreur lors du chargement des archives.')
      } finally {
        setLoading(false)
      }
    },
    [applyCourriers, filters, selectedCourrier?.id],
  )

  useEffect(() => {
    loadData({}, { preferCache: true, revalidate: true })
  }, [loadData])

  const handleAction = async (action, id, data = {}) => {
    try {
      setActionLoading(true)

      if (action === 'archive') await courrierApi.archive(id)
      if (action === 'delete') await courrierApi.delete(id)
      if (action === 'validate') await courrierApi.validate(id)
      if (action === 'reject') await courrierApi.markAsNotValidated(id)
      if (action === 'transmit') await courrierApi.transmit(id, data)

      invalidatePageCache(['dashboard', 'received', 'archives', 'validation', 'sent'])
      await loadData()
    } catch {
      setError("Erreur lors de l'action sur l'archive.")
    } finally {
      setActionLoading(false)
    }
  }

  const resetFilters = () => {
    const defaultFilters = {
      q: '',
      type: '',
      date_from: '',
      date_to: '',
      structure_id: '',
    }

    setFilters(defaultFilters)
    loadData(defaultFilters)
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel-strong rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
            <Archive size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Archives</h1>
            <p className="text-xs text-slate-500">Historique complet des documents.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && loadData({ page: 1 })}
              placeholder="Rechercher..."
              className="h-10 w-full sm:w-64 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${
              showFilters
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="glass-panel float-in rounded-[2rem] p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
            <select
              value={filters.type}
              onChange={(event) => setFilters({ ...filters, type: event.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
            >
              <option value="">Tous les types</option>
              <option value="entrant">Entrant</option>
              <option value="sortant">Sortant</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Depuis le</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Jusqu'au</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => loadData({ page: 1 })} className="flex-1 h-10 bg-slate-900 text-white rounded-lg text-xs font-bold">
              Filtrer
            </button>
            <button onClick={resetFilters} className="h-10 px-3 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="table-shell rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <CourrierTable
                courriers={courriers}
                loading={loading}
                selectedCourrier={selectedCourrier}
                onSelect={setSelectedCourrier}
              />
            </div>
            <div className="p-4 border-t border-slate-100">
              <Pagination pagination={pagination} onPageChange={(page) => loadData({ page })} />
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <CourrierDetails
            courrier={selectedCourrier}
            actionLoading={actionLoading}
            onArchive={() => handleAction('archive', selectedCourrier.id)}
            onDelete={() => handleAction('delete', selectedCourrier.id)}
            onValidate={() => handleAction('validate', selectedCourrier.id)}
            onReject={() => handleAction('reject', selectedCourrier.id)}
            onTransmit={(id, data) => handleAction('transmit', id, data)}
          />
        </aside>
      </div>
    </div>
  )
}
