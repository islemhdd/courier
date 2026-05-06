import { useEffect, useState } from 'react'
import {
  Archive,
  Clock,
  Inbox,
  Plus,
  Send,
  ShieldAlert,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { messageApi } from '../api/messageApi'
import { useAuth } from '../context/auth-context'
import { useNavigate } from 'react-router-dom'
import CourrierTable from '../components/CourrierTable'
import CourrierDetails from '../components/CourrierDetails'
import CourrierForm from '../components/CourrierForm'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [courriers, setCourriers] = useState([])
  const [selectedCourrier, setSelectedCourrier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState('sortant') // Par défaut 'sortant'
  const [showTypeSelector, setShowTypeSelector] = useState(false)
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

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const [courriersRes, statsRes, unreadRes] = await Promise.all([
        courrierApi.getReceived({ page: 1 }),
        courrierApi.stats(),
        messageApi.unreadCount()
      ])

      const courriersList = courriersRes.data?.courriers?.data || []
      const stats = statsRes.data?.courriers || {}
      const unread = unreadRes.data?.non_lus || 0

      setCourriers(courriersList)
      setStats(stats)
      setUnreadMessages(unread)

      if (courriersList.length > 0) {
        setSelectedCourrier(courriersList[0])
      }
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err)
      setError(`Erreur: ${err.response?.data?.message || err.message || 'Erreur inconnue'}`)
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
    <div className="space-y-6 max-w-full overflow-x-hidden">

      {/* Simple Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bienvenue, {user?.prenom}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestion des courriers pour {user?.structure?.libelle || user?.service?.libelle}.
          </p>
        </div>
        <button
          onClick={() => setShowTypeSelector(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 w-fit"
        >
          <Plus size={18} />
          Nouveau Courrier
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatItem icon={<Inbox className="text-blue-600" />} label="Reçus" value={stats?.recus || 0} />
        <StatItem icon={<Send className="text-indigo-600" />} label="Sortants" value={stats?.envoyes || 0} />
        <StatItem icon={<Clock className="text-amber-600" />} label="En attente" value={stats?.en_attente_reponse || 0} />
        <StatItem icon={<ShieldAlert className="text-red-600" />} label="À valider" value={stats?.validation || 0} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Réceptions récentes</h2>
              <button onClick={() => navigate('/recus')} className="text-xs font-bold text-blue-600 hover:underline">Voir tout</button>
            </div>
            <div className="overflow-x-auto">
              <CourrierTable
                courriers={courriers}
                loading={loading}
                selectedCourrier={selectedCourrier}
                onSelect={setSelectedCourrier}
              />
            </div>
          </section>

          <div className="grid sm:grid-cols-2 gap-4">
            <QuickLink
              title="Messages"
              count={unreadMessages}
              icon={<Plus size={16} />}
              link="/messages"
              color="indigo"
            />
            <QuickLink
              title="Archives"
              count={stats?.archives || 0}
              icon={<Archive size={16} />}
              link="/archives"
              color="slate"
            />
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

      {showTypeSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Nouveau Courrier</h2>
              <p className="text-xs text-slate-500 mt-1">Choisissez le type de courrier à créer</p>
            </div>

            <div className="p-6 space-y-3">
              <button
                onClick={() => {
                  setFormType('sortant')
                  setShowTypeSelector(false)
                  setFormOpen(true)
                }}
                className="w-full p-4 border-2 border-slate-200 rounded-lg text-left hover:border-blue-400 hover:bg-blue-50 transition-all group flex items-center gap-4"
              >
                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200">
                  <Send size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-blue-600">Courrier Sortant</p>
                  <p className="text-xs text-slate-500 mt-1">Créer un nouveau courrier de départ</p>
                </div>
              </button>

              {canCreateIncoming && (
                <button
                  onClick={() => {
                    setFormType('entrant')
                    setShowTypeSelector(false)
                    setFormOpen(true)
                  }}
                  className="w-full p-4 border-2 border-slate-200 rounded-lg text-left hover:border-emerald-400 hover:bg-emerald-50 transition-all group flex items-center gap-4"
                >
                  <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200">
                    <Inbox size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-emerald-600">Courrier Reçu</p>
                    <p className="text-xs text-slate-500 mt-1">Créer un nouveau courrier arrivé</p>
                  </div>
                </button>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowTypeSelector(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <CourrierForm
          type={formType}
          onClose={() => {
            setFormOpen(false)
            setFormType('sortant')
          }}
          onSuccess={() => {
            setFormOpen(false)
            setFormType('sortant')
            loadData()
          }}
        />
      )}
    </div>
  )
}

function StatItem({ icon, label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-slate-50 rounded-lg">{icon}</div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-slate-950 mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickLink({ title, count, icon, link, color }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(link)}
      className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-left hover:border-slate-300 transition-all group flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-slate-600 transition-colors">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{count} élément(s)</p>
        </div>
      </div>
      <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-900 transition-all" />
    </button>
  )
}
