import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'

import Pagination from '../components/Pagination'
import { messageApi } from '../api/messageApi'
import { buildPageCacheKey, getPageCache, invalidatePageCache, setPageCache } from '../lib/pageCache'

const initialForm = {
  destinataire_id: '',
  destinataire_label: '',
  contenu: '',
  courrier_id: '',
}

const MESSAGES_CACHE_TTL = 45 * 1000
const USERS_LOOKUP_CACHE_KEY = buildPageCacheKey('message-users', { q: '' })
const USERS_LOOKUP_CACHE_TTL = 5 * 60 * 1000

export default function Messages() {
  const [messages, setMessages] = useState([])
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [mailbox, setMailbox] = useState('recu')
  const [search, setSearch] = useState('')
  const [readFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [users, setUsers] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const applyMessages = useCallback((items, preferredId = null) => {
    setMessages(items)
    setSelectedMessage((current) => {
      const nextId = preferredId ?? current?.id

      return items.find((item) => item.id === nextId) || items[0] || null
    })
  }, [])

  const loadUnreadCount = useCallback(async ({ preferCache = false, revalidate = false } = {}) => {
    const cacheKey = buildPageCacheKey('messages-unread', {})
    const cached = getPageCache(cacheKey)

    if (preferCache && typeof cached?.count === 'number') {
      setUnreadCount(cached.count)

      if (!revalidate) {
        return
      }
    }

    try {
      const response = await messageApi.unreadCount()
      const count = response.data.non_lus || 0

      setUnreadCount(count)
      setPageCache(cacheKey, { count }, MESSAGES_CACHE_TTL)
    } catch {}
  }, [])

  const loadMessages = useCallback(
    async (params = {}, options = {}) => {
      const { preferCache = false, revalidate = false } = options
      const query = {
        type: mailbox,
        q: search || undefined,
        lu: readFilter || undefined,
        ...params,
      }
      const cacheKey = buildPageCacheKey('messages', query)
      const cached = getPageCache(cacheKey)

      if (preferCache && cached) {
        applyMessages(cached.messages || [], cached.selectedId)
        setPagination(cached.pagination || null)
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
        const res = await messageApi.getAll(query)
        const items = res.data.messages.data
        const nextSelectedId =
          selectedMessage?.id && items.some((item) => item.id === selectedMessage.id)
            ? selectedMessage.id
            : items[0]?.id || null

        applyMessages(items, nextSelectedId)
        setPagination(res.data.messages)
        setPageCache(
          cacheKey,
          {
            messages: items,
            selectedId: nextSelectedId,
            pagination: res.data.messages,
          },
          MESSAGES_CACHE_TTL,
        )
      } catch {
        setError('Erreur de chargement.')
      } finally {
        setLoading(false)
      }
    },
    [applyMessages, mailbox, readFilter, search, selectedMessage?.id],
  )

  useEffect(() => {
    loadMessages({}, { preferCache: true, revalidate: true })
    loadUnreadCount({ preferCache: true, revalidate: true })
  }, [loadMessages, loadUnreadCount])

  const handleOpenMessage = async (message) => {
    try {
      const res = await messageApi.getOne(message.id)
      setSelectedMessage(res.data.message)

      if (mailbox === 'recu') {
        invalidatePageCache(['messages-unread'])
        loadUnreadCount({ revalidate: true })
      }
    } catch {}
  }

  const handleDelete = async () => {
    if (!selectedMessage || !confirm('Supprimer ce message ?')) return

    try {
      await messageApi.delete(selectedMessage.id)
      invalidatePageCache(['messages', 'messages-unread'])
      await loadMessages()
      loadUnreadCount({ revalidate: true })
    } catch {
      setError('Erreur lors de la suppression.')
    }
  }

  const openComposer = async () => {
    setEditingMessage(null)
    setForm(initialForm)
    setUsers([])
    setFormError('')
    setComposerOpen(true)

    const cachedUsers = getPageCache(USERS_LOOKUP_CACHE_KEY)
    if (cachedUsers?.users) {
      setUsers(cachedUsers.users)
      return
    }

    try {
      const res = await messageApi.searchUsers('')
      const recipients = res.data.utilisateurs || []

      setUsers(recipients)
      setPageCache(USERS_LOOKUP_CACHE_KEY, { users: recipients }, USERS_LOOKUP_CACHE_TTL)
    } catch {}
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setSubmitting(true)
      setFormError('')

      const action =
        event.nativeEvent.submitter?.dataset?.action === 'save' ? 'save' : 'send'
      const payload = { contenu: form.contenu, courrier_id: form.courrier_id || null }

      if (editingMessage) {
        if (action === 'send') await messageApi.sendDraft(editingMessage.id)
        else await messageApi.update(editingMessage.id, payload)
      } else {
        await messageApi.send({
          ...payload,
          destinataire_id: form.destinataire_id,
          envoyer: action === 'send',
        })
      }

      setComposerOpen(false)
      invalidatePageCache(['messages', 'messages-unread'])
      await loadMessages()
      loadUnreadCount({ revalidate: true })
    } catch {
      setFormError("Erreur d'envoi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel-strong rounded-[2rem] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Messagerie ({unreadCount} non lus)</h1>
            <p className="text-xs text-slate-500">Communication interne entre services.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {['recu', 'envoye', 'brouillon'].map((box) => (
            <button
              key={box}
              onClick={() => setMailbox(box)}
              className={`px-4 h-10 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                mailbox === box
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {box === 'recu' ? 'Boite' : box === 'envoye' ? 'Envoyes' : 'Brouillons'}
            </button>
          ))}
          <button
            onClick={openComposer}
            className="px-4 h-10 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Nouveau
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel rounded-[1.5rem] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <div className="table-shell rounded-[2rem] overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && loadMessages({ page: 1 })}
                  placeholder="Rechercher..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => loadMessages({}, { revalidate: true })}
                className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-slate-600"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 border-b">Statut</th>
                    <th className="px-4 py-3 border-b">
                      {mailbox === 'recu' ? 'Emetteur' : 'Destinataire'}
                    </th>
                    <th className="px-4 py-3 border-b">Apercu</th>
                    <th className="px-4 py-3 border-right border-b text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {messages.map((message) => (
                    <tr
                      key={message.id}
                      onClick={() => handleOpenMessage(message)}
                      className={`cursor-pointer text-xs ${
                        selectedMessage?.id === message.id ? 'bg-blue-50/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${
                            message.lu ? 'bg-slate-200' : 'bg-emerald-500'
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {mailbox === 'recu'
                          ? message.emetteur?.nom_complet
                          : message.destinataire?.nom_complet}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">
                        {message.contenu}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {new Date(message.date_envoi).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-50">
              <Pagination pagination={pagination} onPageChange={(page) => loadMessages({ page })} />
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <div className="glass-panel-strong rounded-[2rem] p-6 min-h-[400px]">
            {selectedMessage ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Details du message</h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(selectedMessage.date_envoi).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
                  <p><span className="font-bold text-slate-400">De:</span> {selectedMessage.emetteur?.nom_complet}</p>
                  <p><span className="font-bold text-slate-400">Pour:</span> {selectedMessage.destinataire?.nom_complet}</p>
                  {selectedMessage.courrier && (
                    <p><span className="font-bold text-slate-400">Courrier:</span> {selectedMessage.courrier.numero}</p>
                  )}
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap py-2">
                  {selectedMessage.contenu}
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleDelete}
                    className="w-full h-10 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> Supprimer le message
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 mt-10">Selectionnez un message.</p>
            )}
          </div>
        </aside>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="glass-panel-strong float-in w-full max-w-xl rounded-[2rem] overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Composer un message</h2>
              <button onClick={() => setComposerOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Destinataire</label>
                <select
                  required
                  value={form.destinataire_id}
                  onChange={(event) => setForm({ ...form, destinataire_id: event.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Choisir...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nom_complet} ({user.service?.libelle || user.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Contenu</label>
                <textarea
                  required
                  rows={6}
                  value={form.contenu}
                  onChange={(event) => setForm({ ...form, contenu: event.target.value })}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  placeholder="Votre message..."
                />
              </div>
              {formError && <p className="text-sm text-rose-600">{formError}</p>}
              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm disabled:opacity-60"
                >
                  {submitting ? 'Envoi...' : 'Envoyer'}
                </button>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm"
                >
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
