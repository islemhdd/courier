import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BriefcaseBusiness,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
} from 'lucide-react'
import { userApi } from '../api/userApi'
import { serviceApi } from '../api/serviceApi'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/auth-context'

const initialUserForm = {
  nom: '',
  prenom: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'secretaire',
  service_id: '',
  niveau_confidentialite_id: '',
  actif: true,
}

const initialServiceForm = {
  libelle: '',
}

export default function UsersPage() {
  const { user } = useAuth()
  const canManageUsers = Boolean(user?.permissions?.peut_gerer_utilisateurs)
  const canManageServices = Boolean(user?.permissions?.peut_gerer_services)

  const [users, setUsers] = useState([])
  const [services, setServices] = useState([])
  const [usersPagination, setUsersPagination] = useState(null)
  const [servicesPagination, setServicesPagination] = useState(null)
  const [meta, setMeta] = useState({
    roles: [],
    services: [],
    niveaux_confidentialite: [],
    peut_creer: false,
  })
  const [serviceMeta, setServiceMeta] = useState({
    peut_creer: false,
  })
  const [search, setSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [serviceLoading, setServiceLoading] = useState(false)
  const [error, setError] = useState('')
  const [serviceError, setServiceError] = useState('')
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [serviceForm, setServiceForm] = useState(initialServiceForm)
  const [formError, setFormError] = useState('')
  const [serviceFormError, setServiceFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serviceSubmitting, setServiceSubmitting] = useState(false)
  const usersInitialized = useRef(false)
  const servicesInitialized = useRef(false)

  async function loadUsers(params = {}) {
    try {
      setLoading(true)
      setError('')
      const response = await userApi.getAll(params)
      const paginatedUsers = response.data.utilisateurs
      setUsers(paginatedUsers?.data || [])
      setUsersPagination(paginatedUsers || null)
      setMeta(response.data.meta || {})
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de charger les comptes utilisateurs.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadServices(params = {}) {
    if (!canManageServices) return

    try {
      setServiceLoading(true)
      setServiceError('')
      const response = await serviceApi.getAll(params)
      const paginatedServices = response.data.services
      setServices(paginatedServices?.data || [])
      setServicesPagination(paginatedServices || null)
      setServiceMeta(response.data.meta || {})
    } catch (err) {
      console.error(err)
      setServiceError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de charger les services.',
      )
    } finally {
      setServiceLoading(false)
    }
  }

  useEffect(() => {
    if (canManageUsers) {
      if (usersInitialized.current) return
      usersInitialized.current = true
      void loadUsers()
    }
  }, [canManageUsers])

  useEffect(() => {
    if (canManageServices) {
      if (servicesInitialized.current) return
      servicesInitialized.current = true
      void loadServices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageServices])

  function openCreateModal() {
    setEditingUser(null)
    setUserForm({
      ...initialUserForm,
      role: meta.roles?.includes('secretaire') ? 'secretaire' : meta.roles?.[0] || '',
      service_id: String(meta.services?.[0]?.id || user?.service?.id || ''),
      niveau_confidentialite_id: String(meta.niveaux_confidentialite?.[0]?.id || ''),
    })
    setFormError('')
    setUserModalOpen(true)
  }

  function openEditModal(item) {
    setEditingUser(item)
    setUserForm({
      nom: item.nom || '',
      prenom: item.prenom || '',
      email: item.email || '',
      password: '',
      password_confirmation: '',
      role: item.role || '',
      service_id: String(item.service_id || item.service?.id || ''),
      niveau_confidentialite_id: String(
        item.niveau_confidentialite_id || item.niveau_confidentialite?.id || '',
      ),
      actif: Boolean(item.actif),
    })
    setFormError('')
    setUserModalOpen(true)
  }

  function openCreateServiceModal() {
    setEditingService(null)
    setServiceForm(initialServiceForm)
    setServiceFormError('')
    setServiceModalOpen(true)
  }

  function openEditServiceModal(item) {
    setEditingService(item)
    setServiceForm({
      libelle: item.libelle || '',
    })
    setServiceFormError('')
    setServiceModalOpen(true)
  }

  function closeUserModal() {
    setUserModalOpen(false)
    setEditingUser(null)
    setUserForm(initialUserForm)
    setFormError('')
  }

  function closeServiceModal() {
    setServiceModalOpen(false)
    setEditingService(null)
    setServiceForm(initialServiceForm)
    setServiceFormError('')
  }

  function updateUserForm(field, value) {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateServiceForm(field, value) {
    setServiceForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setFormError('')

      const payload = {
        nom: userForm.nom,
        prenom: userForm.prenom,
        email: userForm.email,
        role: userForm.role,
        service_id: userForm.service_id || null,
        niveau_confidentialite_id: userForm.niveau_confidentialite_id || null,
        actif: Boolean(userForm.actif),
      }

      if (userForm.password) {
        payload.password = userForm.password
        payload.password_confirmation = userForm.password_confirmation
      }

      if (!editingUser && !payload.password) {
        setFormError('Le mot de passe est obligatoire pour la creation.')
        return
      }

      if (editingUser) {
        await userApi.update(editingUser.id, payload)
      } else {
        await userApi.create(payload)
      }

      closeUserModal()
      await loadUsers({ q: search || undefined })
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
          'Impossible d’enregistrer ce compte utilisateur.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitService(event) {
    event.preventDefault()

    try {
      setServiceSubmitting(true)
      setServiceFormError('')

      if (editingService) {
        await serviceApi.update(editingService.id, serviceForm)
      } else {
        await serviceApi.create(serviceForm)
      }

      closeServiceModal()
      await loadServices({ q: serviceSearch || undefined })
      await loadUsers({ q: search || undefined })
    } catch (err) {
      console.error(err)
      const validationErrors = err.response?.data?.errors

      if (validationErrors) {
        setServiceFormError(Object.values(validationErrors).flat()[0])
        return
      }

      setServiceFormError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible d’enregistrer ce service.',
      )
    } finally {
      setServiceSubmitting(false)
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Supprimer le compte ${item.nom_complet || `${item.prenom} ${item.nom}`.trim()} ?`,
    )

    if (!confirmed) return

    try {
      setError('')
      await userApi.delete(item.id)
      await loadUsers({ q: search || undefined })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de supprimer ce compte utilisateur.',
      )
    }
  }

  async function handleDeleteService(item) {
    const confirmed = window.confirm(`Supprimer le service ${item.libelle} ?`)

    if (!confirmed) return

    try {
      setServiceError('')
      await serviceApi.delete(item.id)
      await loadServices({ q: serviceSearch || undefined })
      await loadUsers({ q: search || undefined })
    } catch (err) {
      console.error(err)
      setServiceError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de supprimer ce service.',
      )
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    void loadUsers({ q: search || undefined })
  }

  function handleServiceSearch(event) {
    event.preventDefault()
    void loadServices({ q: serviceSearch || undefined })
  }

  const stats = useMemo(
    () => ({
      total: users.length,
      chefs: users.filter((item) => item.role === 'chef').length,
      secretaires: users.filter((item) => item.role === 'secretaire').length,
      actifs: users.filter((item) => item.actif).length,
    }),
    [users],
  )

  if (!canManageUsers) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800">
        Vous n’avez pas l’autorisation de gerer les comptes utilisateurs.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card-lift page-enter rounded-3xl border p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <UsersIcon size={22} />
            </div>
            <h1 className="text-3xl font-semibold text-slate-950">
              Comptes utilisateurs
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Gestion securisee des comptes cote Laravel, avec filtrage par role et service.
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4">
              <Search size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Nom, prenom ou email"
              />
            </label>

            {meta.peut_creer && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                Nouveau compte
              </button>
            )}
          </form>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="page-enter-delay-1 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="Chefs" value={stats.chefs} />
        <StatCard title="Secretaires" value={stats.secretaires} />
        <StatCard title="Actifs" value={stats.actifs} />
      </section>

      <section className="card-lift page-enter-delay-2 overflow-hidden rounded-3xl border">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Liste des utilisateurs
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Chargement des comptes...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Aucun compte utilisateur trouve.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Utilisateur</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Confidentialite</th>
                  <th className="px-5 py-3">Etat</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="table-row-motion border-t border-slate-100">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {item.nom_complet}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.email}</td>
                    <td className="px-5 py-4 text-slate-600">{item.role}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.service?.libelle || '-'}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.niveau_confidentialite?.libelle || '-'}
                    </td>
                    <td className="px-5 py-4">
                      <InlineBadge tone={item.actif ? 'emerald' : 'red'}>
                        {item.actif ? 'Actif' : 'Inactif'}
                      </InlineBadge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {item.peut_modifier && (
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil size={14} />
                            Modifier
                          </button>
                        )}
                        {item.peut_supprimer && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          pagination={usersPagination}
          loading={loading}
          onPageChange={(page) => void loadUsers({ q: search || undefined, page })}
        />
      </section>

      {canManageServices && (
        <>
          <section className="card-lift rounded-3xl border p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <BriefcaseBusiness size={22} />
                </div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Services
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  CRUD des services reserve exclusivement a l’administrateur.
                </p>
              </div>

              <form
                onSubmit={handleServiceSearch}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4">
                  <Search size={17} className="text-slate-400" />
                  <input
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder="Rechercher un service"
                  />
                </label>

                {serviceMeta.peut_creer && (
                  <button
                    type="button"
                    onClick={openCreateServiceModal}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus size={16} />
                    Nouveau service
                  </button>
                )}
              </form>
            </div>
          </section>

          {serviceError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {serviceError}
            </div>
          )}

          <section className="card-lift overflow-hidden rounded-3xl border">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-950">
                Liste des services
              </h2>
            </div>

            {serviceLoading ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Chargement des services...
              </div>
            ) : services.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Aucun service trouve.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Utilisateurs</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {services.map((item) => (
                      <tr key={item.id} className="table-row-motion border-t border-slate-100">
                        <td className="px-5 py-4 font-medium text-slate-900">
                          {item.libelle}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.users_count}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {item.peut_modifier && (
                              <button
                                type="button"
                                onClick={() => openEditServiceModal(item)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil size={14} />
                                Modifier
                              </button>
                            )}
                            {item.peut_supprimer && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteService(item)}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                <Trash2 size={14} />
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              pagination={servicesPagination}
              loading={serviceLoading}
              onPageChange={(page) =>
                void loadServices({ q: serviceSearch || undefined, page })
              }
            />
          </section>
        </>
      )}

      {userModalOpen && (
        <UserModal
          form={userForm}
          meta={meta}
          user={user}
          editingUser={editingUser}
          submitting={submitting}
          error={formError}
          onChange={updateUserForm}
          onClose={closeUserModal}
          onSubmit={handleSubmit}
        />
      )}

      {serviceModalOpen && (
        <ServiceModal
          form={serviceForm}
          editingService={editingService}
          submitting={serviceSubmitting}
          error={serviceFormError}
          onChange={updateServiceForm}
          onClose={closeServiceModal}
          onSubmit={handleSubmitService}
        />
      )}
    </div>
  )
}

function UserModal({
  form,
  meta,
  user,
  editingUser,
  submitting,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={onSubmit}
        className="page-enter w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
      >
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.08),_rgba(59,130,246,0.08),_rgba(255,255,255,0.92))] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                <UsersIcon size={13} className="text-emerald-600" />
                Inscription
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-lg font-semibold text-slate-950">
              {editingUser ? 'Modifier le compte' : 'Creer un compte'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Interface modernisee pour la creation de compte par l’administrateur ou le chef autorise.
            </p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <Field label="Nom">
            <input
              value={form.nom}
              onChange={(event) => onChange('nom', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              required
            />
          </Field>

          <Field label="Prenom">
            <input
              value={form.prenom}
              onChange={(event) => onChange('prenom', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              required
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => onChange('email', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              required
            />
          </Field>

          <Field label="Role">
            <select
              value={form.role}
              onChange={(event) => onChange('role', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
              required
            >
              {meta.roles.map((role) => {
                const disabled =
                  user?.permissions?.peut_gerer_tous_les_utilisateurs !== true &&
                  role === 'admin'

                return (
                  <option key={role} value={role} disabled={disabled}>
                    {role}
                  </option>
                )
              })}
            </select>
          </Field>

          <Field label="Service">
            <select
              value={form.service_id}
              onChange={(event) => onChange('service_id', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">Aucun service</option>
              {meta.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.libelle}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Confidentialite">
            <select
              value={form.niveau_confidentialite_id}
              onChange={(event) =>
                onChange('niveau_confidentialite_id', event.target.value)
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">Aucun niveau</option>
              {meta.niveaux_confidentialite.map((niveau) => (
                <option key={niveau.id} value={niveau.id}>
                  {niveau.libelle}
                </option>
              ))}
            </select>
          </Field>

          <Field label={editingUser ? 'Nouveau mot de passe' : 'Mot de passe'}>
            <input
              type="password"
              value={form.password}
              onChange={(event) => onChange('password', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </Field>

          <Field label="Confirmation mot de passe">
            <input
              type="password"
              value={form.password_confirmation}
              onChange={(event) =>
                onChange('password_confirmation', event.target.value)
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </Field>

          <label className="sm:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(event) => onChange('actif', event.target.checked)}
            />
            Compte actif
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {editingUser ? 'Enregistrer' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ServiceModal({
  form,
  editingService,
  submitting,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={onSubmit}
        className="page-enter w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {editingService ? 'Modifier le service' : 'Creer un service'}
            </h3>
            <p className="text-sm text-slate-500">
              Seul l’administrateur peut gerer les services.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <Field label="Libelle du service">
            <input
              value={form.libelle}
              onChange={(event) => onChange('libelle', event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              required
            />
          </Field>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {editingService ? 'Enregistrer' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}

function StatCard({ title, value }) {
  return (
    <div className="card-lift rounded-2xl border p-5">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function InlineBadge({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
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
