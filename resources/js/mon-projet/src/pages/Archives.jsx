import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  CalendarDays,
  FileArchive,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import Pagination from '../components/Pagination'
import {
  formatDate,
  getConfidentialityLabel,
  isRestrictedContent,
} from '../lib/courrier'

export default function Archives() {
  const [archives, setArchives] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [dateReception, setDateReception] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const hasInitialized = useRef(false)

  async function loadArchives(params = {}) {
    try {
      setLoading(true)
      setError('')

      const response = await courrierApi.getArchived(params)
      const paginatedArchives = response.data.archives || response.data.courriers
      const list = paginatedArchives?.data || []

      setArchives(list)
      setPagination(paginatedArchives)
      setSelectedCourrier((current) => {
        if (current && list.some((item) => item.id === current.id)) {
          return list.find((item) => item.id === current.id)
        }

        return list[0] || null
      })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Impossible de charger les courriers archivés.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    void loadArchives()
  }, [])

  function handleSearch(event) {
    event.preventDefault()

    loadArchives({
      q: search || undefined,
      type: type || undefined,
      date_reception: dateReception || undefined,
    })
  }

  async function handleDelete() {
    if (!selectedCourrier) return

    const confirmed = window.confirm(
      `Supprimer définitivement le courrier archivé ${selectedCourrier.numero} ?`,
    )

    if (!confirmed) return

    try {
      setActionLoading(true)
      setError('')

      await courrierApi.deleteArchive(selectedCourrier.id)
      await loadArchives({
        q: search || undefined,
        type: type || undefined,
        date_reception: dateReception || undefined,
      })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Impossible de supprimer l'archive.",
      )
    } finally {
      setActionLoading(false)
    }
  }

  const stats = useMemo(() => {
    return {
      total: pagination?.total || archives.length,
      entrants: archives.filter((item) => item.type === 'entrant').length,
      sortants: archives.filter((item) => item.type === 'sortant').length,
      proteges: archives.filter(
        (item) => getConfidentialityLabel(item) !== '-',
      ).length,
    }
  }, [archives, pagination])

  return (
    <div className="space-y-6 page-enter">
      <section className="card-lift page-enter overflow-hidden rounded-[28px] border">
        <div className="relative isolate px-6 py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/40">
                <FileArchive size={24} />
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Centre d&apos;archivage
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Consultation, filtrage et suppression des courriers archivés avec
                un panneau de détail complet.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="grid gap-3 xl:min-w-[760px] xl:grid-cols-[minmax(0,1.4fr)_180px_180px_auto_auto]"
            >
              <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur">
                <Search size={17} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  placeholder="Numéro, objet, expéditeur, destinataire"
                />
              </label>

              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-700 outline-none shadow-sm"
              >
                <option value="">Tous les types</option>
                <option value="entrant">Entrants</option>
                <option value="sortant">Sortants</option>
              </select>

              <input
                type="month"
                value={dateReception}
                onChange={(event) => setDateReception(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-700 outline-none shadow-sm"
              />

              <button
                type="submit"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Search size={16} />
                Filtrer
              </button>

              <button
                type="button"
                onClick={() =>
                  loadArchives({
                    q: search || undefined,
                    type: type || undefined,
                    date_reception: dateReception || undefined,
                  })
                }
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Actualiser
              </button>
            </form>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="page-enter-delay-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Archives visibles" value={stats.total} icon={<Archive size={20} />} />
        <StatCard title="Courriers entrants" value={stats.entrants} icon={<FolderOpen size={20} />} />
        <StatCard title="Courriers sortants" value={stats.sortants} icon={<FileText size={20} />} />
        <StatCard title="Niveaux renseignés" value={stats.proteges} icon={<Shield size={20} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="card-lift page-enter-delay-2 overflow-hidden rounded-[28px] border">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Registre des archives
              </h2>
              <p className="text-sm text-slate-500">
                {pagination?.total || 0} courrier(s) archivé(s).
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Archive
            </div>
          </div>

          <ArchivesTable
            archives={archives}
            loading={loading}
            selectedCourrier={selectedCourrier}
            onSelect={setSelectedCourrier}
          />

          <Pagination
            pagination={pagination}
            loading={loading}
            onPageChange={(page) =>
              void loadArchives({
                q: search || undefined,
                type: type || undefined,
                date_reception: dateReception || undefined,
                page,
              })
            }
          />
        </div>

        <ArchiveDetails
          courrier={selectedCourrier}
          actionLoading={actionLoading}
          onDelete={handleDelete}
        />
      </section>
    </div>
  )
}

function ArchivesTable({ archives, loading, selectedCourrier, onSelect }) {
  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Chargement des archives...
      </div>
    )
  }

  if (archives.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Aucun courrier archivé ne correspond aux filtres.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Numéro</th>
            <th className="px-5 py-3">Objet</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Circuit</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Confidentialité</th>
          </tr>
        </thead>

        <tbody>
          {archives.map((courrier) => {
            const active = selectedCourrier?.id === courrier.id

            return (
              <tr
                key={courrier.id}
                onClick={() => onSelect(courrier)}
                className={`table-row-motion cursor-pointer border-t border-slate-100 transition ${
                  active ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-4 font-semibold text-slate-900">
                  {courrier.numero}
                </td>

                <td className="px-5 py-4 text-slate-700">
                  {courrier.objet}
                </td>

                <td className="px-5 py-4">
                  <InlineBadge tone={courrier.type === 'sortant' ? 'amber' : 'sky'}>
                    {courrier.type === 'sortant' ? 'Sortant' : 'Entrant'}
                  </InlineBadge>
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {courrier.type === 'sortant'
                    ? courrier.destinataire || '-'
                    : courrier.expediteur || '-'}
                </td>

                <td className="px-5 py-4 text-slate-500">
                  {formatDate(courrier.date_reception || courrier.date_creation)}
                </td>

                <td className="px-5 py-4">
                  <InlineBadge tone="slate">
                    {getConfidentialityLabel(courrier)}
                  </InlineBadge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ArchiveDetails({ courrier, actionLoading, onDelete }) {
  if (!courrier) {
    return (
      <aside className="card-lift rounded-[28px] border p-6 text-sm text-slate-500">
        Sélectionnez une archive pour consulter son détail.
      </aside>
    )
  }

  const restricted = isRestrictedContent(courrier)

  return (
    <aside className="card-lift rounded-[28px] border p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Archive size={24} />
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
            {courrier.numero}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {courrier.objet}
          </p>
        </div>

        <InlineBadge tone="emerald">ARCHIVE</InlineBadge>
      </div>

      <div className="space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
        {restricted && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Vous n’avez pas l’autorisation de consulter ce contenu.
          </div>
        )}

        <div className={restricted ? 'pointer-events-none select-none blur-sm' : ''}>
          <DetailRow label="Type" value={courrier.type === 'sortant' ? 'Sortant' : 'Entrant'} />
          <DetailRow label="Expéditeur" value={courrier.expediteur || '-'} />
          <DetailRow label="Destinataire" value={courrier.destinataire || '-'} />
          <DetailRow
            label="Date d'enregistrement"
            value={formatDate(courrier.date_creation)}
          />
          <DetailRow
            label="Date de réception"
            value={formatDate(courrier.date_reception)}
          />
        </div>
        <DetailRow label="Confidentialité" value={getConfidentialityLabel(courrier)} />
        <DetailRow
          label="Créateur"
          value={
            courrier.createur
              ? `${courrier.createur.prenom || ''} ${courrier.createur.nom || ''}`.trim()
              : '-'
          }
        />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Historique
        </p>

        <div className="mt-4 space-y-4">
          <TimelineItem
            icon={<CalendarDays size={15} />}
            title="Création du courrier"
            text={formatDate(courrier.date_creation)}
          />

          <TimelineItem
            icon={<Archive size={15} />}
            title="Statut métier"
            text={courrier.statut_original || '-'}
          />

          {courrier.url_fichier && (
            <a
              href={courrier.url_fichier}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FolderOpen size={16} />
              Ouvrir le fichier
            </a>
          )}
        </div>
      </div>

      {courrier.peut_etre_supprime && (
        <button
          type="button"
          onClick={onDelete}
          disabled={actionLoading}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Trash2 size={17} />
          Supprimer l&apos;archive
        </button>
      )}
    </aside>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="card-lift rounded-[24px] border p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        {icon}
      </div>

      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  )
}

function InlineBadge({ children, tone = 'slate' }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-700',
    sky: 'bg-sky-100 text-sky-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function TimelineItem({ icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{text || '-'}</p>
      </div>
    </div>
  )
}
