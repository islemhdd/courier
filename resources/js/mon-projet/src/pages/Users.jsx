import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users,
  Search,
  Plus,
  AlertCircle,
  User,
  Building,
  Building2,
  Trash2,
  Edit,
  X,
} from 'lucide-react'

import api from '../api/api'
import { useAuth } from '../context/auth-context'
import { buildPageCacheKey, getPageCache, invalidatePageCache, setPageCache } from '../lib/pageCache'

const USERS_CACHE_TTL = 60 * 1000

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [search, setSearch] = useState('')
  const [meta, setMeta] = useState({ structures: [], services: [] })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    password_confirmation: '',
    role: 'secretaire',
    role_scope: 'service',
    structure_id: '',
    service_id: '',
  })

  const roleRules = useMemo(() => {
    const role = form.role
    const scope = form.role_scope

    const needsStructure =
      (role === 'chef' && scope === 'structure') ||
      (role === 'secretaire' && scope === 'structure') ||
      (role === 'secretaire' && scope === 'service') ||
      (role === 'chef' && scope === 'service')

    const needsService =
      (role === 'chef' && scope === 'service') ||
      (role === 'secretaire' && scope === 'service')

    const forceNoService = role === 'chef' && scope === 'structure'
    const forceNoStructure = role === 'chef' && scope === 'general'

    return {
      needsStructure: needsStructure && !forceNoStructure,
      needsService: needsService && !forceNoService && !forceNoStructure,
      forceNoService,
      forceNoStructure,
    }
  }, [form.role, form.role_scope])

  const canManageAdmins =
    currentUser?.role === 'admin' ||
    currentUser?.permissions?.peut_gerer_tous_les_utilisateurs === true

  useEffect(() => {
    setForm((prev) => {
      let next = prev

      if (roleRules.forceNoService && prev.service_id) {
        next = { ...next, service_id: '' }
      }

      if (roleRules.forceNoStructure && (prev.structure_id || prev.service_id)) {
        next = { ...next, structure_id: '', service_id: '' }
      }

      return next
    })
  }, [roleRules.forceNoService, roleRules.forceNoStructure])

  const loadData = useCallback(
    async ({ page = pagination.current_page || 1, preferCache = false, revalidate = false } = {}) => {
      const query = {
        q: search || undefined,
        page,
      }
      const cacheKey = buildPageCacheKey('users', query)
      const cached = getPageCache(cacheKey)

      if (preferCache && cached) {
        setUsers(cached.users || [])
        setPagination(cached.pagination || { current_page: 1, last_page: 1, total: 0 })
        setMeta(cached.meta || { structures: [], services: [] })
        setError('')
        setLoading(false)

        if (!revalidate) {
          return
        }
      } else {
        setLoading(true)
      }

      try {
        setError('')

        const res = await api.get('/utilisateurs', { params: query })
        const payload = res.data || {}
        const pagePayload = payload.utilisateurs || {}
        const nextUsers = Array.isArray(pagePayload.data) ? pagePayload.data : []
        const nextPagination = {
          current_page: pagePayload.current_page || 1,
          last_page: pagePayload.last_page || 1,
          total: pagePayload.total || 0,
        }
        const nextMeta = payload.meta || { structures: [], services: [] }

        setUsers(nextUsers)
        setPagination(nextPagination)
        setMeta(nextMeta)

        setPageCache(
          cacheKey,
          {
            users: nextUsers,
            pagination: nextPagination,
            meta: nextMeta,
          },
          USERS_CACHE_TTL,
        )
      } catch (err) {
        const apiMessage =
          err.response?.data?.message ||
          err.response?.data?.error ||
          (err.response?.data?.errors
            ? Object.values(err.response.data.errors).flat()[0]
            : '')

        setUsers([])
        setPagination({ current_page: 1, last_page: 1, total: 0 })
        setError(apiMessage || 'Erreur lors du chargement des utilisateurs.')
      } finally {
        setLoading(false)
      }
    },
    [pagination.current_page, search],
  )

  useEffect(() => {
    const handle = setTimeout(() => {
      loadData({
        preferCache: true,
        revalidate: true,
      })
    }, 180)

    return () => clearTimeout(handle)
  }, [loadData])

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setError('')
      setFieldErrors({})

      const localErrors = {}
      if (roleRules.needsStructure && !form.structure_id) {
        localErrors.structure_id = ['Structure obligatoire pour ce perimetre.']
      }
      if (roleRules.needsService && !form.service_id) {
        localErrors.service_id = ['Service obligatoire pour ce perimetre.']
      }
      if (roleRules.forceNoService && form.service_id) {
        localErrors.service_id = ['Un chef de structure ne doit pas appartenir a un service.']
      }
      if (roleRules.forceNoStructure && form.structure_id) {
        localErrors.structure_id = ['Un chef general ne doit pas appartenir a une structure.']
      }
      if (Object.keys(localErrors).length > 0) {
        setFieldErrors(localErrors)
        setError(Object.values(localErrors).flat()[0])
        return
      }

      const payload = { ...form }
      if (payload.structure_id === '') payload.structure_id = null
      if (payload.service_id === '') payload.service_id = null
      if (editingUser && !payload.password) {
        delete payload.password
        delete payload.password_confirmation
      }

      if (editingUser) {
        await api.patch(`/utilisateurs/${editingUser.id}`, payload)
      } else {
        await api.post('/utilisateurs', payload)
      }

      setModalOpen(false)
      invalidatePageCache(['users'])
      loadData({ revalidate: true })
    } catch (err) {
      const errors = err.response?.data?.errors
      if (errors && typeof errors === 'object') {
        setFieldErrors(errors)
      } else {
        setFieldErrors({})
      }
      const apiMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (errors ? Object.values(errors).flat()[0] : '')
      setError(apiMessage || "Erreur lors de l'enregistrement.")
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet utilisateur ?')) return

    try {
      await api.delete(`/utilisateurs/${id}`)
      invalidatePageCache(['users'])
      loadData({ revalidate: true })
    } catch {
      setError('Erreur lors de la suppression.')
    }
  }

  const openModal = (user = null) => {
    setError('')
    setFieldErrors({})

    if (user) {
      setEditingUser(user)
      setForm({
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        password: '',
        password_confirmation: '',
        role: user.role,
        role_scope: user.role_scope || 'service',
        structure_id: user.structure_id || '',
        service_id: user.service_id || '',
      })
    } else {
      setEditingUser(null)
      setForm({
        nom: '',
        prenom: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'secretaire',
        role_scope: 'service',
        structure_id: '',
        service_id: '',
      })
    }

    setModalOpen(true)
  }

  const getFieldError = (name) => {
    const value = fieldErrors?.[name]
    if (!value) return ''
    return Array.isArray(value) ? value[0] : String(value)
  }

  const clearFieldError = (name) => {
    if (!fieldErrors?.[name]) return
    setFieldErrors((prev) => {
      const next = { ...(prev || {}) }
      delete next[name]
      return next
    })
  }

  const roleBadge = (role) => {
    const value = String(role || '').toLowerCase()
    if (value === 'admin') {
      return {
        label: 'Administrateur',
        className: 'bg-violet-50 text-violet-700 border-violet-100',
      }
    }
    if (value === 'chef') {
      return {
        label: 'Chef',
        className: 'bg-amber-50 text-amber-700 border-amber-100',
      }
    }
    return {
      label: 'Secretaire',
      className: 'bg-slate-50 text-slate-700 border-slate-100',
    }
  }

  const scopeLabel = (scope) => {
    const value = String(scope || '').toLowerCase()
    if (value === 'general') return 'General'
    if (value === 'structure') return 'Structure'
    return 'Service'
  }

  const scopePillClass = (scope) => {
    const value = String(scope || '').toLowerCase()
    if (value === 'general') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
    if (value === 'structure') return 'bg-sky-50 text-sky-700 border-sky-100'
    return 'bg-slate-50 text-slate-700 border-slate-100'
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Utilisateurs</h1>
            <p className="text-xs text-slate-500">Gerez les acces et les structures.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => {
                setPagination((current) => ({ ...current, current_page: 1 }))
                setSearch(event.target.value)
              }}
              placeholder="Rechercher..."
              className="h-10 w-full sm:w-64 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="h-10 px-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl text-xs font-bold hover:from-slate-800 hover:to-slate-700 transition-all duration-200 active:scale-[0.98] flex items-center gap-2 shadow-sm shadow-slate-900/10"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{pagination.total ? `${pagination.total} utilisateur(s)` : ''}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pagination.current_page <= 1}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                current_page: Math.max(1, (current.current_page || 1) - 1),
              }))
            }
            className="h-8 px-3 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition active:scale-[0.98]"
          >
            Precedent
          </button>
          <span className="text-slate-400">
            Page {pagination.current_page} / {pagination.last_page}
          </span>
          <button
            type="button"
            disabled={pagination.current_page >= pagination.last_page}
            onClick={() =>
              setPagination((current) => ({
                ...current,
                current_page: Math.min(current.last_page || 1, (current.current_page || 1) + 1),
              }))
            }
            className="h-8 px-3 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition active:scale-[0.98]"
          >
            Suivant
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Utilisateur</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Structure / Service</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100" />
                          <div className="space-y-2">
                            <div className="h-3 w-40 rounded bg-slate-100" />
                            <div className="h-2.5 w-52 rounded bg-slate-100" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-5 w-24 rounded bg-slate-100" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="h-3 w-44 rounded bg-slate-100" />
                          <div className="h-2.5 w-36 rounded bg-slate-100" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <div className="h-8 w-8 rounded bg-slate-100" />
                          <div className="h-8 w-8 rounded bg-slate-100" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2 text-slate-500">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <User size={20} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Aucun utilisateur</p>
                      <p className="text-xs">Essayez une autre recherche ou ajoutez un nouvel utilisateur.</p>
                      <button
                        type="button"
                        onClick={() => openModal()}
                        className="mt-2 h-9 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition active:scale-[0.98]"
                      >
                        Ajouter un utilisateur
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && users.map((entry) => (
                <tr key={entry.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {entry.prenom?.[0]}{entry.nom?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{entry.prenom} {entry.nom}</p>
                        <p className="text-xs text-slate-500">{entry.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${roleBadge(entry.role).className}`}>
                        {roleBadge(entry.role).label}
                      </span>
                      {entry.role !== 'admin' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${scopePillClass(entry.role_scope)}`}>
                          {scopeLabel(entry.role_scope)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <Building size={12} className="text-slate-400" />
                        {entry.structure?.libelle || '-'}
                      </div>
                      {entry.service && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Building2 size={10} className="text-slate-300" />
                          {entry.service.libelle}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => entry.peut_modifier && openModal(entry)}
                        disabled={!entry.peut_modifier}
                        className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        aria-label="Modifier"
                        title={entry.peut_modifier ? 'Modifier' : 'Modification non autorisee'}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => entry.peut_supprimer && handleDelete(entry.id)}
                        disabled={!entry.peut_supprimer}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        aria-label="Supprimer"
                        title={entry.peut_supprimer ? 'Supprimer' : 'Suppression non autorisee'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editingUser ? 'Modifier' : 'Ajouter'} Utilisateur</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nom</label>
                  <input
                    required
                    value={form.nom}
                    onChange={(event) => {
                      clearFieldError('nom')
                      setForm({ ...form, nom: event.target.value })
                    }}
                    aria-invalid={Boolean(getFieldError('nom'))}
                    className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('nom') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                  />
                  {getFieldError('nom') && <p className="text-[11px] text-red-600">{getFieldError('nom')}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Prenom</label>
                  <input
                    required
                    value={form.prenom}
                    onChange={(event) => {
                      clearFieldError('prenom')
                      setForm({ ...form, prenom: event.target.value })
                    }}
                    aria-invalid={Boolean(getFieldError('prenom'))}
                    className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('prenom') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                  />
                  {getFieldError('prenom') && <p className="text-[11px] text-red-600">{getFieldError('prenom')}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => {
                    clearFieldError('email')
                    setForm({ ...form, email: event.target.value })
                  }}
                  aria-invalid={Boolean(getFieldError('email'))}
                  className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('email') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                />
                {getFieldError('email') && <p className="text-[11px] text-red-600">{getFieldError('email')}</p>}
              </div>
              {!editingUser && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Mot de passe</label>
                    <input
                      required
                      type="password"
                      value={form.password}
                      onChange={(event) => {
                        clearFieldError('password')
                        setForm({ ...form, password: event.target.value })
                      }}
                      aria-invalid={Boolean(getFieldError('password'))}
                      className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('password') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                    />
                    {getFieldError('password') && <p className="text-[11px] text-red-600">{getFieldError('password')}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Confirmation</label>
                    <input
                      required
                      type="password"
                      value={form.password_confirmation}
                      onChange={(event) => {
                        clearFieldError('password_confirmation')
                        setForm({ ...form, password_confirmation: event.target.value })
                      }}
                      aria-invalid={Boolean(getFieldError('password_confirmation'))}
                      className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('password_confirmation') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                    />
                    {getFieldError('password_confirmation') && <p className="text-[11px] text-red-600">{getFieldError('password_confirmation')}</p>}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Role</label>
                <select
                  value={form.role}
                  onChange={(event) => {
                    clearFieldError('role')
                    const nextRole = event.target.value
                    const nextScope =
                      nextRole === 'admin'
                        ? 'general'
                        : nextRole === 'chef'
                          ? 'service'
                          : form.role_scope

                    setForm({ ...form, role: nextRole, role_scope: nextScope })
                  }}
                  aria-invalid={Boolean(getFieldError('role'))}
                  className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('role') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                >
                  <option value="secretaire">Secretaire</option>
                  <option value="chef">Chef</option>
                  {canManageAdmins && <option value="admin">Administrateur</option>}
                </select>
                {getFieldError('role') && <p className="text-[11px] text-red-600">{getFieldError('role')}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Perimetre</label>
                <select
                  value={form.role_scope}
                  onChange={(event) => {
                    clearFieldError('role_scope')
                    setForm({ ...form, role_scope: event.target.value })
                  }}
                  aria-invalid={Boolean(getFieldError('role_scope'))}
                  className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('role_scope') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                >
                  <option value="service">Service</option>
                  <option value="structure">Structure</option>
                  <option value="general">General</option>
                </select>
                {getFieldError('role_scope') && <p className="text-[11px] text-red-600">{getFieldError('role_scope')}</p>}
                <p className="text-[11px] text-slate-500">Determine le niveau d'acces.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Structure</label>
                  <select
                    value={form.structure_id}
                    onChange={(event) => {
                      clearFieldError('structure_id')
                      setForm({ ...form, structure_id: event.target.value, service_id: '' })
                    }}
                    aria-invalid={Boolean(getFieldError('structure_id'))}
                    disabled={roleRules.forceNoStructure}
                    className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('structure_id') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                  >
                    <option value="">Aucune</option>
                    {meta.structures.map((structure) => (
                      <option key={structure.id} value={structure.id}>{structure.libelle}</option>
                    ))}
                  </select>
                  {getFieldError('structure_id') && <p className="text-[11px] text-red-600">{getFieldError('structure_id')}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Service</label>
                  <select
                    value={form.service_id}
                    onChange={(event) => {
                      clearFieldError('service_id')
                      setForm({ ...form, service_id: event.target.value })
                    }}
                    aria-invalid={Boolean(getFieldError('service_id'))}
                    disabled={roleRules.forceNoService || roleRules.forceNoStructure}
                    className={`w-full h-10 px-3 border rounded-lg text-sm ${getFieldError('service_id') ? 'border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200' : 'border-slate-200'}`}
                  >
                    <option value="">Aucun</option>
                    {meta.services
                      .filter((service) => !form.structure_id || service.structure_id == form.structure_id)
                      .map((service) => (
                        <option key={service.id} value={service.id}>{service.libelle}</option>
                      ))}
                  </select>
                  {getFieldError('service_id') && <p className="text-[11px] text-red-600">{getFieldError('service_id')}</p>}
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm">
                  Enregistrer
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
