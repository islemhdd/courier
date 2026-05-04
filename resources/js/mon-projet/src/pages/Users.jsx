import { useEffect, useState } from 'react'
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
  ShieldCheck,
  X
} from 'lucide-react'
import api from '../api/api'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  
  const [meta, setMeta] = useState({ structures: [], services: [] })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: 'secrétaire',
    structure_id: '',
    service_id: ''
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, metaRes] = await Promise.all([
        api.get('/users'),
        api.get('/courriers/create') // To get structures/services
      ])
      setUsers(usersRes.data)
      setMeta(metaRes.data)
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, form)
      } else {
        await api.post('/users', form)
      }
      setModalOpen(false)
      loadData()
    } catch (err) {
      setError('Erreur lors de l’enregistrement.')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet utilisateur ?')) return
    try {
      await api.delete(`/users/${id}`)
      loadData()
    } catch (err) {
      setError('Erreur lors de la suppression.')
    }
  }

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user)
      setForm({
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        password: '',
        role: user.role,
        structure_id: user.structure_id || '',
        service_id: user.service_id || ''
      })
    } else {
      setEditingUser(null)
      setForm({ nom: '', prenom: '', email: '', password: '', role: 'secrétaire', structure_id: '', service_id: '' })
    }
    setModalOpen(true)
  }

  const filteredUsers = users.filter(u => 
    `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <div className="h-10 w-10 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center">
             <Users size={20} />
           </div>
           <div>
             <h1 className="text-lg font-bold text-slate-900">Utilisateurs</h1>
             <p className="text-xs text-slate-500">Gérez les accès et les structures.</p>
           </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="h-10 w-full sm:w-64 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none"
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="h-10 px-4 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Utilisateur</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Rôle</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Structure / Service</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{u.prenom} {u.nom}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <Building size={12} className="text-slate-400" />
                        {u.structure?.libelle || '-'}
                      </div>
                      {u.service && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Building2 size={10} className="text-slate-300" />
                          {u.service.libelle}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openModal(u)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(u.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{editingUser ? 'Modifier' : 'Ajouter'} Utilisateur</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Nom</label>
                   <input required value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Prénom</label>
                   <input required value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                 <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
               </div>
               {!editingUser && (
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Mot de passe</label>
                   <input required type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm" />
                 </div>
               )}
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-slate-400 uppercase">Rôle</label>
                 <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm">
                   <option value="secrétaire">Secrétaire</option>
                   <option value="chef">Chef</option>
                   <option value="admin">Administrateur</option>
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Structure</label>
                   <select value={form.structure_id} onChange={e => setForm({...form, structure_id: e.target.value, service_id: ''})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm">
                     <option value="">Aucune</option>
                     {meta.structures.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase">Service</label>
                   <select value={form.service_id} onChange={e => setForm({...form, service_id: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm">
                     <option value="">Aucun</option>
                     {meta.services.filter(s => !form.structure_id || s.structure_id == form.structure_id).map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                   </select>
                 </div>
               </div>
               <div className="pt-4 flex gap-3">
                 <button type="submit" className="flex-1 h-11 bg-slate-900 text-white rounded-lg font-bold text-sm">Enregistrer</button>
                 <button type="button" onClick={() => setModalOpen(false)} className="h-11 px-6 border border-slate-200 rounded-lg font-bold text-sm">Annuler</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
