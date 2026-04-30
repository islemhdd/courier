import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/auth-context'
import {
  formatDate,
  getConfidentialityLabel,
  getStatusLabel,
  getStatusTone,
  isRestrictedContent,
} from '../lib/courrier'

const initialForm = {
  objet: '',
  expediteur: '',
  destinataire: '',
  service_destinataire_id: '',
  date_reception: new Date().toISOString().slice(0, 10),
  niveau_confidentialite_id: '',
  fichier: null,
}

export default function ReceivedCourriers() {
  const { user } = useAuth()
  const canCreate =
    user?.role === 'admin' || user?.role === 'secretaire' || user?.role === 'chef'
  const canPickService = String(user?.role || '').toLowerCase() === 'admin'

  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [niveaux, setNiveaux] = useState([])
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const hasInitialized = useRef(false)

  async function loadReceivedCourriers(params = {}) {
    try {
      setLoading(true)
      setError('')

      const response = await courrierApi.getReceived(params)
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
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible de charger les courriers recus.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadCreateData() {
    try {
      const response = await courrierApi.getCreateData()
      const niveauxConfidentialite = response.data.niveaux_confidentialite || []
      const servicesDisponibles = response.data.services || []
      setNiveaux(niveauxConfidentialite)
      setServices(servicesDisponibles)
      setForm((current) => ({
        ...current,
        niveau_confidentialite_id:
          current.niveau_confidentialite_id ||
          String(niveauxConfidentialite[0]?.id || ''),
        service_destinataire_id:
          current.service_destinataire_id ||
          (canPickService ? '' : String(user?.service?.id || user?.service_id || '')),
      }))
    } catch (err) {
      console.error(err)
      setFormError(
        err.response?.data?.error ||
          'Vous n’avez pas le droit de creer un courrier recu.',
      )
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    void loadReceivedCourriers()
  }, [])

  useEffect(() => {
    if (formOpen && canCreate && niveaux.length === 0) {
      const timeoutId = setTimeout(() => {
        void loadCreateData()
      }, 0)

      return () => clearTimeout(timeoutId)
    }
  }, [formOpen, canCreate, niveaux.length])

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openForm() {
    setForm({
      ...initialForm,
      date_reception: new Date().toISOString().slice(0, 10),
      niveau_confidentialite_id: String(niveaux[0]?.id || ''),
      service_destinataire_id: canPickService
        ? ''
        : String(user?.service?.id || user?.service_id || ''),
      destinataire: canPickService ? '' : user?.service?.libelle || '',
    })
    setFormError('')
    setFormOpen(true)
  }

  async function handleSubmitForm(event) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setFormError('')

      const formData = new FormData()
      formData.append('objet', form.objet)
      formData.append('type', 'entrant')
      formData.append('expediteur', form.expediteur)
      formData.append('date_reception', form.date_reception)
      formData.append('niveau_confidentialite_id', form.niveau_confidentialite_id)

      if (form.destinataire) {
        formData.append('destinataire', form.destinataire)
      }

      if (canPickService && form.service_destinataire_id) {
        formData.append('service_destinataire_id', form.service_destinataire_id)
      }

      if (form.fichier) {
        formData.append('fichier', form.fichier)
      }

      const response = await courrierApi.create(formData)

      setFormOpen(false)
      setForm(initialForm)
      setSelectedCourrier(response.data.courrier || response.data.courrier_recu)
      await loadReceivedCourriers({ q: search || undefined })
    } catch (err) {
      console.error(err)
      const validationErrors = err.response?.data?.errors

      if (validationErrors) {
        setFormError(Object.values(validationErrors).flat()[0])
        return
      }

      setFormError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible de creer le courrier recu.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleArchive() {
    if (!selectedCourrier) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.archive(selectedCourrier.id)
      await loadReceivedCourriers({ q: search || undefined })
      setSelectedCourrier(null)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible d’archiver ce courrier.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedCourrier) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.delete(selectedCourrier.id)
      await loadReceivedCourriers({ q: search || undefined })
      setSelectedCourrier(null)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible de supprimer ce courrier.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  const stats = useMemo(
    () => ({
      total: pagination?.total || courriers.length,
      restricted: courriers.filter((item) => isRestrictedContent(item)).length,
    }),
    [courriers, pagination],
  )

  return (
    <div className="space-y-6">
      <section className="card-lift page-enter overflow-hidden rounded-[28px] border">
        <div className="relative isolate px-6 py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(135deg,_#ffffff,_#f8fafc)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/30">
                <FileText size={24} />
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Courriers recus
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Enregistrement, consultation et archivage des courriers entrants.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void loadReceivedCourriers({ q: search || undefined })
              }}
              className="grid gap-3 xl:min-w-[660px] xl:grid-cols-[minmax(0,1fr)_auto_auto]"
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

              <button
                type="submit"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Search size={16} />
                Rechercher
              </button>

              <button
                type="button"
                onClick={openForm}
                disabled={!canCreate}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Plus size={16} />
                Nouveau
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
        <StatCard title="Courriers visibles" value={stats.total} icon={<FileText size={20} />} />
        <StatCard title="Restreints" value={stats.restricted} icon={<Archive size={20} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="card-lift page-enter-delay-2 overflow-hidden rounded-[28px] border">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Liste des courriers recus
              </h2>
              <p className="text-sm text-slate-500">
                {pagination?.total || 0} courrier(s) trouvé(s).
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadReceivedCourriers({ q: search || undefined })}
              className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
          </div>

          <CourriersTable
            courriers={courriers}
            loading={loading}
            selectedCourrier={selectedCourrier}
            onSelect={setSelectedCourrier}
          />

          <Pagination
            pagination={pagination}
            loading={loading}
            onPageChange={(page) =>
              void loadReceivedCourriers({
                q: search || undefined,
                page,
              })
            }
          />
        </div>

        <CourrierDetails
          courrier={selectedCourrier}
          actionLoading={actionLoading}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <form
            onSubmit={handleSubmitForm}
            className="page-enter w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Nouveau courrier recu
                </h3>
                <p className="text-sm text-slate-500">
                  Renseignez les informations de reception (entrant).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {formError && (
                <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {formError}
                </div>
              )}

              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Objet
                </span>
                <input
                  value={form.objet}
                  onChange={(event) => updateForm('objet', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900"
                  placeholder="Objet du courrier"
                  required
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Expediteur
                </span>
                <input
                  value={form.expediteur}
                  onChange={(event) => updateForm('expediteur', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900"
                  placeholder="Ex: Ministere, Partenaire..."
                  required
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Date de reception
                </span>
                <input
                  type="date"
                  value={form.date_reception}
                  onChange={(event) => updateForm('date_reception', event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900"
                  required
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Confidentialite
                </span>
                <select
                  value={form.niveau_confidentialite_id}
                  onChange={(event) =>
                    updateForm('niveau_confidentialite_id', event.target.value)
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-900"
                  required
                >
                  {niveaux.map((niveau) => (
                    <option key={niveau.id} value={niveau.id}>
                      {niveau.libelle}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Service destinataire
                </span>
                <select
                  value={form.service_destinataire_id}
                  onChange={(event) =>
                    updateForm('service_destinataire_id', event.target.value)
                  }
                  disabled={!canPickService}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
                  required={!canPickService}
                >
                  {canPickService && <option value="">Choisir un service</option>}
                  {!canPickService && (
                    <option value={user?.service?.id || user?.service_id || ''}>
                      {user?.service?.libelle || 'Votre service'}
                    </option>
                  )}
                  {canPickService &&
                    services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.libelle}
                      </option>
                    ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Fichier (optionnel)
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <Upload size={18} className="text-slate-400" />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(event) =>
                      updateForm('fichier', event.target.files?.[0] || null)
                    }
                    className="min-w-0 flex-1 text-sm text-slate-700"
                  />
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function CourriersTable({ courriers, loading, selectedCourrier, onSelect }) {
  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Chargement des courriers...
      </div>
    )
  }

  if (courriers.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Aucun courrier trouvé.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Expediteur</th>
            <th className="px-5 py-3">Objet</th>
            <th className="px-5 py-3">Confidentialite</th>
            <th className="px-5 py-3">Date</th>
          </tr>
        </thead>

        <tbody>
          {courriers.map((courrier) => {
            const active = selectedCourrier?.id === courrier.id

            return (
              <tr
                key={courrier.id}
                onClick={() => onSelect(courrier)}
                className={`table-row-motion cursor-pointer border-t border-slate-100 transition ${
                  active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-4">
                  <InlineBadge tone={getStatusTone(courrier.statut)}>
                    {getStatusLabel(courrier.statut)}
                  </InlineBadge>
                </td>
                <td className="px-5 py-4 font-medium text-slate-800">
                  {courrier.expediteur || '-'}
                </td>
                <td className="px-5 py-4 text-slate-600">{courrier.objet}</td>
                <td className="px-5 py-4 text-slate-500">
                  {getConfidentialityLabel(courrier)}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {formatDate(courrier.date_reception || courrier.date_creation)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CourrierDetails({ courrier, actionLoading, onArchive, onDelete }) {
  if (!courrier) {
    return (
      <aside className="card-lift rounded-[28px] border p-6 text-sm text-slate-500">
        Sélectionnez un courrier pour afficher le détail.
      </aside>
    )
  }

  const restricted = isRestrictedContent(courrier)

  return (
    <aside className="card-lift rounded-[28px] border p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <FileText size={24} />
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
            {courrier.numero || 'Courrier'}
          </h3>
          <p className="mt-2 text-sm text-slate-500">{courrier.objet}</p>
        </div>

        <InlineBadge tone={getStatusTone(courrier.statut)}>
          {getStatusLabel(courrier.statut)}
        </InlineBadge>
      </div>

      <div className="space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
        <DetailRow label="Type" value={courrier.type || '-'} />
        <DetailRow label="Expediteur" value={courrier.expediteur || '-'} />
        <DetailRow label="Destinataire" value={courrier.destinataire || '-'} />
        <DetailRow
          label="Confidentialite"
          value={getConfidentialityLabel(courrier)}
        />
        <DetailRow
          label="Reception"
          value={formatDate(courrier.date_reception || courrier.date_creation)}
        />
      </div>

      <div className="mt-6 grid gap-3">
        {courrier.peut_etre_archive && (
          <button
            type="button"
            onClick={onArchive}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Archive size={16} />
            Archiver
          </button>
        )}

        {courrier.peut_etre_supprime && (
          <button
            type="button"
            onClick={onDelete}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        )}

        {restricted && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Contenu restreint selon votre niveau de confidentialite.
          </div>
        )}

        {courrier.url_fichier && !restricted && (
          <a
            href={courrier.url_fichier}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={16} />
            Ouvrir le fichier
          </a>
        )}
      </div>
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
    emerald: 'bg-emerald-100 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
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

