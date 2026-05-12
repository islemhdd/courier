import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Save,
  Trash2,
  X,
  FileText,
  AlertCircle,
  Loader2,
  Inbox,
  SendHorizonal,
  FileEdit,
  ChevronRight,
  User,
  Eye,
  EyeOff,
} from 'lucide-react'

import Pagination from '../components/Pagination'
import { messageApi } from '../api/messageApi'
import { courrierApi } from '../api/courrierApi'
import { buildPageCacheKey, getPageCache, invalidatePageCache, setPageCache } from '../lib/pageCache'

const MESSAGES_CACHE_TTL = 45 * 1000
const USERS_LOOKUP_CACHE_KEY = buildPageCacheKey('message-users', { q: '' })
const USERS_LOOKUP_CACHE_TTL = 60 * 1000

export default function Messages() {
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState([])
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [mailbox, setMailbox] = useState('recu')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [composerError, setComposerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const pendingMessageId = searchParams.get('messageId')

  const selectedMsgIdRef = useRef(null)

  const applyMessages = useCallback((items, preferredId = null) => {
    setMessages(items)
    const nextId = preferredId ?? selectedMsgIdRef.current
    const next = items.find((item) => item.id === nextId) || null
    selectedMsgIdRef.current = next?.id || null
    setSelectedMessage(next)
  }, [])

  const loadUnreadCount = useCallback(async ({ preferCache = false, revalidate = false } = {}) => {
    const cacheKey = buildPageCacheKey('messages-unread', {})
    const cached = getPageCache(cacheKey)
    if (preferCache && typeof cached?.count === 'number') {
      setUnreadCount(cached.count)
      if (!revalidate) return
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
        ...params,
      }
      const cacheKey = buildPageCacheKey('messages', query)
      const cached = getPageCache(cacheKey)
      if (preferCache && cached) {
        applyMessages(cached.messages || [], cached.selectedId)
        setPagination(cached.pagination || null)
        setError('')
        setLoading(false)
        if (!revalidate) return
      } else {
        setLoading(true)
      }
      try {
        setError('')
        const res = await messageApi.getAll(query)
        const items = res.data.messages.data
        const nextSelectedId =
          selectedMsgIdRef.current && items.some((item) => item.id === selectedMsgIdRef.current)
            ? selectedMsgIdRef.current
            : null
        applyMessages(items, nextSelectedId)
        setPagination(res.data.messages)
        setPageCache(cacheKey, { messages: items, selectedId: nextSelectedId, pagination: res.data.messages }, MESSAGES_CACHE_TTL)
      } catch {
        setError('Erreur de chargement.')
      } finally {
        setLoading(false)
      }
    },
    [applyMessages, mailbox, search],
  )

  useEffect(() => {
    loadMessages({}, { preferCache: true, revalidate: true })
    loadUnreadCount({ preferCache: true, revalidate: true })
  }, [loadMessages, loadUnreadCount])

  const pendingMessageHandled = useRef(false)

  useEffect(() => {
    if (!pendingMessageId || pendingMessageHandled.current) return
    if (messages.length > 0) {
      pendingMessageHandled.current = true
      const msg = messages.find((m) => String(m.id) === String(pendingMessageId))
      if (msg) {
        handleOpenMessage(msg)
        return
      }
    }
    messageApi.getOne(pendingMessageId).then((res) => {
      if (res.data?.message) {
        pendingMessageHandled.current = true
        setSelectedMessage(res.data.message)
        if (res.data.message.destinataire_id) setMailbox('recu')
        else if (res.data.message.emetteur_id) setMailbox('envoye')
      }
    }).catch(() => {})
  }, [pendingMessageId, messages])

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

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm">
              <MessageSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900">Messagerie</h1>
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${unreadCount > 0 ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-200'}`} />
                  {unreadCount} non lu{unreadCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Communication interne &mdash; tous services</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null)
              setComposerError('')
              setComposerOpen(true)
            }}
            className="h-10 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-indigo-600 transition-all duration-200 active:scale-[0.98] flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} /> Nouveau message
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && loadMessages({ page: 1 })}
              placeholder="Chercher dans les messages..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition bg-slate-50"
            />
          </div>
          <button
            onClick={() => loadMessages({}, { revalidate: true })}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-1 ml-auto bg-slate-100 p-1 rounded-xl">
            {[
              { key: 'recu', label: 'Boîte', icon: Inbox },
              { key: 'envoye', label: 'Envoyés', icon: SendHorizonal },
              { key: 'brouillon', label: 'Brouillons', icon: FileEdit },
            ].map(({ key, label, icon: TabIcon }) => (
              <button
                key={key}
                onClick={() => setMailbox(key)}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  mailbox === key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <TabIcon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="divide-y divide-slate-50">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="p-4 animate-pulse flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-slate-200 mt-2 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-slate-100" />
                      <div className="h-3 w-64 rounded bg-slate-50" />
                    </div>
                    <div className="h-3 w-16 rounded bg-slate-100 shrink-0" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                  <MessageSquare size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-400">Aucun message</p>
                <p className="text-xs text-slate-300 mt-1">
                  {mailbox === 'recu'
                    ? "Vous n'avez reçu aucun message."
                    : mailbox === 'envoye'
                      ? "Vous n'avez envoyé aucun message."
                      : "Vous n'avez aucun brouillon."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {messages.map((message) => {
                  const isUnread = mailbox === 'recu' && !message.lu
                  const isSelected = selectedMessage?.id === message.id
                  return (
                    <button
                      key={message.id}
                      onClick={() => handleOpenMessage(message)}
                      className={`w-full text-left p-4 transition-all duration-150 hover:bg-slate-50 group ${
                        isSelected ? 'bg-indigo-50/50 ring-1 ring-indigo-200' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5 shrink-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full inline-block ring-2 ring-white ${
                              isUnread ? 'bg-indigo-500' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className={`text-sm truncate ${
                              isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                            }`}>
                              {mailbox === 'recu'
                                ? message.emetteur?.nom_complet
                                : message.destinataire?.nom_complet}
                            </span>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                              {new Date(message.date_envoi).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: 'short'
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className={`text-xs truncate ${
                              isUnread ? 'text-slate-700' : 'text-slate-500'
                            }`}>
                              {message.contenu}
                            </p>
                            {message.courrier_id && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 shrink-0 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                <FileText size={9} />
                                #{message.courrier_id}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {pagination && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Pagination pagination={pagination} onPageChange={(page) => loadMessages({ page })} />
              </div>
            )}
          </div>
        </div>

        <aside className="xl:w-96 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm min-h-[400px] h-full">
            {selectedMessage ? (
              <div className="flex flex-col h-full">
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Détails</h3>
                    <span className="text-[10px] text-slate-400">
                      {new Date(selectedMessage.date_envoi).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <User size={13} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">De</span>
                        <p className="text-sm font-semibold text-slate-900 -mt-0.5">{selectedMessage.emetteur?.nom_complet}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 shrink-0">
                        <SendHorizonal size={13} />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Pour</span>
                        <p className="text-sm font-semibold text-slate-900 -mt-0.5">{selectedMessage.destinataire?.nom_complet}</p>
                      </div>
                    </div>
                    {selectedMessage.courrier_id && (
                      <div className={`mt-1 p-3 rounded-xl text-xs ${
                        selectedMessage.courrier_accessible === false
                          ? 'bg-amber-50 border border-amber-100'
                          : 'bg-indigo-50 border border-indigo-100'
                      }`}>
                        {selectedMessage.courrier_accessible === false ? (
                          <div className="flex items-start gap-2 text-amber-700">
                            <EyeOff size={14} className="shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Accès restreint</p>
                              <p className="text-[11px] opacity-80 mt-0.5">Vous ne pouvez pas voir ce courrier.</p>
                            </div>
                          </div>
                        ) : selectedMessage.courrier ? (
                          <div className="flex items-start gap-2 text-indigo-700">
                            <Eye size={14} className="shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">{selectedMessage.courrier.numero}</p>
                              <p className="text-[11px] opacity-80 mt-0.5">{selectedMessage.courrier.objet}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500">
                            <FileText size={14} />
                            <span>Courrier #{selectedMessage.courrier_id}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedMessage.contenu}
                  </p>
                </div>
                <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={handleDelete}
                    className="w-full h-10 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-6">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                  <MessageSquare size={28} />
                </div>
                <p className="text-sm font-semibold text-slate-500">Aucun message sélectionné</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Cliquez sur un message dans la liste ou composez-en un nouveau.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {composerOpen && <ComposerModal
        editingMessage={editingMessage}
        onClose={() => setComposerOpen(false)}
        onSuccess={() => {
          setComposerOpen(false)
          invalidatePageCache(['messages', 'messages-unread'])
          loadMessages({}, { revalidate: true })
          loadUnreadCount({ revalidate: true })
        }}
      />}
    </div>
  )
}

function ComposerModal({ editingMessage, onClose, onSuccess }) {
  const composerRef = useRef(null)
  const [form, setForm] = useState({
    destinataire_id: editingMessage?.destinataire_id || '',
    contenu: editingMessage?.contenu || '',
    courrier_id: editingMessage?.courrier_id || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState(editingMessage?.destinataire || null)
  const [courrierSearch, setCourrierSearch] = useState('')
  const [courriers, setCourriers] = useState([])
  const [courriersLoading, setCourriersLoading] = useState(false)
  const [showCourrierDropdown, setShowCourrierDropdown] = useState(false)
  const [selectedCourrier, setSelectedCourrier] = useState(editingMessage?.courrier || null)
  const userSearchRef = useRef(null)
  const courrierSearchRef = useRef(null)

  const loadUsers = useCallback(async (query, { force = false } = {}) => {
    if (query === '' && !force) {
      setUsers([])
      setUsersLoading(false)
      return
    }
    setUsersLoading(true)
    try {
      const res = await messageApi.searchUsers(query)
      setUsers(res.data.utilisateurs || [])
    } catch {
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const loadCourriers = useCallback(async (query, { force = false } = {}) => {
    if (query === '' && !force) {
      setCourriers([])
      setCourriersLoading(false)
      return
    }
    setCourriersLoading(true)
    try {
      const params = { q: query || undefined }
      const res = await courrierApi.getAll(params)
      setCourriers(res.data.courriers?.data || [])
    } catch {
      setCourriers([])
    } finally {
      setCourriersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!editingMessage) {
      loadUsers('', { force: true })
      loadCourriers('', { force: true })
    }
  }, [editingMessage, loadUsers, loadCourriers])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearch) loadUsers(userSearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [userSearch, loadUsers])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (courrierSearch !== undefined) {
        if (courrierSearch) {
          loadCourriers(courrierSearch)
        } else {
          loadCourriers('', { force: true })
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [courrierSearch, loadCourriers])

  useEffect(() => {
    function handleClickOutside(event) {
      if (composerRef.current && !composerRef.current.contains(event.target)) {
        onClose()
        return
      }
      if (userSearchRef.current && !userSearchRef.current.contains(event.target)) {
        setShowUserDropdown(false)
      }
      if (courrierSearchRef.current && !courrierSearchRef.current.contains(event.target)) {
        setShowCourrierDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.destinataire_id) {
      setError('Veuillez sélectionner un destinataire.')
      return
    }
    setSubmitting(true)
    try {
      const action = event.nativeEvent.submitter?.dataset?.action === 'save' ? 'save' : 'send'
      const payload = {
        contenu: form.contenu,
        courrier_id: form.courrier_id || null,
      }
      if (editingMessage) {
        if (action === 'send') {
          await messageApi.sendDraft(editingMessage.id)
        } else {
          await messageApi.update(editingMessage.id, { ...payload, destinataire_id: form.destinataire_id })
        }
      } else {
        await messageApi.send({
          ...payload,
          destinataire_id: form.destinataire_id,
          envoyer: action === 'send',
        })
      }
      onSuccess()
    } catch (err) {
      const apiMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response?.data?.errors
          ? Object.values(err.response.data.errors).flat()[0]
          : '') ||
        "Erreur d'envoi."
      setError(apiMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-slide-in" ref={composerRef}>
        <div className="shrink-0 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <MessageSquare size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {editingMessage ? 'Modifier le message' : 'Nouveau message'}
              </h2>
              <p className="text-[11px] text-slate-400">Communication interne</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form id="composer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5" ref={userSearchRef}>
            <label className="text-xs font-semibold text-slate-500">Destinataire</label>
            <div className="relative">
              <input
                required
                value={selectedUser ? `${selectedUser.prenom} ${selectedUser.nom}` : userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value)
                  setSelectedUser(null)
                  setForm({ ...form, destinataire_id: '' })
                  setShowUserDropdown(true)
                }}
                onFocus={() => setShowUserDropdown(true)}
                placeholder="Rechercher un utilisateur..."
                className="w-full h-11 px-4 border-0 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition placeholder:text-slate-400"
              />
              {selectedUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null)
                    setForm({ ...form, destinataire_id: '' })
                    setUserSearch('')
                    setShowUserDropdown(true)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={14} />
                </button>
              ) : usersLoading ? (
                <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              ) : null}
              {showUserDropdown && !selectedUser && (
                <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {users.length === 0 && !usersLoading && (
                    <p className="p-3 text-xs text-slate-400 text-center">Aucun utilisateur trouvé.</p>
                  )}
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user)
                        setForm({ ...form, destinataire_id: user.id })
                        setUserSearch('')
                        setShowUserDropdown(false)
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-b-0"
                    >
                      <span className="font-medium text-slate-800">
                        {user.prenom} {user.nom}
                      </span>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">
                        {user.service?.libelle || user.structure?.libelle || user.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5" ref={courrierSearchRef}>
            <label className="text-xs font-semibold text-slate-500">
              Courrier référencé <span className="font-normal text-slate-300">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                value={selectedCourrier ? `${selectedCourrier.numero} — ${selectedCourrier.objet}` : courrierSearch}
                onChange={(event) => {
                  setCourrierSearch(event.target.value)
                  setSelectedCourrier(null)
                  setForm({ ...form, courrier_id: '' })
                  setShowCourrierDropdown(true)
                }}
                onFocus={() => setShowCourrierDropdown(true)}
                placeholder="Chercher par numero ou objet..."
                className="w-full h-11 pl-10 pr-10 border-0 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition placeholder:text-slate-400"
              />
              <FileText size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              {selectedCourrier ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourrier(null)
                    setForm({ ...form, courrier_id: '' })
                    setCourrierSearch('')
                    setShowCourrierDropdown(true)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X size={14} />
                </button>
              ) : courriersLoading ? (
                <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
              ) : null}
              {showCourrierDropdown && !selectedCourrier && (
                <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                  {courriers.length === 0 && !courriersLoading && (
                    <p className="p-3.5 text-xs text-slate-400 text-center">
                      {courrierSearch ? `Aucun courrier pour "${courrierSearch}".` : 'Aucun courrier disponible.'}
                    </p>
                  )}
                  {courriers.map((courrier) => (
                    <button
                      key={courrier.id}
                      type="button"
                      onClick={() => {
                        setSelectedCourrier(courrier)
                        setForm({ ...form, courrier_id: courrier.id })
                        setCourrierSearch('')
                        setShowCourrierDropdown(false)
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-b-0"
                    >
                      <span className="font-semibold text-indigo-700">{courrier.numero}</span>
                      <span className="text-slate-600 ml-2">{courrier.objet}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Message</label>
            <textarea
              required
              rows={6}
              value={form.contenu}
              onChange={(event) => setForm({ ...form, contenu: event.target.value })}
              className="w-full p-4 border-0 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition resize-none placeholder:text-slate-400"
              placeholder="Rédigez votre message..."
            />
          </div>

          <div className="h-3" />

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2.5">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4 flex items-center gap-3">
          <button
            type="submit"
            form="composer-form"
            disabled={submitting}
            className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-indigo-600 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Envoi...</>
            ) : (
              <><Send size={16} /> Envoyer</>
            )}
          </button>
          {!editingMessage && (
            <button
              type="submit"
              form="composer-form"
              data-action="save"
              disabled={submitting}
              className="h-11 px-5 border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"
            >
              <Save size={16} /> Brouillon
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 px-4 rounded-xl font-bold text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </>
  )
}
