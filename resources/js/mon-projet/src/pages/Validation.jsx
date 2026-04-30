import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import Pagination from '../components/Pagination'
import {
  formatDate,
  getConfidentialityLabel,
  getStatusLabel,
  getStatusTone,
  isRestrictedContent,
} from '../lib/courrier'

export default function Validation() {
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadValidationQueue(params = {}) {
    try {
      setLoading(true)
      setError('')
      const response = await courrierApi.getValidationQueue({
        q: search || undefined,
        type: type || undefined,
        ...params,
      })

      const paginatedCourriers = response.data.courriers
      const list = paginatedCourriers?.data || []

      setCourriers(list)
      setPagination(paginatedCourriers)
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
          'Impossible de charger la file de validation.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadValidationQueue()
    }, 0)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleValidate() {
    if (!selectedCourrier?.peut_etre_valide) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.validate(selectedCourrier.id)
      await loadValidationQueue()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de valider ce courrier.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!selectedCourrier?.peut_etre_non_valide) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.markAsNotValidated(selectedCourrier.id)
      await loadValidationQueue()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de marquer ce courrier comme non valide.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleArchive() {
    if (!selectedCourrier?.peut_etre_archive) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.archive(selectedCourrier.id)
      await loadValidationQueue()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Impossible d'archiver ce courrier.",
      )
    } finally {
      setActionLoading(false)
    }
  }

  function handleFilter(event) {
    event.preventDefault()
    void loadValidationQueue()
  }

  const stats = useMemo(
    () => ({
      total: pagination?.total || courriers.length,
      entrants: courriers.filter((item) => item.type === 'entrant').length,
      sortants: courriers.filter((item) => item.type === 'sortant').length,
      validables: courriers.filter((item) => item.peut_etre_valide).length,
    }),
    [courriers, pagination],
  )

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative isolate px-6 py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_34%),linear-gradient(135deg,_#ffffff,_#f8fafc)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/30">
                <FileCheck2 size={24} />
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Validation des courriers
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les courriers non valides restent modifiables et supprimables par leur secretaire createur.
              </p>
            </div>

            <form
              onSubmit={handleFilter}
              className="grid gap-3 xl:min-w-[680px] xl:grid-cols-[minmax(0,1fr)_180px_auto_auto]"
            >
              <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                <Search size={17} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  placeholder="Numero, objet, expediteur, destinataire"
                />
              </label>

              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
              >
                <option value="">Tous les types</option>
                <option value="entrant">Entrants</option>
                <option value="sortant">Sortants</option>
              </select>

              <button
                type="submit"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Search size={16} />
                Filtrer
              </button>

              <button
                type="button"
                onClick={() => void loadValidationQueue()}
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Dossiers en attente" value={stats.total} icon={<CalendarClock size={20} />} />
        <StatCard title="Entrants" value={stats.entrants} icon={<ShieldCheck size={20} />} />
        <StatCard title="Sortants" value={stats.sortants} icon={<UserRoundCheck size={20} />} />
        <StatCard title="Validables" value={stats.validables} icon={<CheckCircle2 size={20} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">File de validation</h2>
              <p className="text-sm text-slate-500">
                {pagination?.total || 0} courrier(s) en attente.
              </p>
            </div>

            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Validation
            </div>
          </div>

          <ValidationTable
            courriers={courriers}
            loading={loading}
            selectedCourrier={selectedCourrier}
            onSelect={setSelectedCourrier}
          />

          <Pagination
            pagination={pagination}
            loading={loading}
            onPageChange={(page) =>
              void loadValidationQueue({
                q: search || undefined,
                type: type || undefined,
                page,
              })
            }
          />
        </div>

        <ValidationDetails
          courrier={selectedCourrier}
          actionLoading={actionLoading}
          onValidate={handleValidate}
          onReject={handleReject}
          onArchive={handleArchive}
        />
      </section>
    </div>
  )
}

function ValidationTable({ courriers, loading, selectedCourrier, onSelect }) {
  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Chargement de la file de validation...</div>
  }

  if (courriers.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">Aucun courrier en attente de validation.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Numero</th>
            <th className="px-5 py-3">Objet</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Createur</th>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Action</th>
          </tr>
        </thead>

        <tbody>
          {courriers.map((courrier) => {
            const active = selectedCourrier?.id === courrier.id

            return (
              <tr
                key={courrier.id}
                onClick={() => onSelect(courrier)}
                className={`cursor-pointer border-t border-slate-100 transition ${
                  active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-4 font-semibold text-slate-900">{courrier.numero}</td>
                <td className="px-5 py-4 text-slate-700">{courrier.objet}</td>
                <td className="px-5 py-4 text-slate-600">
                  {courrier.type === 'sortant' ? 'Sortant' : 'Entrant'}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {courrier.createur
                    ? `${courrier.createur.prenom || ''} ${courrier.createur.nom || ''}`.trim()
                    : '-'}
                </td>
                <td className="px-5 py-4">
                  <InlineBadge tone={getStatusTone(courrier.statut)}>
                    {getStatusLabel(courrier.statut)}
                  </InlineBadge>
                </td>
                <td className="px-5 py-4">
                  <InlineBadge tone={courrier.peut_etre_valide ? 'emerald' : 'slate'}>
                    {courrier.peut_etre_valide ? 'Validable' : 'Bloque'}
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

function ValidationDetails({ courrier, actionLoading, onValidate, onReject, onArchive }) {
  if (!courrier) {
    return (
      <aside className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Selectionnez un courrier en attente pour afficher le detail.
      </aside>
    )
  }

  const restricted = isRestrictedContent(courrier)

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{courrier.numero}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">{courrier.objet}</p>
        </div>

        <InlineBadge tone={getStatusTone(courrier.statut)}>
          {getStatusLabel(courrier.statut)}
        </InlineBadge>
      </div>

      {restricted && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Vous n’avez pas l’autorisation de consulter ce contenu.
        </div>
      )}

      <div className="space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
        <div className={restricted ? 'pointer-events-none select-none blur-sm' : ''}>
          <DetailRow label="Type" value={courrier.type === 'sortant' ? 'Sortant' : 'Entrant'} />
          <DetailRow label="Expediteur" value={courrier.expediteur || '-'} />
          <DetailRow label="Destinataire" value={courrier.destinataire || '-'} />
          <DetailRow label="Date" value={formatDate(courrier.date_reception || courrier.date_creation)} />
        </div>
        <DetailRow label="Statut" value={getStatusLabel(courrier.statut)} />
        <DetailRow label="Confidentialite" value={getConfidentialityLabel(courrier)} />
        <DetailRow
          label="Createur"
          value={
            courrier.createur
              ? `${courrier.createur.prenom || ''} ${courrier.createur.nom || ''}`.trim()
              : '-'
          }
        />
      </div>

      <div className="mt-6 grid gap-3">
        {courrier.peut_etre_valide && (
          <button
            type="button"
            onClick={onValidate}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <CheckCircle2 size={16} />
            Valider ce courrier
          </button>
        )}

        {courrier.peut_etre_non_valide && (
          <button
            type="button"
            onClick={onReject}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <XCircle size={16} />
            Marquer non valide
          </button>
        )}

        {courrier.peut_etre_archive && (
          <button
            type="button"
            onClick={onArchive}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Archive size={16} />
            Archiver
          </button>
        )}
      </div>
    </aside>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        {icon}
      </div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  )
}

function InlineBadge({ children, tone = 'slate' }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
    blue: 'bg-blue-100 text-blue-700',
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
