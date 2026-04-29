import { useEffect, useMemo, useState } from 'react'
import {
  Mail,
  MailOpen,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { messageApi } from '../api/messageApi'

const initialForm = {
  destinataire_id: '',
  destinataire_label: '',
  contenu: '',
  courrier_id: '',
}

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [mailbox, setMailbox] = useState('recu')
  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [courriers, setCourriers] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function loadMessages(params = {}) {
    try {
      setLoading(true)
      setError('')

      const response = await messageApi.getAll({
        type: mailbox,
        q: search || undefined,
        lu: readFilter || undefined,
        ...params,
      })

      const paginatedMessages = response.data.messages
      const list = paginatedMessages?.data || []

      setMessages(list)
      setPagination(paginatedMessages)
      setSelectedMessage((current) => {
        if (current && list.some((item) => item.id === current.id)) {
          return list.find((item) => item.id === current.id)
        }

        return list[0] || null
      })
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de charger les messages.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await messageApi.unreadCount()
      setUnreadCount(response.data.non_lus || 0)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadCourriersOptions() {
    try {
      const response = await courrierApi.getAll()
      setCourriers((response.data.courriers?.data || []).slice(0, 20))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    async function initializeMailbox() {
      await loadMessages()
      await loadUnreadCount()
      await loadCourriersOptions()
    }

    const timeoutId = setTimeout(() => {
      void initializeMailbox()
    }, 0)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailbox])

  async function handleOpenMessage(message) {
    try {
      setError('')

      const response = await messageApi.getOne(message.id)
      const detailedMessage = response.data.message

      setSelectedMessage(detailedMessage)
      setMessages((current) =>
        current.map((item) =>
          item.id === detailedMessage.id ? { ...item, ...detailedMessage } : item,
        ),
      )

      if (mailbox === 'recu') {
        await loadUnreadCount()
      }
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Impossible d'afficher le message.",
      )
    }
  }

  async function handleMarkAsRead() {
    if (!selectedMessage || mailbox !== 'recu' || selectedMessage.lu) return

    try {
      setActionLoading(true)
      const response = await messageApi.markAsRead(selectedMessage.id)
      const updatedMessage = response.data.data

      setSelectedMessage(updatedMessage)
      setMessages((current) =>
        current.map((item) => (item.id === updatedMessage.id ? updatedMessage : item)),
      )
      await loadUnreadCount()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de marquer le message comme lu.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedMessage) return

    const confirmed = window.confirm('Supprimer ce message ?')
    if (!confirmed) return

    try {
      setActionLoading(true)
      setError('')
      await messageApi.delete(selectedMessage.id)
      await loadMessages()
      await loadUnreadCount()
    } catch (err) {
      console.error(err)
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          'Impossible de supprimer ce message.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  function openComposer() {
    setEditingMessage(null)
    setForm(initialForm)
    setUserSearch('')
    setUsers([])
    setFormError('')
    setComposerOpen(true)
  }

  function openEditor(message) {
    setEditingMessage(message)
    setForm({
      destinataire_id: String(message.destinataire_id || ''),
      destinataire_label: getUserLabel(message.destinataire),
      contenu: message.contenu || '',
      courrier_id: String(message.courrier_id || ''),
    })
    setUserSearch(getUserLabel(message.destinataire))
    setUsers(message.destinataire ? [message.destinataire] : [])
    setFormError('')
    setComposerOpen(true)
  }

  async function handleUserSearch(query) {
    setUserSearch(query)

    if (editingMessage) return

    if (query.trim().length < 2) {
      setUsers([])
      return
    }

    try {
      const response = await messageApi.searchUsers(query)
      setUsers(response.data.utilisateurs || [])
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setFormError('')

      const payload = {
        contenu: form.contenu,
        courrier_id: form.courrier_id || null,
      }

      if (!editingMessage) {
        payload.destinataire_id = Number(form.destinataire_id)
      }

      const response = editingMessage
        ? await messageApi.update(editingMessage.id, payload)
        : await messageApi.send({
            ...payload,
            destinataire_id: Number(form.destinataire_id),
          })

      const savedMessage = response.data.data

      setComposerOpen(false)
      setEditingMessage(null)
      setForm(initialForm)
      setSelectedMessage(savedMessage)

      if (mailbox !== 'envoye') {
        setMailbox('envoye')
      } else {
        await loadMessages({ type: 'envoye' })
      }
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
          "Impossible d'enregistrer le message.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  function handleFilter(event) {
    event.preventDefault()
    void loadMessages()
  }

  const stats = useMemo(
    () => ({
      total: pagination?.total || messages.length,
      unread:
        mailbox === 'recu'
          ? messages.filter((item) => !item.lu).length
          : unreadCount,
      linked: messages.filter((item) => Boolean(item.courrier_id)).length,
    }),
    [messages, pagination, mailbox, unreadCount],
  )

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative isolate px-6 py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_36%),linear-gradient(135deg,_#ffffff,_#f8fafc)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-300/30">
                <MessageSquare size={24} />
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Messagerie interne
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Boîte de réception, messages envoyés, composition liée aux
                courriers et gestion du statut de lecture.
              </p>
            </div>

            <form
              onSubmit={handleFilter}
              className="grid gap-3 xl:min-w-[760px] xl:grid-cols-[auto_auto_minmax(0,1fr)_170px_auto_auto]"
            >
              <button
                type="button"
                onClick={() => setMailbox('recu')}
                className={`h-12 rounded-2xl px-4 text-sm font-semibold ${
                  mailbox === 'recu'
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                Réception
              </button>

              <button
                type="button"
                onClick={() => setMailbox('envoye')}
                className={`h-12 rounded-2xl px-4 text-sm font-semibold ${
                  mailbox === 'envoye'
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                Envoyés
              </button>

              <label className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                <Search size={17} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                  placeholder="Contenu, nom ou email"
                />
              </label>

              <select
                value={readFilter}
                onChange={(event) => setReadFilter(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none"
              >
                <option value="">Tous</option>
                <option value="false">Non lus</option>
                <option value="true">Lus</option>
              </select>

              <button
                type="submit"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Search size={16} />
                Filtrer
              </button>

              <button
                type="button"
                onClick={openComposer}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Send size={16} />
                Nouveau
              </button>
            </form>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Messages visibles" value={stats.total} icon={<Mail size={20} />} />
        <StatCard title="Non lus" value={unreadCount} icon={<MailOpen size={20} />} />
        <StatCard title="Liés à un courrier" value={stats.linked} icon={<Shield size={20} />} />
        <StatCard
          title={mailbox === 'recu' ? 'Boîte active' : 'Envois actifs'}
          value={mailbox === 'recu' ? 'RECU' : 'ENVOYE'}
          icon={<UserRound size={20} />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {mailbox === 'recu' ? 'Boîte de réception' : 'Messages envoyés'}
              </h2>
              <p className="text-sm text-slate-500">
                {pagination?.total || 0} message(s) trouvé(s).
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadMessages()
                void loadUnreadCount()
              }}
              className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Actualiser
            </button>
          </div>

          <MessagesTable
            messages={messages}
            loading={loading}
            mailbox={mailbox}
            selectedMessage={selectedMessage}
            onSelect={handleOpenMessage}
          />
        </div>

        <MessageDetails
          message={selectedMessage}
          mailbox={mailbox}
          actionLoading={actionLoading}
          onRead={handleMarkAsRead}
          onDelete={handleDelete}
          onEdit={openEditor}
        />
      </section>

      {composerOpen && (
        <ComposerModal
          form={form}
          users={users}
          courriers={courriers}
          userSearch={userSearch}
          error={formError}
          submitting={submitting}
          editingMessage={editingMessage}
          onClose={() => {
            setComposerOpen(false)
            setEditingMessage(null)
          }}
          onUserSearch={handleUserSearch}
          onSelectUser={(user) => {
            setForm((current) => ({
              ...current,
              destinataire_id: String(user.id),
              destinataire_label: getUserLabel(user),
            }))
            setUserSearch(getUserLabel(user))
            setUsers([user])
          }}
          onChange={(field, value) =>
            setForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function MessagesTable({
  messages,
  loading,
  mailbox,
  selectedMessage,
  onSelect,
}) {
  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Chargement des messages...
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Aucun message trouvé.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">{mailbox === 'recu' ? 'Émetteur' : 'Destinataire'}</th>
            <th className="px-5 py-3">Aperçu</th>
            <th className="px-5 py-3">Courrier lié</th>
            <th className="px-5 py-3">Date</th>
          </tr>
        </thead>

        <tbody>
          {messages.map((message) => {
            const active = selectedMessage?.id === message.id

            return (
              <tr
                key={message.id}
                onClick={() => onSelect(message)}
                className={`cursor-pointer border-t border-slate-100 transition ${
                  active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <td className="px-5 py-4">
                  <InlineBadge tone={message.lu ? 'slate' : 'emerald'}>
                    {message.lu ? 'Lu' : 'Non lu'}
                  </InlineBadge>
                </td>

                <td className="px-5 py-4 font-medium text-slate-800">
                  {mailbox === 'recu'
                    ? getUserLabel(message.emetteur)
                    : getUserLabel(message.destinataire)}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {truncate(message.contenu, 90)}
                </td>

                <td className="px-5 py-4 text-slate-500">
                  {message.courrier?.numero || '-'}
                </td>

                <td className="px-5 py-4 text-slate-500">
                  {formatDateTime(message.date_envoi)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MessageDetails({
  message,
  mailbox,
  actionLoading,
  onRead,
  onDelete,
  onEdit,
}) {
  if (!message) {
    return (
      <aside className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Sélectionnez un message pour afficher le détail.
      </aside>
    )
  }

  const canEdit = mailbox === 'envoye' && !message.lu

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <MessageSquare size={24} />
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
            {mailbox === 'recu' ? 'Message reçu' : 'Message envoyé'}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            {formatDateTime(message.date_envoi)}
          </p>
        </div>

        <InlineBadge tone={message.lu ? 'slate' : 'emerald'}>
          {message.lu ? 'Lu' : 'Non lu'}
        </InlineBadge>
      </div>

      <div className="space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
        <DetailRow label="Émetteur" value={getUserLabel(message.emetteur)} />
        <DetailRow
          label="Destinataire"
          value={getUserLabel(message.destinataire)}
        />
        <DetailRow label="Courrier lié" value={message.courrier?.numero || '-'} />
        <DetailRow
          label="Accès au courrier"
          value={message.courrier_id ? (message.courrier_accessible ? 'Autorisé' : 'Restreint') : '-'}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Contenu
        </p>
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {message.contenu}
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        {mailbox === 'recu' && !message.lu && (
          <button
            type="button"
            onClick={onRead}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <MailOpen size={16} />
            Marquer comme lu
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(message)}
            disabled={actionLoading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Pencil size={16} />
            Modifier
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          disabled={actionLoading}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Trash2 size={16} />
          Supprimer
        </button>
      </div>
    </aside>
  )
}

function ComposerModal({
  form,
  users,
  courriers,
  userSearch,
  error,
  submitting,
  editingMessage,
  onClose,
  onUserSearch,
  onSelectUser,
  onChange,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {editingMessage ? 'Modifier le message' : 'Nouveau message'}
            </h3>
            <p className="text-sm text-slate-500">
              {editingMessage
                ? 'Le destinataire ne change pas après envoi.'
                : 'Choisissez un destinataire actif et, si besoin, un courrier lié.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Destinataire
            </span>

            <input
              value={userSearch}
              onChange={(event) => void onUserSearch(event.target.value)}
              disabled={Boolean(editingMessage)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Rechercher par nom ou email"
              required
            />

            {!editingMessage && users.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => onSelectUser(user)}
                    className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-sm first:border-t-0 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">
                      {getUserLabel(user)}
                    </span>
                    <span className="text-slate-500">{user.email}</span>
                  </button>
                ))}
              </div>
            )}
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Courrier lié
            </span>

            <select
              value={form.courrier_id}
              onChange={(event) => onChange('courrier_id', event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Aucun courrier</option>
              {courriers.map((courrier) => (
                <option key={courrier.id} value={courrier.id}>
                  {courrier.numero} - {courrier.objet}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Destinataire choisi
            </span>

            <input
              value={form.destinataire_label}
              readOnly
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600 outline-none"
              placeholder="Sélectionnez un utilisateur"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Contenu
            </span>

            <textarea
              value={form.contenu}
              onChange={(event) => onChange('contenu', event.target.value)}
              className="min-h-[180px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-900"
              placeholder="Rédigez votre message"
              required
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Send size={16} />
            {editingMessage ? 'Mettre à jour' : 'Envoyer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        {icon}
      </div>

      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  )
}

function InlineBadge({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
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

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}

function getUserLabel(user) {
  if (!user) return '-'

  const name = `${user.prenom || ''} ${user.nom || ''}`.trim()
  return name || user.email || `Utilisateur #${user.id}`
}

function formatDateTime(date) {
  if (!date) return '-'

  return new Date(date).toLocaleString('fr-FR')
}

function truncate(value, maxLength) {
  if (!value) return '-'
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}
