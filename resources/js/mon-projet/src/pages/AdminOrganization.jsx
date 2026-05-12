import { useCallback, useEffect, useState } from 'react'
import {
  Building,
  Building2,
  Edit,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
  AlertCircle,
  ShieldCheck,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { adminApi } from '../api/adminApi'

const TAB_STRUCTURES = 'structures'
const TAB_SERVICES = 'services'
const TAB_ASSIGNMENTS = 'assignments'

function apiErrorMessage(err, fallback = 'Une erreur est survenue.') {
  const errors = err.response?.data?.errors
  if (errors) {
    return Object.values(errors).flat()[0]
  }

  return err.response?.data?.error || err.response?.data?.message || fallback
}

export default function AdminOrganization() {
  const [activeTab, setActiveTab] = useState(TAB_STRUCTURES)

  const [structures, setStructures] = useState([])
  const [services, setServices] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [allStructures, setAllStructures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [structureModal, setStructureModal] = useState(null)
  const [serviceModal, setServiceModal] = useState(null)
  const [chefModal, setChefModal] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      if (activeTab === TAB_STRUCTURES) {
        const res = await adminApi.getStructures({ q: search || undefined, per_page: 500 })
        const payload = res.data || {}
        const pageData = payload.structures || {}
        setStructures(Array.isArray(pageData.data) ? pageData.data : [])
        setAllUsers(payload.meta?.all_users || [])
      } else if (activeTab === TAB_SERVICES) {
        const res = await adminApi.getServices({ q: search || undefined, per_page: 500 })
        const payload = res.data || {}
        const pageData = payload.services || {}
        setServices(Array.isArray(pageData.data) ? pageData.data : [])
        setAllStructures(payload.meta?.structures || [])
        setAllUsers(payload.meta?.all_users || [])
      } else {
        const [structuresRes, servicesRes] = await Promise.all([
          adminApi.getStructures({ per_page: 500 }),
          adminApi.getServices({ per_page: 500 }),
        ])

        const structuresPayload = structuresRes.data || {}
        const servicesPayload = servicesRes.data || {}
        const structuresPage = structuresPayload.structures || {}
        const servicesPage = servicesPayload.services || {}

        const nextStructures = Array.isArray(structuresPage.data) ? structuresPage.data : []
        const nextServices = Array.isArray(servicesPage.data) ? servicesPage.data : []

        setStructures(nextStructures)
        setServices(nextServices)
        setAllStructures(servicesPayload.meta?.structures || nextStructures)
        setAllUsers(servicesPayload.meta?.all_users || structuresPayload.meta?.all_users || [])
      }
    } catch (err) {
      const msg = apiErrorMessage(err, 'Erreur lors du chargement.')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [activeTab, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadData])

  const handleDeleteStructure = async (id, libelle) => {
    if (!confirm(`Supprimer la structure "${libelle}" ? Cette action est irréversible.`)) return
    try {
      await adminApi.deleteStructure(id)
      toast.success('Structure supprimée avec succès.')
      loadData()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Erreur lors de la suppression.'))
    }
  }

  const handleDeleteService = async (id, libelle) => {
    if (!confirm(`Supprimer le service "${libelle}" ? Cette action est irréversible.`)) return
    try {
      await adminApi.deleteService(id)
      toast.success('Service supprimé avec succès.')
      loadData()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Erreur lors de la suppression.'))
    }
  }

  const handleSubmitStructure = async (form) => {
    try {
      const payload = { libelle: form.libelle, description: form.description || null }

      if (structureModal?.mode === 'edit') {
        await adminApi.updateStructure(structureModal.data.id, payload)
        toast.success('Structure modifiée avec succès.')
      } else {
        await adminApi.createStructure(payload)
        toast.success('Structure créée avec succès.')
      }
      setStructureModal(null)
      loadData()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Erreur lors de l'enregistrement."))
    }
  }

  const handleSubmitService = async (form) => {
    try {
      const payload = {
        libelle: form.libelle,
        description: form.description || null,
        structure_id: form.structure_id,
      }

      if (serviceModal?.mode === 'edit') {
        await adminApi.updateService(serviceModal.data.id, payload)
        toast.success('Service modifié avec succès.')
      } else {
        await adminApi.createService(payload)
        toast.success('Service créé avec succès.')
      }
      setServiceModal(null)
      loadData()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Erreur lors de l'enregistrement."))
    }
  }

  const submitChefAssignment = async ({ type, target, user_id }) => {
    try {
      if (type === 'structure') {
        const res = await adminApi.assignStructureChef(target.id, { user_id })
        toast.success(res.data?.message || 'Chef de structure affecté avec succès.')
      } else {
        const res = await adminApi.assignServiceChef(target.id, { user_id })
        toast.success(res.data?.message || 'Chef de service affecté avec succès.')
      }
      setChefModal(null)
      loadData()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Erreur lors de l'affectation."))
    }
  }

  const handleAssignChef = async (data) => {
    await submitChefAssignment({
      type: chefModal.type,
      target: chefModal.target,
      user_id: data.user_id,
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Administration</h1>
            <p className="text-xs text-slate-500">Gerer les structures, services et chefs.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab(TAB_STRUCTURES)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition border-b-2 ${
                activeTab === TAB_STRUCTURES
                  ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Building size={16} />
              Structures
            </button>
            <button
              onClick={() => setActiveTab(TAB_SERVICES)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition border-b-2 ${
                activeTab === TAB_SERVICES
                  ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Building2 size={16} />
              Services
            </button>
            <button
              onClick={() => setActiveTab(TAB_ASSIGNMENTS)}
              className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold transition border-b-2 ${
                activeTab === TAB_ASSIGNMENTS
                  ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users size={16} />
              Affectation des chefs
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {activeTab === TAB_STRUCTURES && (
            <StructuresPanel
              structures={structures}
              loading={loading}
              error={error}
              search={search}
              onSearchChange={(v) => setSearch(v)}
              onAdd={() => setStructureModal({ mode: 'create', data: null })}
              onEdit={(s) => setStructureModal({ mode: 'edit', data: s })}
              onDelete={(s) => handleDeleteStructure(s.id, s.libelle)}
              onAssignChef={(s) => setChefModal({ type: 'structure', target: s, currentChef: s.chef })}
            />
          )}

          {activeTab === TAB_SERVICES && (
            <ServicesPanel
              services={services}
              loading={loading}
              error={error}
              search={search}
              allStructures={allStructures}
              onSearchChange={(v) => setSearch(v)}
              onAdd={() => setServiceModal({ mode: 'create', data: null, structures: allStructures })}
              onEdit={(s) => setServiceModal({ mode: 'edit', data: s, structures: allStructures })}
              onDelete={(s) => handleDeleteService(s.id, s.libelle)}
              onAssignChef={(s) => setChefModal({ type: 'service', target: s, currentChef: s.chef })}
            />
          )}

          {activeTab === TAB_ASSIGNMENTS && (
            <AssignmentsPanel
              structures={structures}
              services={services}
              users={allUsers}
              loading={loading}
              error={error}
              onAssignChef={submitChefAssignment}
            />
          )}
        </div>
      </div>

      {structureModal && (
        <StructureFormModal
          mode={structureModal.mode}
          data={structureModal.data}
          onClose={() => setStructureModal(null)}
          onSubmit={handleSubmitStructure}
        />
      )}

      {serviceModal && (
        <ServiceFormModal
          mode={serviceModal.mode}
          data={serviceModal.data}
          structures={serviceModal.structures}
          onClose={() => setServiceModal(null)}
          onSubmit={handleSubmitService}
        />
      )}

      {chefModal && (
        <AssignChefModal
          type={chefModal.type}
          target={chefModal.target}
          currentChef={chefModal.currentChef}
          users={allUsers}
          onClose={() => setChefModal(null)}
          onSubmit={handleAssignChef}
        />
      )}
    </div>
  )
}

function StructuresPanel({ structures, loading, error, search, onSearchChange, onAdd, onEdit, onDelete, onAssignChef }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="h-10 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
          />
        </div>
        <button
          onClick={onAdd}
          className="h-10 px-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl text-xs font-bold hover:from-slate-800 hover:to-slate-700 transition-all duration-200 active:scale-[0.98] flex items-center gap-2 shadow-sm shadow-slate-900/10"
        >
          <Plus size={16} /> Nouvelle structure
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gradient-to-r from-slate-50 to-violet-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Structure</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Chef</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Services</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 w-40 rounded bg-slate-100" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-slate-100" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-12 rounded bg-slate-100 mx-auto" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-slate-100 ml-auto" /></td>
                </tr>
              ))
            )}
            {!loading && structures.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Building size={24} className="text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">Aucune structure</p>
                    <p className="text-xs">Commencez par ajouter une nouvelle structure.</p>
                  </div>
                </td>
              </tr>
            )}
            {!loading && structures.map((s) => (
              <tr key={s.id} className="hover:bg-violet-50/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.libelle}</p>
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {s.chef ? (
                    <div className="flex items-center gap-2">
                      <UserRound size={14} className="text-amber-500" />
                      <span className="text-sm text-slate-700 font-medium">{s.chef.nom_complet}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Aucun chef</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                    {s.services_count ?? 0}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onAssignChef(s)}
                      className="p-2 rounded-xl text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Affecter un chef"
                    >
                      <UserRound size={15} />
                    </button>
                    <button
                      onClick={() => onEdit(s)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Modifier"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(s)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ServicesPanel({ services, loading, error, search, onSearchChange, onAdd, onEdit, onDelete, onAssignChef }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher..."
            className="h-10 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
          />
        </div>
        <button
          onClick={onAdd}
          className="h-10 px-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl text-xs font-bold hover:from-slate-800 hover:to-slate-700 transition-all duration-200 active:scale-[0.98] flex items-center gap-2 shadow-sm shadow-slate-900/10"
        >
          <Plus size={16} /> Nouveau service
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gradient-to-r from-slate-50 to-violet-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Service</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Structure</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Chef</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-4 w-40 rounded bg-slate-100" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-slate-100" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-slate-100" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-slate-100 ml-auto" /></td>
                </tr>
              ))
            )}
            {!loading && services.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Building2 size={24} className="text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">Aucun service</p>
                    <p className="text-xs">Commencez par ajouter un nouveau service.</p>
                  </div>
                </td>
              </tr>
            )}
            {!loading && services.map((s) => (
              <tr key={s.id} className="hover:bg-violet-50/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">{s.libelle}</p>
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {s.structure ? (
                    <span className="text-sm text-slate-700">{s.structure.libelle}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Aucune</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {s.chef ? (
                    <div className="flex items-center gap-2">
                      <UserRound size={14} className="text-amber-500" />
                      <span className="text-sm text-slate-700 font-medium">{s.chef.nom_complet}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Aucun chef</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onAssignChef(s)}
                      className="p-2 rounded-xl text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                      title="Affecter un chef"
                    >
                      <UserRound size={15} />
                    </button>
                    <button
                      onClick={() => onEdit(s)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Modifier"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(s)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AssignmentsPanel({ structures, services, users, loading, error, onAssignChef }) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChefAssignmentForm
          type="structure"
          title="Chef de structure"
          icon={Building}
          targets={structures}
          users={users}
          loading={loading}
          onAssignChef={onAssignChef}
        />
        <ChefAssignmentForm
          type="service"
          title="Chef de service"
          icon={Building2}
          targets={services}
          users={users}
          loading={loading}
          onAssignChef={onAssignChef}
        />
      </div>
    </div>
  )
}

function ChefAssignmentForm({ type, title, icon: Icon, targets, users, loading, onAssignChef }) {
  const [targetId, setTargetId] = useState('')
  const [userId, setUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const target = targets.find((item) => String(item.id) === String(targetId))
  const currentChef = target?.chef || null
  const eligibleUsers = users.filter((u) => u.id !== currentChef?.id)
  const label = type === 'structure' ? 'structure' : 'service'

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!target) {
      toast.error(type === 'structure' ? 'Veuillez selectionner une structure.' : 'Veuillez selectionner un service.')
      return
    }

    if (!userId) {
      toast.error('Veuillez selectionner un utilisateur.')
      return
    }

    if (currentChef) {
      const confirmed = confirm(
        `Cette ${label} possède déjà un chef. Si vous continuez, l'ancien chef sera remplacé. Voulez-vous confirmer ?`,
      )

      if (!confirmed) {
        return
      }
    }

    setSubmitting(true)
    await onAssignChef({
      type,
      target,
      user_id: Number(userId),
    })
    setSubmitting(false)
    setUserId('')
  }

  return (
    <section className="border border-slate-200 rounded-2xl p-4 md:p-5 bg-slate-50/40">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white text-slate-700 border border-slate-200">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">
            Chef actuel : {currentChef ? currentChef.nom_complet : 'aucun'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">
            {type === 'structure' ? 'Structure' : 'Service'}
          </label>
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value)
              setUserId('')
            }}
            disabled={loading}
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition bg-white disabled:opacity-60"
          >
            <option value="">Selectionner...</option>
            {targets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.libelle}
                {type === 'service' && item.structure?.libelle ? ` - ${item.structure.libelle}` : ''}
              </option>
            ))}
          </select>
        </div>

        {target && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            {currentChef ? (
              <span>
                Chef actuel : <strong>{currentChef.nom_complet}</strong>
              </span>
            ) : (
              <span>Aucun chef actuellement affecte.</span>
            )}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Utilisateur</label>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={!target || loading}
            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition bg-white disabled:opacity-60"
          >
            <option value="">Selectionner un utilisateur...</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom} ({u.email}) - {u.role} {u.role_scope}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting || loading}
          className="h-11 w-full bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50"
        >
          {submitting ? 'Affectation...' : currentChef ? 'Remplacer le chef' : 'Affecter le chef'}
        </button>
      </form>
    </section>
  )
}

function StructureFormModal({ mode, data, onClose, onSubmit }) {
  const [form, setForm] = useState({
    libelle: data?.libelle || '',
    description: data?.description || '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.libelle.trim()) {
      toast.error('Le libellé est requis.')
      return
    }
    setSubmitting(true)
    await onSubmit(form)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {mode === 'edit' ? 'Modifier' : 'Ajouter'} une structure
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Libelle *</label>
            <input
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
              placeholder="Ex: Direction generale"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition resize-none"
              placeholder="Description optionnelle de la structure"
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ServiceFormModal({ mode, data, structures, onClose, onSubmit }) {
  const [form, setForm] = useState({
    libelle: data?.libelle || '',
    description: data?.description || '',
    structure_id: data?.structure_id ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.libelle.trim()) {
      toast.error('Le libellé est requis.')
      return
    }
    if (!form.structure_id) {
      toast.error('Veuillez selectionner une structure de rattachement.')
      return
    }
    setSubmitting(true)
    await onSubmit({ ...form, structure_id: Number(form.structure_id) })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {mode === 'edit' ? 'Modifier' : 'Ajouter'} un service
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Libelle *</label>
            <input
              required
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
              placeholder="Ex: Service informatique"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition resize-none"
              placeholder="Description optionnelle du service"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Structure de rattachement *</label>
            <select
              required
              value={form.structure_id}
              onChange={(e) => setForm({ ...form, structure_id: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
            >
              <option value="">Selectionner une structure...</option>
              {structures.map((st) => (
                <option key={st.id} value={st.id}>{st.libelle}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssignChefModal({ type, target, currentChef, users, onClose, onSubmit }) {
  const [userId, setUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const label = type === 'structure' ? 'structure' : 'service'
  const title = type === 'structure' ? target.libelle : target.libelle

  const eligibleUsers = users.filter((u) => u.id !== currentChef?.id)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId) {
      toast.error('Veuillez selectionner un utilisateur.')
      return
    }

    if (currentChef) {
      const shouldReplace = confirm(
        `Cette ${label} possède déjà un chef. Si vous continuez, l'ancien chef sera remplacé. Voulez-vous confirmer ?`,
      )

      if (!shouldReplace) {
        return
      }
    }

    setSubmitting(true)
    await onSubmit({ user_id: Number(userId) })
    setSubmitting(false)
  }

  const handleClose = () => {
    setUserId('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Affecter un chef - {title}
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {currentChef && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Cette {label} possède déjà un chef</p>
                  <p className="text-xs mt-1 text-amber-700">
                    Chef actuel : <span className="font-semibold">{currentChef.nom_complet}</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-amber-700">
                Si vous continuez, l&apos;ancien chef sera remplacé et perdra son affectation.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">
              {currentChef ? 'Nouveau chef' : 'Chef'} - {label} &laquo; {title} &raquo;
            </label>
            <select
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition"
            >
              <option value="">Selectionner un utilisateur...</option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom} ({u.email}) - {u.role} {u.role_scope}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition disabled:opacity-50"
            >
              {submitting ? 'Affectation...' : currentChef ? 'Remplacer' : 'Affecter'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
