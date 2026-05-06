import { useEffect, useState } from 'react'
import {
  Inbox,
  Search,
  Plus,
  AlertCircle
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { useAuth } from '../context/auth-context'
import Pagination from '../components/Pagination'
import CourrierTable from '../components/CourrierTable'
import CourrierDetails from '../components/CourrierDetails'
import CourrierForm from '../components/CourrierForm'

export default function ReceivedCourriers() {
  const { user } = useAuth()
  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [error, setError] = useState('')
  const [canCreateIncoming, setCanCreateIncoming] = useState(false)

  const getApiErrorMessage = (err) => {
    return (
      err.response?.data?.message ||
      err.response?.data?.detail ||
      err.response?.data?.error ||
      (err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat()[0]
        : '') ||
      "L'action a échoué."
    )
  }

  const loadData = async (params = {}) => {
    try {
      setLoading(true)
      setError('')
      const res = await courrierApi.getReceived({ ...params, q: search || undefined })
      setCourriers(res.data.courriers.data)
      setPagination(res.data.courriers)

      if (res.data.courriers.data.length > 0 && !selectedCourrier) {
        setSelectedCourrier(res.data.courriers.data[0])
      }
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Erreur lors du chargement des courriers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await courrierApi.getCreateData()
        setCanCreateIncoming(res.data.can_create_incoming_courrier || false)
      } catch (err) {
        // Impossible de charger les permissions, présumer false
        setCanCreateIncoming(false)
      }
    }

    loadData()
    fetchPermissions()
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
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setActionLoading(false)
    }

    try {
      await loadData()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      {/* Search & Actions Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center">
            <Inbox size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Courriers Reçus</h1>
            <p className="text-xs text-slate-500">Gérez le flux des courriers entrants.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData({ page: 1 })}
              placeholder="Rechercher..."
              className="h-10 w-full sm:w-64 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          {canCreateIncoming && (
            <button
              onClick={() => setFormOpen(true)}
              className="h-10 px-4 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Nouveau
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <CourrierTable
                courriers={courriers}
                loading={loading}
                selectedCourrier={selectedCourrier}
                onSelect={setSelectedCourrier}
              />
            </div>
            <div className="p-4 border-t border-slate-100">
              <Pagination pagination={pagination} onPageChange={page => loadData({ page })} />
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
            onReply={(c) => {
              setReplyTo(c)
              setFormOpen(true)
            }}
          />
        </aside>
      </div>

      {formOpen && (
        <CourrierForm
          type={replyTo ? 'sortant' : 'entrant'}
          onClose={() => {
            setFormOpen(false)
            //TODO setReplyTo(null)
          }}
          initialData={replyTo ? { parent_courrier_id: replyTo.id, objet: `Réponse à: ${replyTo.objet}` } : null}
          onSuccess={() => {
            setFormOpen(false)
            setReplyTo(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
