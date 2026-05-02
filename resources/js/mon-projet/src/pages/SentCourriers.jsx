import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  CheckCircle,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
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
  destinataire: '',
  service_destinataire_id: '',
  date_reception: new Date().toISOString().slice(0, 10),
  niveau_confidentialite_id: '',
  fichier: null,
}

export default function SentCourriers() {
  const { user } = useAuth()
  const canCreate = Boolean(user?.permissions?.peut_creer_courrier)

  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [niveaux, setNiveaux] = useState([])
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [editingCourrier, setEditingCourrier] = useState(null)
  const hasInitialized = useRef(false)

  async function loadSentCourriers(params = {}) {
    try {
      setLoading(true)
      setError('')

      const response = await courrierApi.getSent(params)
      const paginatedCourriers = response.data.courriers
      const list = paginatedCourriers.data || []

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
          'Impossible de charger les courriers envoyes.',
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
      }))
    } catch (err) {
      console.error(err)
      setFormError(
        err.response?.data?.error ||
          'Vous n’avez pas le droit de creer un courrier envoye.',
      )
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    void loadSentCourriers()
  }, [])

  useEffect(() => {
    if (formOpen && canCreate && niveaux.length === 0) {
      const timeoutId = setTimeout(() => {
        void loadCreateData()
      }, 0)

      return () => clearTimeout(timeoutId)
    }
  }, [formOpen, canCreate, niveaux.length])

  function handleSearch(event) {
    event.preventDefault()
    void loadSentCourriers({
      q: search || undefined,
      statut: status || undefined,
    })
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openForm() {
    setEditingCourrier(null)
    setForm({
      ...initialForm,
      date_reception: new Date().toISOString().slice(0, 10),
      service_destinataire_id: '',
      niveau_confidentialite_id: String(niveaux[0]?.id || ''),
    })
    setFormError('')
    setFormOpen(true)
  }

  function openEditForm(courrier) {
    setEditingCourrier(courrier)
    setForm({
      objet: courrier.objet || '',
      destinataire: courrier.destinataire || '',
      service_destinataire_id: String(
        courrier.service_destinataire_id ||
          courrier.serviceDestinataire?.id ||
          '',
      ),
      date_reception:
        courrier.date_reception ||
        courrier.date_creation ||
        new Date().toISOString().slice(0, 10),
      niveau_confidentialite_id: String(
        courrier.niveau_confidentialite_id ||
          courrier.niveau_confidentialite?.id ||
          courrier.niveauConfidentialite?.id ||
          '',
      ),
      fichier: null,
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
      formData.append('type', 'sortant')
      if (form.destinataire) {
        formData.append('destinataire', form.destinataire)
      }
      if (form.service_destinataire_id) {
        formData.append('service_destinataire_id', form.service_destinataire_id)
      }
      formData.append('niveau_confidentialite_id', form.niveau_confidentialite_id)

      if (!editingCourrier) {
        formData.append('date_reception', form.date_reception)
      }

      if (form.fichier) {
        formData.append('fichier', form.fichier)
      }

      const response = editingCourrier
        ? await courrierApi.update(editingCourrier.id, formData)
        : await courrierApi.create(formData)

      setFormOpen(false)
      setEditingCourrier(null)
      setForm(initialForm)
      setSelectedCourrier(response.data.courrier)
      await loadSentCourriers({ q: search || undefined, statut: status || undefined })
    } catch (err) {
      console.error(err)
      const validationErrors = err.response?.data?.errors

      if (validationErrors) {
        setFormError(Object.values(validationErrors).flat()[0])
        return
      }

      setFormError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible d’enregistrer le courrier.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleArchive() {
    if (!selectedCourrier?.peut_etre_archive) return

    try {
      await courrierApi.archive(selectedCourrier.id)
      await loadSentCourriers({ q: search || undefined, statut: status || undefined })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible d’archiver le courrier.',
      )
    }
  }

  async function handleTransmit() {
    if (!selectedCourrier?.peut_etre_transmis) return

    try {
      await courrierApi.transmit(selectedCourrier.id)
      await loadSentCourriers({ q: search || undefined, statut: status || undefined })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de transmettre le courrier.',
      )
    }
  }

  async function handleDelete() {
    if (!selectedCourrier?.peut_etre_supprime) return

    const confirmed = window.confirm(
      `Supprimer le courrier ${selectedCourrier.numero} ?`,
    )

    if (!confirmed) return

    try {
      await courrierApi.delete(selectedCourrier.id)
      await loadSentCourriers({ q: search || undefined, statut: status || undefined })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de supprimer le courrier.',
      )
    }
  }



  const stats = useMemo(
    () => ({
      total: pagination?.total || courriers.length,
      valides: courriers.filter((item) => item.statut === 'VALIDE').length,
      aArchiver: courriers.filter((item) => item.peut_etre_archive).length,
    }),
    [courriers, pagination],
  )

  return (
    <div className="space-y-6">
      <section className="card-lift page-enter rounded-lg border p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Send size={22} />
            </div>
            <h2 className="text-2xl font-semibold text-slate-950">Courriers envoyes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Suivi des courriers sortants en tenant compte des nouveaux etats et permissions.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto_auto]"
          >
            <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <Search size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Numero, objet, destinataire"
              />
            </label>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="CREE">Cree</option>
              <option value="NON_VALIDE">Non valide</option>
              <option value="VALIDE">Valide</option>
              <option value="TRANSMIS">Transmis</option>
            </select>

            <button
              type="submit"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-black"
            >
              <Search size={16} />
              Filtrer
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={openForm}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                Nouveau
              </button>
            )}
          </form>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="page-enter-delay-1 grid gap-4 sm:grid-cols-3">
        <Stat title="Total sortants" value={stats.total} icon={<Send size={20} />} />
        <Stat title="Valides" value={stats.valides} icon={<CheckCircle size={20} />} />
        <Stat title="Archivables" value={stats.aArchiver} icon={<Archive size={20} />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card-lift page-enter-delay-2 rounded-lg border">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h3 className="font-semibold text-slate-950">Liste des envois</h3>
              <p className="text-sm text-slate-500">
                {pagination?.total || 0} courrier(s) trouve(s).
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadSentCourriers({ q: search || undefined, statut: status || undefined })
              }
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
          </div>

          <SentTable
            courriers={courriers}
            loading={loading}
            selectedCourrier={selectedCourrier}
            onSelect={setSelectedCourrier}
          />

          <Pagination
            pagination={pagination}
            loading={loading}
            onPageChange={(page) =>
              void loadSentCourriers({
                q: search || undefined,
                statut: status || undefined,
                page,
              })
            }
          />
        </div>

        <SentDetails
          courrier={selectedCourrier}
          onArchive={handleArchive}
          onTransmit={handleTransmit}
          onEdit={openEditForm}
          onDelete={handleDelete}
        />
      </section>

      {formOpen && (
        <CreateSentModal
          form={form}
          niveaux={niveaux}
          services={services}
          error={formError}
          submitting={submitting}
          editingCourrier={editingCourrier}
          onClose={() => {
            setFormOpen(false)
            setEditingCourrier(null)
          }}
          onSubmit={handleSubmitForm}
          onChange={updateForm}
        />
      )}
    </div>
  )
}

