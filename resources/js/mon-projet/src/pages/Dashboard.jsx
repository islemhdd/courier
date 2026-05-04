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
  const [error, setError] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      const [courriersRes, statsRes, unreadRes] = await Promise.all([
        courrierApi.getReceived({ page: 1 }),
        courrierApi.stats(),
        messageApi.unreadCount()
      ])
      
      setCourriers(courriersRes.data.courriers.data)
      setStats(statsRes.data.courriers)
      setUnreadMessages(unreadRes.data.non_lus || 0)
      
      if (courriersRes.data.courriers.data.length > 0) {
        setSelectedCourrier(courriersRes.data.courriers.data[0])
      }
    } catch (err) {
      setError('Erreur lors du chargement des données.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAction = async (action, id, data = {}) => {
    try {
      setActionLoading(true)
      if (action === 'archive') await courrierApi.archive(id)
      if (action === 'delete') await courrierApi.delete(id)
      if (action === 'validate') await courrierApi.validate(id)
      if (action === 'reject') await courrierApi.markAsNotValidated(id)
      if (action === 'transmit') await courrierApi.transmit(id, data)
      await loadData()
    } catch (err) {
      setError("L'action a échoué.")
    } finally {
      setActionLoading(false)
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
          onClick={() => setFormOpen(true)}
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

      {formOpen && (
        <CourrierForm 
          type="entrant"
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false)
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
