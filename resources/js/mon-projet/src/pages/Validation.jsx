import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Search, ShieldAlert } from 'lucide-react'

import { courrierApi } from '../api/courrierApi'
import { buildPageCacheKey, invalidatePageCache, getPageCache, setPageCache } from '../lib/pageCache'
import Pagination from '../components/Pagination'
import CourrierTable from '../components/CourrierTable'
import CourrierDetails from '../components/CourrierDetails'

const VALIDATION_CACHE_TTL = 3 * 60 * 1000

export default function Validation() {
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const getApiErrorMessage = useCallback((err) => {
    return (
      err.response?.data?.message ||
      err.response?.data?.detail ||
      err.response?.data?.error ||
      (err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat()[0]
        : '') ||
      "L'action a echoue."
    )
  }, [])

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
      const query = { ...params, q: search || undefined }
      const cacheKey = buildPageCacheKey('validation', query)
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

        const res = await courrierApi.getValidationQueue(query)
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
          VALIDATION_CACHE_TTL,
        )
      } catch (err) {
        setError(getApiErrorMessage(err) || 'Erreur lors du chargement de la file de validation.')
      } finally {
        setLoading(false)
      }
    },
    [applyCourriers, getApiErrorMessage, search, selectedCourrier?.id],
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
      <div className="glass-panel-strong rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-red-100 text-red-700 rounded-lg flex items-center justify-center">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Validation</h1>
            <p className="text-xs text-slate-500">Courriers en attente de signature ou validation.</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && loadData({ page: 1 })}
            placeholder="Rechercher dans la file..."
            className="h-10 w-full sm:w-64 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

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
