import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mail,
  MailOpen,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
  ArrowRight,
  AlertCircle
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import Pagination from '../components/Pagination'
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
      const res = await messageApi.getAll({ type: mailbox, q: search || undefined, lu: readFilter || undefined, ...params })
      setMessages(res.data.messages.data)
      setPagination(res.data.messages)
      if (res.data.messages.data.length > 0 && !selectedMessage) {
        setSelectedMessage(res.data.messages.data[0])
      }
    } catch (err) {
      setError('Erreur de chargement.')
    } finally {
      setLoading(false)
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await messageApi.unreadCount()
      setUnreadCount(response.data.non_lus || 0)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    loadMessages()
    loadUnreadCount()
  }, [mailbox])

  const handleOpenMessage = async (msg) => {
    try {
      const res = await messageApi.getOne(msg.id)
      setSelectedMessage(res.data.message)
      if (mailbox === 'recu') loadUnreadCount()
    } catch (err) { console.error(err) }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce message ?')) return
    try {
      await messageApi.delete(selectedMessage.id)
      loadMessages()
    } catch (err) { console.error(err) }
  }

  const openComposer = () => {
    setEditingMessage(null); setForm(initialForm); setUserSearch(''); setUsers([]); setFormError(''); setComposerOpen(true)
    messageApi.searchUsers('').then(res => setUsers(res.data.utilisateurs || []))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const action = e.nativeEvent.submitter?.dataset?.action === 'save' ? 'save' : 'send'
      const payload = { contenu: form.contenu, courrier_id: form.courrier_id || null }
      if (editingMessage) {
        if (action === 'send') await messageApi.sendDraft(editingMessage.id)
        else await messageApi.update(editingMessage.id, payload)
      } else {
        await messageApi.send({ ...payload, destinataire_id: form.destinataire_id, envoyer: action === 'send' })
      }
      setComposerOpen(false); loadMessages()
    } catch (err) { setFormError('Erreur d’envoi.') } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
          {['recu', 'envoye', 'brouillon'].map(m => (
            <button key={m} onClick={() => setMailbox(m)} className={`px-4 h-10 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${mailbox === m ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              {m === 'recu' ? 'Boîte' : m === 'envoye' ? 'Envoyés' : 'Brouillons'}
            </button>
          ))}
          <button onClick={openComposer} className="px-4 h-10 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2">
            <Plus size={16} /> Nouveau
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 flex items-center gap-3">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                 <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadMessages({ page: 1 })} placeholder="Rechercher..." className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
               </div>
               <button onClick={() => loadMessages()} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-slate-600"><RefreshCw size={16} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 border-b">Statut</th>
                    <th className="px-4 py-3 border-b">{mailbox === 'recu' ? 'Emetteur' : 'Destinataire'}</th>
                    <th className="px-4 py-3 border-b">Aperçu</th>
                    <th className="px-4 py-3 border-right border-b text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {messages.map(m => (
                    <tr key={m.id} onClick={() => handleOpenMessage(m)} className={`cursor-pointer text-xs ${selectedMessage?.id === m.id ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3">
                        <span className={`w-2 h-2 rounded-full inline-block ${m.lu ? 'bg-slate-200' : 'bg-emerald-500'}`}></span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{mailbox === 'recu' ? m.emetteur?.nom_complet : m.destinataire?.nom_complet}</td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">{m.contenu}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{new Date(m.date_envoi).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-50">
               <Pagination pagination={pagination} onPageChange={page => loadMessages({ page })} />
            </div>
          </div>
        </div>

        <aside className="min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[400px]">
            {selectedMessage ? (
              <div className="space-y-6">
                <div>
                   <h3 className="text-sm font-bold text-slate-900 uppercase">Détails du message</h3>
                   <p className="text-[10px] text-slate-400 mt-1">{new Date(selectedMessage.date_envoi).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg space-y-2 text-xs">
                   <p><span className="font-bold text-slate-400">De:</span> {selectedMessage.emetteur?.nom_complet}</p>
                   <p><span className="font-bold text-slate-400">Pour:</span> {selectedMessage.destinataire?.nom_complet}</p>
                   {selectedMessage.courrier && <p><span className="font-bold text-slate-400">Courrier:</span> {selectedMessage.courrier.numero}</p>}
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap py-2">
                  {selectedMessage.contenu}
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <button onClick={handleDelete} className="w-full h-10 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center justify-center gap-2">
                    <Trash2 size={14} /> Supprimer le message
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 mt-10">Sélectionnez un message.</p>
            )}
          </div>
        </aside>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
               <h2 className="text-base font-bold text-slate-900">Composer un message</h2>
               <button onClick={() => setComposerOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
             </div>
             <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Destinataire</label>
                  <select required value={form.destinataire_id} onChange={e => setForm({...form, destinataire_id: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white">
                    <option value="">Choisir...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nom_complet} ({u.service?.libelle || u.role})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Contenu</label>
                  <textarea required rows={6} value={form.contenu} onChange={e => setForm({...form, contenu: e.target.value})} className="w-full p-3 border border-slate-200 rounded-lg text-sm" placeholder="Votre message..." />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="submit" className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm">Envoyer</button>
                  <button type="button" onClick={() => setComposerOpen(false)} className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm">Annuler</button>
                </div>
             </form>
           </div>
        </div>
      )}
    </div>
  )
}
