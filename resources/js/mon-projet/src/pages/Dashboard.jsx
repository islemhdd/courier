import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  CheckCircle,
  Clock,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { useAuth } from '../context/auth-context'

export default function Dashboard() {
  const { user } = useAuth()
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function loadCourriers(params = {}) {
    try {
      setLoading(true)
      setError('')

      const response = await courrierApi.getAll(params)

      const paginatedCourriers = response.data.courriers
      const list = paginatedCourriers.data || []

      setCourriers(list)
      setPagination(paginatedCourriers)

      if (list.length > 0) {
        setSelectedCourrier(list[0])
      } else {
        setSelectedCourrier(null)
      }
    } catch (err) {
      console.error(err)

      if (err.response?.status === 401) {
        setError("Vous n'êtes pas connecté.")
      } else if (err.response?.status === 403) {
        setError("Vous n'avez pas le droit d'accéder aux courriers.")
      } else {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            'Impossible de charger les courriers depuis Laravel.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleShowCourrier(id) {
    try {
      setError('')
      const response = await courrierApi.show(id)
      setSelectedCourrier(response.data.courrier)
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible d’afficher le détail du courrier.',
      )
    }
  }

  async function handleDelete() {
    if (!selectedCourrier) return

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le courrier ${selectedCourrier.numero} ?`,
    )

    if (!confirmed) return

    try {
      setActionLoading(true)
      setError('')

      await courrierApi.delete(selectedCourrier.id)
      await loadCourriers()
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

  async function handleValidate() {
    if (!selectedCourrier) return

    try {
      setActionLoading(true)
      setError('')

      await courrierApi.validate(selectedCourrier.id)
      await loadCourriers()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Impossible de valider ce courrier.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleArchive() {
    if (!selectedCourrier) return

    try {
      setActionLoading(true)
      setError('')

      await courrierApi.archive(selectedCourrier.id)
      await loadCourriers()
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadCourriers()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [])

  function handleSearch(e) {
    e.preventDefault()

    loadCourriers({
      objet: search || undefined,
      numero: search || undefined,
      expediteur: search || undefined,
      q: search || undefined,
    })
  }

  const stats = useMemo(() => {
    return {
      total: pagination?.total || courriers.length,
      validation: courriers.filter((c) => normalizeStatus(c.statut) === 'CREE')
        .length,
      messages: 0,
      archives: courriers.filter((c) => c.peut_etre_archive).length,
    }
  }, [courriers, pagination])

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Tableau de bord
          </h1>
          <p className="mt-1 text-slate-500">
            Données chargées depuis la base de données Laravel.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none"
              placeholder="Rechercher..."
            />
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Chercher
          </button>

          <button
            type="button"
            className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Nouveau
          </button>
        </form>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Courriers reçus"
          value={stats.total}
          icon={<Inbox size={22} />}
        />

        <StatCard
          title="En validation"
          value={stats.validation}
          icon={<CheckCircle size={22} />}
        />

        <StatCard
          title="Messages"
          value={stats.messages}
          icon={<MessageSquare size={22} />}
        />

        <StatCard
          title="Archives"
          value={stats.archives}
          icon={<Archive size={22} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Courriers récents
              </h2>
              <p className="text-sm text-slate-400">
                {pagination?.total || 0} courrier(s) trouvé(s).
              </p>
            </div>

            <button
              onClick={() => loadCourriers()}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Actualiser
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Chargement des courriers...
            </div>
          ) : courriers.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Aucun courrier trouvé dans la base de données.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">N°</th>
                    <th className="px-4 py-3">Objet</th>
                    <th className="px-4 py-3">Expéditeur</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Confidentialité</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {courriers.map((courrier) => (
                    <tr
                      key={courrier.id}
                      onClick={() => handleShowCourrier(courrier.id)}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        selectedCourrier?.id === courrier.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {courrier.numero}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {courrier.objet}
                      </td>

                      <td className="px-4 py-4 text-slate-500">
                        {courrier.expediteur || '-'}
                      </td>

                      <td className="px-4 py-4 text-slate-500">
                        {formatDate(
                          courrier.date_reception || courrier.date_creation,
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <Badge color="gray">
                          {getConfidentialityLabel(courrier)}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <Badge color={getStatusColor(courrier.statut)}>
                          {courrier.statut}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <CourrierDetails
          courrier={selectedCourrier}
          user={user}
          actionLoading={actionLoading}
          onValidate={handleValidate}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      </section>
    </div>
  )
}

function CourrierDetails({
  courrier,
  user,
  actionLoading,
  onValidate,
  onArchive,
  onDelete,
}) {
  if (!courrier) {
    return (
      <aside className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-400">
          Sélectionne un courrier pour afficher les détails.
        </p>
      </aside>
    )
  }

  const isValidated = normalizeStatus(courrier.statut) === 'VALIDE'
  const canArchive = Boolean(courrier.peut_etre_archive)
  const canValidate =
    (user?.role === 'chef' || user?.role === 'admin') &&
    Boolean(courrier.peut_etre_valide)

  return (
    <aside className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <FileText size={26} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            {courrier.numero}
          </h2>

          <p className="text-sm text-slate-400">{courrier.objet}</p>
        </div>

        <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
          <Star size={18} />
        </button>
      </div>

      <div className="space-y-3 border-y border-slate-100 py-5 text-sm">
        {!courrier.peut_voir_details && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Ce courrier existe dans votre service, mais son contenu est masque par la confidentialite.
          </div>
        )}
        <Detail label="Expéditeur" value={courrier.expediteur || '-'} />
        <Detail label="Destinataire" value={courrier.destinataire || '-'} />
        <Detail label="Date création" value={formatDate(courrier.date_creation)} />
        <Detail
          label="Date réception"
          value={formatDate(courrier.date_reception)}
        />
        <Detail
          label="Confidentialité"
          value={getConfidentialityLabel(courrier)}
        />
        <Detail label="Statut" value={courrier.statut || '-'} />
        <Detail
          label="Créateur"
          value={
            courrier.createur
              ? `${courrier.createur.prenom || ''} ${
                  courrier.createur.nom || ''
                }`
              : '-'
          }
        />
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Historique
        </h3>

        <div className="space-y-4">
          <TimelineItem
            title="Courrier créé"
            text={formatDate(courrier.date_creation)}
          />

          <TimelineItem title="Statut actuel" text={courrier.statut || '-'} />

          {courrier.valideur && (
            <TimelineItem
              title="Validé par"
              text={`${courrier.valideur.prenom || ''} ${
                courrier.valideur.nom || ''
              }`}
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={onValidate}
          disabled={actionLoading || isValidated || !canValidate}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Valider
        </button>

        <button
          onClick={onArchive}
          disabled={actionLoading || !canArchive}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Archiver
        </button>

        <button
          onClick={onDelete}
          disabled={actionLoading}
          className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={17} />
          Supprimer
        </button>
      </div>
    </aside>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-400">{title}</p>

      <h3 className="mt-1 text-3xl font-bold text-slate-900">{value}</h3>
    </div>
  )
}

function Badge({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-slate-100 text-slate-500',
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        colors[color] || colors.blue
      }`}
    >
      {children}
    </span>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  )
}

function TimelineItem({ title, text }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Clock size={15} />
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{text || '-'}</p>
      </div>
    </div>
  )
}

function formatDate(date) {
  if (!date) return '-'

  return new Date(date).toLocaleDateString('fr-FR')
}

function getStatusColor(statut) {
  if (!statut) return 'gray'

  const normalized = normalizeStatus(statut)

  if (normalized.includes('VALIDE')) return 'green'
  if (normalized.includes('CREE') || normalized.includes('TRANSMIS')) {
    return 'orange'
  }
  if (normalized.includes('REFUSE')) return 'red'

  return 'blue'
}

function normalizeStatus(statut) {
  return String(statut || '').trim().toUpperCase()
}

function getConfidentialityLabel(courrier) {
  return (
    courrier.niveau_confidentialite?.libelle ||
    courrier.niveau_confidentialite?.nom ||
    courrier.niveauConfidentialite?.libelle ||
    courrier.niveauConfidentialite?.nom ||
    '-'
  )
}