function SentTable({ courriers, loading, selectedCourrier, onSelect }) {
  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Chargement des courriers envoyes...</div>
  }

  if (courriers.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">Aucun courrier envoye trouve.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Objet</th>
            <th className="px-4 py-3">Destinataire</th>
            <th className="px-4 py-3">Date envoi</th>
            <th className="px-4 py-3">Niveau</th>
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>

        <tbody>
          {courriers.map((courrier) => (
            <tr
              key={courrier.id}
              onClick={() => onSelect(courrier)}
              className={`table-row-motion cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                selectedCourrier?.id === courrier.id ? 'bg-amber-50' : ''
              }`}
            >
              <td className="px-4 py-4 font-semibold text-slate-800">{courrier.numero}</td>
              <td className="px-4 py-4 text-slate-700">{courrier.objet}</td>
              <td className="px-4 py-4 text-slate-600">{courrier.destinataire || '-'}</td>
              <td className="px-4 py-4 text-slate-500">
                {formatDate(courrier.date_reception || courrier.date_creation)}
              </td>
              <td className="px-4 py-4">
                <Badge tone="slate">{getConfidentialityLabel(courrier)}</Badge>
              </td>
              <td className="px-4 py-4">
                <Badge tone={getStatusTone(courrier.statut)}>
                  {getStatusLabel(courrier.statut)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SentDetails({ courrier, onArchive, onTransmit, onEdit, onDelete }) {
  if (!courrier) {
    return (
      <aside className="card-lift rounded-lg border p-5 text-sm text-slate-500">
        Selectionnez un courrier envoye pour voir les details.
      </aside>
    )
  }

  const restricted = isRestrictedContent(courrier)

  return (
    <aside className="card-lift rounded-lg border p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <FileText size={23} />
          </div>
          <h3 className="text-xl font-semibold text-slate-950">{courrier.numero}</h3>
          <p className="mt-1 text-sm text-slate-500">{courrier.objet}</p>
        </div>

        <Badge tone={getStatusTone(courrier.statut)}>{getStatusLabel(courrier.statut)}</Badge>
      </div>

      {restricted && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Vous n’avez pas l’autorisation de consulter ce contenu.
        </div>
      )}

      <div className={`space-y-3 border-y border-slate-100 py-5 text-sm ${restricted ? 'rounded-2xl bg-slate-50 px-4' : ''}`}>
        <div className={restricted ? 'pointer-events-none select-none blur-sm' : ''}>
          <Detail label="Destinataire" value={courrier.destinataire || '-'} />
          <Detail label="Expediteur" value={courrier.expediteur || '-'} />
          <Detail label="Date envoi" value={formatDate(courrier.date_reception)} />
        </div>
        <Detail label="Confidentialite" value={getConfidentialityLabel(courrier)} />
        <Detail
          label="Createur"
          value={
            courrier.createur
              ? `${courrier.createur.prenom || ''} ${courrier.createur.nom || ''}`.trim()
              : '-'
          }
        />
      </div>



      {courrier.peut_etre_modifie && (
        <button
          type="button"
          onClick={() => onEdit(courrier)}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Pencil size={16} />
          Modifier
        </button>
      )}

      {courrier.peut_etre_transmis && (
        <button
          type="button"
          onClick={onTransmit}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Transmettre
        </button>
      )}

      {courrier.peut_etre_archive && (
        <button
          type="button"
          onClick={onArchive}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Archive size={17} />
          Archiver
        </button>
      )}

      {courrier.peut_etre_supprime && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Trash2 size={17} />
          Supprimer
        </button>
      )}

    </aside>
  )
}

function CreateSentModal({
  form,
  niveaux,
  services,
  error,
  submitting,
  editingCourrier,
  onClose,
  onSubmit,
  onChange,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form
        onSubmit={onSubmit}
        className="page-enter w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {editingCourrier ? 'Modifier le courrier envoye' : 'Nouveau courrier envoye'}
            </h3>
            <p className="text-sm text-slate-500">
              {editingCourrier
                ? 'La logique backend garde le controle des droits de modification.'
                : 'Les champs obligatoires seront verifies cote Laravel.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Objet</span>
            <input
              value={form.objet}
              onChange={(event) => onChange('objet', event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="Objet du courrier"
              maxLength={100}
              required
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Service destinataire
            </span>
            <select
              value={form.service_destinataire_id}
              onChange={(event) =>
                onChange('service_destinataire_id', event.target.value)
              }
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Choisir un service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.libelle}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Optionnel. Si vous choisissez un service, Laravel peut remplir automatiquement le destinataire.
            </p>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Destinataire</span>
            <input
              value={form.destinataire}
              onChange={(event) => onChange('destinataire', event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900"
              placeholder="Nom libre du destinataire"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-slate-500">
              Vous pouvez saisir la destination manuellement si elle ne correspond pas à un service.
            </p>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Date d'envoi</span>
            <input
              type="date"
              value={form.date_reception}
              onChange={(event) => onChange('date_reception', event.target.value)}
              disabled={Boolean(editingCourrier)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              required={!editingCourrier}
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Confidentialite</span>
            <select
              value={form.niveau_confidentialite_id}
              onChange={(event) => onChange('niveau_confidentialite_id', event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-900"
              required
            >
              <option value="">Choisir un niveau</option>
              {niveaux.map((niveau) => (
                <option key={niveau.id} value={niveau.id}>
                  {niveau.libelle || niveau.nom}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">Fichier</span>
            <span className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-500">
              <Upload size={17} />
              <input
                type="file"
                onChange={(event) => onChange('fichier', event.target.files?.[0] || null)}
                className="min-w-0 flex-1 text-sm"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Loader2 size={17} className="animate-spin" />}
            {editingCourrier ? 'Modifier' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Stat({ title, value, icon }) {
  return (
    <div className="card-lift rounded-lg border p-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        tones[tone] || tones.slate
      }`}
    >
      {children}
    </span>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}
