import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Archive, Filter, RefreshCw, Search, X } from 'lucide-react'

import { courrierApi } from '../api/courrierApi'
import { serviceApi } from '../api/serviceApi'
import { buildPageCacheKey, getPageCache, invalidatePageCache, setPageCache } from '../lib/pageCache'
import { formatDate, getStatusBadgeClass, getStatusLabel } from '../lib/courrier'
import ArchiveDetails from '../components/ArchiveDetails'
import Pagination from '../components/Pagination'

const ARCHIVES_CACHE_TTL = 5 * 60 * 1000

const DEFAULT_FILTERS = {
  q: '',
  numero: '',
  objet: '',
  contenu: '',
  expediteur: '',
  destinataire: '',
  type: '',
  statut_original: '',
  date_reception_from: '',
  date_reception_to: '',
  archive_from: '',
  archive_to: '',
  service_id: '',
  structure_id: '',
  niveau_confidentialite_id: '',
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function entityLabel(entity) {
  return entity?.libelle || entity?.nom || entity?.name || ''
}

function getApiErrorMessage(err) {
  return (
    err.response?.data?.message ||
    err.response?.data?.detail ||
    err.response?.data?.error ||
    (err.response?.data?.errors ? Object.values(err.response.data.errors).flat()[0] : '') ||
    "L'action a échoué."
  )
}

function archiveSearchTerm(filters) {
  return (
    filters.q ||
    filters.numero ||
    filters.objet ||
    filters.contenu ||
    filters.expediteur ||
    filters.destinataire ||
    ''
  )
}

export default function Archives() {
  const [archives, setArchives] = useState([])
  const [selectedArchiveId, setSelectedArchiveId] = useState(null)
  const [selectedArchive, setSelectedArchive] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [services, setServices] = useState([])
  const [structures, setStructures] = useState([])
  const [confidentialityLevels, setConfidentialityLevels] = useState([])
  const selectedArchiveIdRef = useRef(null)
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  const loadArchiveDetail = useCallback(async (id, queryFilters = DEFAULT_FILTERS, summary = null) => {
    if (!id) {
      setSelectedArchive(null)
      setDetailLoading(false)
      return
    }

    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setDetailLoading(true)
    if (summary) {
      setSelectedArchive(summary)
    }

    try {
      const res = await courrierApi.getArchive(id, cleanParams({ q: archiveSearchTerm(queryFilters) }))
      if (detailRequestRef.current !== requestId) return
      setSelectedArchive(res.data.archive)
    } catch (err) {
      if (detailRequestRef.current !== requestId) return
      setError(getApiErrorMessage(err) || "Erreur lors du chargement de l'archive.")
      setSelectedArchive(null)
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }, [])

  const applyArchiveList = useCallback((items, paginationData, queryFilters) => {
    setArchives(items)
    setPagination(paginationData || null)

    const preferredId = selectedArchiveIdRef.current
    const nextArchive =
      (preferredId && items.find((archive) => archive.id === preferredId)) ||
      items[0] ||
      null

    selectedArchiveIdRef.current = nextArchive?.id || null
    setSelectedArchiveId(nextArchive?.id || null)

    if (nextArchive) {
      loadArchiveDetail(nextArchive.id, queryFilters, nextArchive)
    } else {
      setSelectedArchive(null)
      setDetailLoading(false)
    }
  }, [loadArchiveDetail])

  const loadArchives = useCallback(async (queryFilters, pageNumber) => {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    const query = cleanParams({ ...queryFilters, page: pageNumber })
    const cacheKey = buildPageCacheKey('archives', query)
    const cached = getPageCache(cacheKey)

    setError('')

    if (cached) {
      applyArchiveList(cached.archives || [], cached.pagination || null, queryFilters)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const res = await courrierApi.getArchived(query)
      if (listRequestRef.current !== requestId) return

      const paginationData = res.data.archives || res.data.courriers || null
      const items = paginationData?.data || []

      setPageCache(
        cacheKey,
        {
          archives: items,
          pagination: paginationData,
        },
        ARCHIVES_CACHE_TTL,
      )

      applyArchiveList(items, paginationData, queryFilters)
    } catch (err) {
      if (listRequestRef.current !== requestId) return
      setArchives([])
      setPagination(null)
      setSelectedArchiveId(null)
      selectedArchiveIdRef.current = null
      setSelectedArchive(null)
      setError(getApiErrorMessage(err) || 'Erreur lors du chargement des archives.')
    } finally {
      if (listRequestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [applyArchiveList])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadArchives(filters, page)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [filters, loadArchives, page])

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      serviceApi.getAll({ per_page: 500 }),
      courrierApi.getCreateData(),
    ]).then(([servicesResult, createDataResult]) => {
        if (cancelled) return

        if (servicesResult.status === 'fulfilled') {
          setServices(servicesResult.value.data.services?.data || [])
          setStructures(servicesResult.value.data.meta?.structures || [])
        } else {
          setServices([])
          setStructures([])
        }

        if (createDataResult.status === 'fulfilled') {
          setConfidentialityLevels(createDataResult.value.data.niveaux_confidentialite || [])
        } else {
          setConfidentialityLevels([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateFilter = (key, value) => {
    invalidatePageCache(['archives'])
    selectedArchiveIdRef.current = null
    setSelectedArchiveId(null)
    setSelectedArchive(null)
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const resetFilters = () => {
    invalidatePageCache(['archives'])
    selectedArchiveIdRef.current = null
    setSelectedArchiveId(null)
    setSelectedArchive(null)
    setPage(1)
    setFilters(DEFAULT_FILTERS)
  }

  const handleSelectArchive = (archive) => {
    selectedArchiveIdRef.current = archive.id
    setSelectedArchiveId(archive.id)
    loadArchiveDetail(archive.id, filters, archive)
  }

  const handlePageChange = (nextPage) => {
    invalidatePageCache(['archives'])
    selectedArchiveIdRef.current = null
    setSelectedArchiveId(null)
    setSelectedArchive(null)
    setPage(nextPage)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-6">
      <section className="glass-panel-strong rounded-[2rem] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Archive size={21} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Archives</h1>
              <p className="text-xs text-slate-500">Recherche et consultation des courriers archivés.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadArchives(filters, page)}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Filter size={16} />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Filtres</h2>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <X size={14} />
              Réinitialiser
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterInput icon={<Search size={14} />} label="Recherche générale" value={filters.q} onChange={(value) => updateFilter('q', value)} />
          <FilterInput label="Numéro" value={filters.numero} onChange={(value) => updateFilter('numero', value)} />
          <FilterInput label="Objet / titre" value={filters.objet} onChange={(value) => updateFilter('objet', value)} />
          <FilterInput label="Contenu / OCR" value={filters.contenu} onChange={(value) => updateFilter('contenu', value)} />
          <FilterInput label="Expéditeur" value={filters.expediteur} onChange={(value) => updateFilter('expediteur', value)} />
          <FilterInput label="Destinataire" value={filters.destinataire} onChange={(value) => updateFilter('destinataire', value)} />
          <FilterSelect label="Type" value={filters.type} onChange={(value) => updateFilter('type', value)}>
            <option value="">Tous</option>
            <option value="entrant">Entrant</option>
            <option value="sortant">Sortant</option>
          </FilterSelect>
          <FilterSelect label="Statut original" value={filters.statut_original} onChange={(value) => updateFilter('statut_original', value)}>
            <option value="">Tous</option>
            <option value="CREE">Créé</option>
            <option value="NON_VALIDE">Non valide</option>
            <option value="VALIDE">Validé</option>
            <option value="TRANSMIS">Transmis</option>
            <option value="RECU">Reçu</option>
          </FilterSelect>
          <FilterInput label="Réception de" type="date" value={filters.date_reception_from} onChange={(value) => updateFilter('date_reception_from', value)} />
          <FilterInput label="Réception à" type="date" value={filters.date_reception_to} onChange={(value) => updateFilter('date_reception_to', value)} />
          <FilterInput label="Archivage de" type="date" value={filters.archive_from} onChange={(value) => updateFilter('archive_from', value)} />
          <FilterInput label="Archivage a" type="date" value={filters.archive_to} onChange={(value) => updateFilter('archive_to', value)} />
          <FilterSelect label="Service" value={filters.service_id} onChange={(value) => updateFilter('service_id', value)}>
            <option value="">Tous</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.libelle}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Structure" value={filters.structure_id} onChange={(value) => updateFilter('structure_id', value)}>
            <option value="">Toutes</option>
            {structures.map((structure) => (
              <option key={structure.id} value={structure.id}>{structure.libelle}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Confidentialité" value={filters.niveau_confidentialite_id} onChange={(value) => updateFilter('niveau_confidentialite_id', value)}>
            <option value="">Tous</option>
            {confidentialityLevels.map((level) => (
              <option key={level.id} value={level.id}>{level.libelle}</option>
            ))}
          </FilterSelect>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <div className="min-w-0">
          <div className="table-shell overflow-hidden rounded-[2rem]">
            <ArchiveTable
              archives={archives}
              loading={loading}
              selectedArchiveId={selectedArchiveId}
              onSelect={handleSelectArchive}
            />
            <Pagination pagination={pagination} onPageChange={handlePageChange} loading={loading} />
          </div>
        </div>

        <aside className="min-w-0">
          <ArchiveDetails archive={selectedArchive} loading={detailLoading} searchTerm={archiveSearchTerm(filters)} />
        </aside>
      </div>
    </div>
  )
}

function FilterInput({ label, value, onChange, type = 'text', icon = null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="relative block">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 ${icon ? 'pl-9' : ''}`}
        />
      </span>
    </label>
  )
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      >
        {children}
      </select>
    </label>
  )
}

function ArchiveTable({ archives, loading, selectedArchiveId, onSelect }) {
  if (loading && archives.length === 0) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (archives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Archive className="text-slate-300" size={34} />
        <h3 className="mt-4 text-sm font-bold text-slate-600">Aucun courrier archivé trouvé</h3>
        <p className="mt-1 text-xs text-slate-400">Modifiez les filtres ou lancez une autre recherche.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-white">
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Numéro</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Objet</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Expéditeur</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Archivé le</th>
            <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {archives.map((archive) => {
            const selected = selectedArchiveId === archive.id
            return (
              <tr
                key={archive.id}
                onClick={() => onSelect(archive)}
                className={`cursor-pointer transition-colors ${selected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
              >
                <td className="px-4 py-3.5 text-xs font-bold text-slate-700">{archive.numero}</td>
                <td className="max-w-[320px] px-4 py-3.5">
                  <p className="truncate text-sm font-semibold text-slate-800">{archive.objet || '-'}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">{entityLabel(archive.service_source)} vers {entityLabel(archive.service_destinataire) || archive.destinataire || '-'}</p>
                </td>
                <td className="px-4 py-3.5 text-xs text-slate-500">{archive.expediteur || '-'}</td>
                <td className="px-4 py-3.5 text-xs text-slate-400">{formatDate(archive.archive_le)}</td>
                <td className="px-4 py-3.5 text-center">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${getStatusBadgeClass(archive.statut_original)}`}>
                    {getStatusLabel(archive.statut_original)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-xs font-semibold text-slate-400">
                  {archive.match_score ?? archive.search_score ?? '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
