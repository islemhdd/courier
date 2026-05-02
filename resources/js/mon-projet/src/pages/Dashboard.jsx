import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  CheckCircle,
  Clock,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Star,
  Trash2,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { messageApi } from '../api/messageApi'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/auth-context'
import { useNavigate } from 'react-router-dom'
import {
  formatDate,
  getConfidentialityLabel,
  getStatusLabel,
  getStatusTone,
  isRestrictedContent,
  normalizeStatus,
} from '../lib/courrier'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [statsRemote, setStatsRemote] = useState(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const hasInitialized = useRef(false)

  async function loadStats() {
    try {
      const [courrierStatsResponse, unreadResponse] = await Promise.all([
        courrierApi.stats(),
        messageApi.unreadCount(),
      ])

      setStatsRemote(courrierStatsResponse.data.courriers || null)
      setUnreadMessages(unreadResponse.data.non_lus || 0)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadCourriers(params = {}) {
    try {
      setLoading(true)
      setError('')

      // Dashboard focuses on incoming mail.
      const response = await courrierApi.getReceived(params)
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
          'Impossible de charger les courriers depuis Laravel.',
      )
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
          'Impossible d’afficher le detail du courrier.',
      )
    }
  }

  async function handleDelete() {
    if (!selectedCourrier?.peut_etre_supprime) return

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le courrier ${selectedCourrier.numero} ?`,
    )

    if (!confirmed) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.delete(selectedCourrier.id)
      await loadCourriers({ q: search || undefined })
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
    if (!selectedCourrier?.peut_etre_valide) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.validate(selectedCourrier.id)
      await loadCourriers({ q: search || undefined })
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
    if (!selectedCourrier?.peut_etre_archive) return

    try {
      setActionLoading(true)
      setError('')
      await courrierApi.archive(selectedCourrier.id)
      await loadCourriers({ q: search || undefined })
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
    if (hasInitialized.current) return
    hasInitialized.current = true
    void Promise.all([loadCourriers(), loadStats()])
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    void loadCourriers({
      q: search || undefined,
    })
  }

  const canValidateCourriers =
    user?.permissions?.peut_valider_courriers === true ||
    ['chef', 'admin'].includes(String(user?.role || '').trim().toLowerCase())

  const stats = useMemo(() => {
    return {
      recus: statsRemote?.recus ?? (pagination?.total || courriers.length),
      envoyes: statsRemote?.envoyes ?? 0,
      validation: statsRemote?.validation ?? 0,
      archives: statsRemote?.archives ?? 0,
      messages: unreadMessages,
    }
  }, [statsRemote, pagination, courriers.length, unreadMessages])

  return (
    <div className="space-y-6 page-enter">
      <header className="card-lift page-enter flex flex-col gap-4 rounded-3xl border p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-slate-500">
            Donnees chargees depuis la base Laravel, avec restrictions appliquees cote API.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
            onClick={() => navigate('/recus')}
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

      <section className="page-enter-delay-1 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Courriers recus" value={stats.recus} icon={<Inbox size={22} />} />
        <StatCard title="Courriers envoyes" value={stats.envoyes} icon={<Send size={22} />} />
        {canValidateCourriers && (
          <StatCard title="A valider" value={stats.validation} icon={<ShieldAlert size={22} />} />
        )}
        <StatCard title="Messages non lus" value={stats.messages} icon={<MessageSquare size={22} />} />
        <StatCard title="Archives" value={stats.archives} icon={<Archive size={22} />} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
        <div className="card-lift page-enter-delay-2 rounded-3xl border p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Courriers recents</h2>
              <p className="text-sm text-slate-400">
                {pagination?.total || 0} courrier(s) trouve(s).
              </p>
            </div>

            <button
              onClick={() => void loadCourriers()}
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
              Aucun courrier trouve dans la base de donnees.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">N°</th>
                    <th className="px-4 py-3">Objet</th>
                    <th className="px-4 py-3">Expediteur</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Confidentialite</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {courriers.map((courrier) => (
                    <tr
                      key={courrier.id}
                      onClick={() => void handleShowCourrier(courrier.id)}
                      className={`table-row-motion cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                        selectedCourrier?.id === courrier.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {courrier.numero}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{courrier.objet}</td>
                      <td className="px-4 py-4 text-slate-500">
                        {courrier.expediteur || '-'}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {formatDate(courrier.date_reception || courrier.date_creation)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge color="gray">{getConfidentialityLabel(courrier)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge color={getStatusTone(courrier.statut)}>
                          {getStatusLabel(courrier.statut)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

               <Pagination
                 pagination={pagination}
                 loading={loading}
                 onPageChange={(page) =>
                   void loadCourriers({
                     q: search || undefined,
                     page,
                   })
                 }
               />
            </div>
          )}
        </div>

        <CourrierDetails
          courrier={selectedCourrier}
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
  actionLoading,
  onValidate,
  onArchive,
  onDelete,
}) {
  if (!courrier) {
    return (
      <aside className="card-lift rounded-3xl border p-6">
        <p className="text-sm text-slate-400">
          Selectionnez un courrier pour afficher les details.
        </p>
      </aside>
    )
  }

  const restricted = isRestrictedContent(courrier)

  return (
    <aside className="card-lift rounded-3xl border p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <FileText size={26} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900">{courrier.numero}</h2>
          <p className="text-sm text-slate-400">{courrier.objet}</p>
        </div>

        <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
          <Star size={18} />
        </button>
      </div>

      <div className="space-y-3 border-y border-slate-100 py-5 text-sm">
        {restricted && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Vous n’avez pas l’autorisation de consulter ce contenu.
          </div>
        )}

        <div className={restricted ? 'rounded-2xl bg-slate-50 p-4' : ''}>
          <div className={restricted ? 'pointer-events-none select-none blur-sm' : ''}>
            <Detail label="Expediteur" value={courrier.expediteur || '-'} />
            <Detail label="Destinataire" value={courrier.destinataire || '-'} />
            <Detail label="Date creation" value={formatDate(courrier.date_creation)} />
            <Detail label="Date reception" value={formatDate(courrier.date_reception)} />
          </div>
        </div>

        <Detail label="Confidentialite" value={getConfidentialityLabel(courrier)} />
        <Detail label="Statut" value={getStatusLabel(courrier.statut)} />
        <Detail
          label="Createur"
          value={
            courrier.createur
              ? `${courrier.createur.prenom || ''} ${courrier.createur.nom || ''}`.trim()
              : '-'
          }
        />
      </div>

      <div className="mt-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Historique</h3>
        <div className="space-y-4">
          <TimelineItem title="Courrier cree" text={formatDate(courrier.date_creation)} />
          <TimelineItem title="Statut actuel" text={getStatusLabel(courrier.statut)} />
          {normalizeStatus(courrier.statut) === 'NON_VALIDE' && (
            <TimelineItem
              title="Correction requise"
              text="Le chef a marque ce courrier comme non valide."
              icon={<ShieldAlert size={15} />}
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {courrier.peut_etre_valide && (
          <button
            onClick={onValidate}
            disabled={actionLoading}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Valider
          </button>
        )}

        {courrier.peut_etre_archive && (
          <button
            onClick={onArchive}
            disabled={actionLoading}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Archiver
          </button>
        )}

        {courrier.peut_etre_supprime && (
          <button
            onClick={onDelete}
            disabled={actionLoading}
            className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={17} />
            Supprimer
          </button>
        )}
      </div>
    </aside>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="card-lift rounded-3xl border p-5">
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
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
    gray: 'bg-slate-100 text-slate-500',
    slate: 'bg-slate-100 text-slate-500',
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

function TimelineItem({ title, text, icon }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        {icon || <Clock size={15} />}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{text || '-'}</p>
      </div>
    </div>
  )
}
