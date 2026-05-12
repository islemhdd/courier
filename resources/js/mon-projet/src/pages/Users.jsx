import {
  AlertCircle,
  Building,
  Building2,
  Edit,
  KeyRound,
  Mail,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import api from '../api/api'
import { useAuth } from '../context/auth-context'
import {
  buildPageCacheKey,
  getPageCache,
  invalidatePageCache,
  setPageCache,
} from '../lib/pageCache'

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
      (role === 'chef' && scope === 'service') || (role === 'secretaire' && scope === 'service')

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
    async ({
      page = pagination.current_page || 1,
      preferCache = false,
      revalidate = false,
    } = {}) => {
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
          (err.response?.data?.errors ? Object.values(err.response.data.errors).flat()[0] : '')

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

  const fieldClass = (name, disabled = false) =>
    [
      'w-full h-11 rounded-xl border bg-white px-3 text-sm text-slate-800 shadow-sm outline-none',
      'placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10',
      disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : '',
      getFieldError(name)
        ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10'
        : 'border-slate-200',
    ]
      .filter(Boolean)
      .join(' ')

  const fieldHintClass = (name) =>
    getFieldError(name) ? 'text-[11px] font-medium text-red-600' : 'text-[11px] text-slate-500'

  const fieldLabelClass = 'text-[11px] font-bold uppercase tracking-wide text-slate-500'

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
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Utilisateurs</h1>
            <p className="text-xs text-slate-500">Gérez les accès et les structures.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => {
                setPagination((current) => ({ ...current, current_page: 1 }))
                setSearch(event.target.value)
              }}
              placeholder="Rechercher..."
              className="h-10 w-full rounded-xl border border-slate-200 pr-4 pl-10 text-sm transition focus:ring-2 focus:ring-blue-200 focus:outline-none sm:w-64"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 text-xs font-bold text-white shadow-sm shadow-slate-900/10 transition-all duration-200 hover:from-slate-800 hover:to-slate-700 active:scale-[0.98]"
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
            className="h-8 rounded-xl border border-slate-200 px-3 text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
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
            className="h-8 rounded-xl border border-slate-200 px-3 text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Structure / Service
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Actions
                </th>
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <User size={20} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Aucun utilisateur</p>
                      <p className="text-xs">
                        Essayez une autre recherche ou ajoutez un nouvel utilisateur.
                      </p>
                      <button
                        type="button"
                        onClick={() => openModal()}
                        className="mt-2 h-9 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-[0.98]"
                      >
                        Ajouter un utilisateur
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                users.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-blue-50/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-100 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                          {entry.prenom?.[0]}
                          {entry.nom?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {entry.prenom} {entry.nom}
                          </p>
                          <p className="text-xs text-slate-500">{entry.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadge(entry.role).className}`}
                        >
                          {roleBadge(entry.role).label}
                        </span>
                        {entry.role !== 'admin' && (
                          <span
                            className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase ${scopePillClass(entry.role_scope)}`}
                          >
                            {scopeLabel(entry.role_scope)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
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
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          aria-label="Modifier"
                          title={entry.peut_modifier ? 'Modifier' : 'Modification non autorisée'}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => entry.peut_supprimer && handleDelete(entry.id)}
                          disabled={!entry.peut_supprimer}
                          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          aria-label="Supprimer"
                          title={entry.peut_supprimer ? 'Supprimer' : 'Suppression non autorisée'}
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-blue-600 uppercase">
                      Gestion utilisateur
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-slate-950">
                      {editingUser ? 'Modifier un utilisateur' : 'Creer un utilisateur'}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Renseignez les informations du compte, puis choisissez le role et le perimetre
                      d'acces.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-700"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              <form
                onSubmit={handleSubmit}
                className="max-h-[78vh] overflow-y-auto px-5 py-5 sm:px-6"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <User size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Identite</h3>
                    <p className="text-[11px] text-slate-500">
                      Informations visibles dans les listes et les actions.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className={fieldLabelClass}>Nom</label>
                    <input
                      required
                      value={form.nom}
                      onChange={(event) => {
                        clearFieldError('nom')
                        setForm({ ...form, nom: event.target.value })
                      }}
                      aria-invalid={Boolean(getFieldError('nom'))}
                      className={fieldClass('nom')}
                      placeholder="Nom"
                    />
                    {getFieldError('nom') && (
                      <p className={fieldHintClass('nom')}>{getFieldError('nom')}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className={fieldLabelClass}>Prenom</label>
                    <input
                      required
                      value={form.prenom}
                      onChange={(event) => {
                        clearFieldError('prenom')
                        setForm({ ...form, prenom: event.target.value })
                      }}
                      aria-invalid={Boolean(getFieldError('prenom'))}
                      className={fieldClass('prenom')}
                      placeholder="Prenom"
                    />
                    {getFieldError('prenom') && (
                      <p className={fieldHintClass('prenom')}>{getFieldError('prenom')}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <label className={fieldLabelClass}>Email</label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                      size={16}
                    />
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => {
                        clearFieldError('email')
                        setForm({ ...form, email: event.target.value })
                      }}
                      aria-invalid={Boolean(getFieldError('email'))}
                      className={`${fieldClass('email')} pl-10`}
                      placeholder="nom@exemple.com"
                    />
                  </div>
                  {getFieldError('email') && (
                    <p className={fieldHintClass('email')}>{getFieldError('email')}</p>
                  )}
                </div>
                {!editingUser && (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <KeyRound size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Mot de passe</h3>
                        <p className="text-[11px] text-slate-500">
                          Defini uniquement lors de la creation du compte.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={fieldLabelClass}>Mot de passe</label>
                        <input
                          required
                          type="password"
                          value={form.password}
                          onChange={(event) => {
                            clearFieldError('password')
                            setForm({ ...form, password: event.target.value })
                          }}
                          aria-invalid={Boolean(getFieldError('password'))}
                          className={fieldClass('password')}
                          placeholder="Mot de passe"
                        />
                        {getFieldError('password') && (
                          <p className={fieldHintClass('password')}>{getFieldError('password')}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className={fieldLabelClass}>Confirmation</label>
                        <input
                          required
                          type="password"
                          value={form.password_confirmation}
                          onChange={(event) => {
                            clearFieldError('password_confirmation')
                            setForm({ ...form, password_confirmation: event.target.value })
                          }}
                          aria-invalid={Boolean(getFieldError('password_confirmation'))}
                          className={fieldClass('password_confirmation')}
                          placeholder="Confirmer le mot de passe"
                        />
                        {getFieldError('password_confirmation') && (
                          <p className={fieldHintClass('password_confirmation')}>
                            {getFieldError('password_confirmation')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Droits d'acces</h3>
                      <p className="text-[11px] text-slate-500">
                        Selection du role, du perimetre et du rattachement.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={fieldLabelClass}>Role</label>
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
                        className={fieldClass('role')}
                      >
                        <option value="secretaire">Secretaire</option>
                        <option value="chef">Chef</option>
                        {canManageAdmins && <option value="admin">Administrateur</option>}
                      </select>
                      {getFieldError('role') && (
                        <p className={fieldHintClass('role')}>{getFieldError('role')}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className={fieldLabelClass}>Perimetre</label>
                      <select
                        value={form.role_scope}
                        onChange={(event) => {
                          clearFieldError('role_scope')
                          setForm({ ...form, role_scope: event.target.value })
                        }}
                        aria-invalid={Boolean(getFieldError('role_scope'))}
                        className={fieldClass('role_scope')}
                      >
                        <option value="service">Service</option>
                        <option value="structure">Structure</option>
                        <option value="general">General</option>
                      </select>
                      <p className={fieldHintClass('role_scope')}>
                        {getFieldError('role_scope') || "Determine le niveau d'acces du compte."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={fieldLabelClass}>Structure</label>
                      <div className="relative">
                        <Building
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <select
                          value={form.structure_id}
                          onChange={(event) => {
                            clearFieldError('structure_id')
                            setForm({ ...form, structure_id: event.target.value, service_id: '' })
                          }}
                          aria-invalid={Boolean(getFieldError('structure_id'))}
                          disabled={roleRules.forceNoStructure}
                          className={`${fieldClass('structure_id', roleRules.forceNoStructure)} pl-10`}
                        >
                          <option value="">Aucune</option>
                          {meta.structures.map((structure) => (
                            <option key={structure.id} value={structure.id}>
                              {structure.libelle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className={fieldHintClass('structure_id')}>
                        {getFieldError('structure_id') ||
                          (roleRules.forceNoStructure
                            ? 'Non applicable pour un perimetre general.'
                            : 'Structure de rattachement.')}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className={fieldLabelClass}>Service</label>
                      <div className="relative">
                        <Building2
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                          size={16}
                        />
                        <select
                          value={form.service_id}
                          onChange={(event) => {
                            clearFieldError('service_id')
                            setForm({ ...form, service_id: event.target.value })
                          }}
                          aria-invalid={Boolean(getFieldError('service_id'))}
                          disabled={roleRules.forceNoService || roleRules.forceNoStructure}
                          className={`${fieldClass('service_id', roleRules.forceNoService || roleRules.forceNoStructure)} pl-10`}
                        >
                          <option value="">Aucun</option>
                          {meta.services
                            .filter(
                              (service) =>
                                !form.structure_id || service.structure_id == form.structure_id,
                            )
                            .map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.libelle}
                              </option>
                            ))}
                        </select>
                      </div>
                      <p className={fieldHintClass('service_id')}>
                        {getFieldError('service_id') ||
                          (roleRules.forceNoService || roleRules.forceNoStructure
                            ? 'Non applicable pour ce role ou perimetre.'
                            : 'Service de rattachement.')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm shadow-slate-900/10 hover:bg-slate-800 active:scale-[0.98]"
                  >
                    <Save size={16} />
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
