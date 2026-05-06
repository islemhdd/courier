import { useState, useEffect } from 'react'
import {
  X,
  Upload,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { useAuth } from '../context/auth-context'

export default function NewCourrierForm({
  type = 'entrant',
  onClose,
  onSuccess,
  initialData = null
}) {
  const { user } = useAuth()
  const peutAjouterSource = user?.role_scope === 'general'
  const [showNewSourceInput, setShowNewSourceInput] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Données de métadonnées pour les sélections hiérarchiques
  const [meta, setMeta] = useState({
    niveaux_confidentialite: [],
    structures: [],
    services: [],
    utilisateurs: [],
    types: [],
    sources: [],
    instructions: [],
    modes_diffusion: ['unicast', 'multicast', 'broadcast']
  })

  // État du formulaire
  const [form, setForm] = useState({
    objet: '',
    resume: '',
    type: type,
    courrier_type_id: '',
    date_reception: new Date().toISOString().slice(0, 10),
    niveau_confidentialite_id: '',
    source_id: '',
    source_libelle: '',
    requiert_reponse: false,
    delai_reponse_jours: 7,
    mode_diffusion: 'unicast',
    recipients: [], // { recipient_type, structure_id, service_id, user_id }
    concerned_user_ids: [],
    instructions: [], // { instruction_id, commentaire, validation_requise }
    documents: [],
    parent_courrier_id: '',
    ...initialData
  })

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await courrierApi.getCreateData()
        setMeta(res.data)
        if (!initialData) {
          setForm(prev => ({
            ...prev,
            niveau_confidentialite_id: res.data.niveaux_confidentialite[0]?.id || '',
            courrier_type_id: res.data.types[0]?.id || ''
          }))
        } else {
          setForm(prev => ({
            ...prev,
            ...initialData,
            niveau_confidentialite_id: initialData.niveau_confidentialite_id || res.data.niveaux_confidentialite[0]?.id || '',
            courrier_type_id: initialData.courrier_type_id || res.data.types[0]?.id || ''
          }))
        }
      } catch {
        setError('Impossible de charger les métadonnées.')
      } finally {
        setLoading(false)
      }
    }
    fetchMeta()
  }, [initialData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()

      // Ajout des champs simples
      Object.keys(form).forEach(key => {
        if (key === 'documents') {
          form.documents.forEach(file => formData.append('documents[]', file))
        } else if (!['recipients', 'instructions', 'concerned_user_ids'].includes(key)) {
          if (form[key] !== null && form[key] !== undefined) {
            let value = form[key]
            if (typeof value === 'boolean') {
              value = value ? 1 : 0
            }
            formData.append(key, value)
          }
        }
      })

      // Préparation des tableaux complexes avec indexation pour le backend Laravel
      form.recipients.forEach((r, i) => {
        formData.append(`recipients[${i}][recipient_type]`, r.recipient_type)
        if (r.structure_id) formData.append(`recipients[${i}][structure_id]`, r.structure_id)
        if (r.service_id) formData.append(`recipients[${i}][service_id]`, r.service_id)
        if (r.user_id) formData.append(`recipients[${i}][user_id]`, r.user_id)
      })

      form.instructions.forEach((inst, i) => {
        if (inst.instruction_id) formData.append(`instructions[${i}][instruction_id]`, inst.instruction_id)
        formData.append(`instructions[${i}][commentaire]`, inst.commentaire)
        formData.append(`instructions[${i}][validation_requise]`, inst.validation_requise ? 1 : 0)
      })

      form.concerned_user_ids.forEach(id => formData.append('concerned_user_ids[]', id))

      await courrierApi.create(formData)
      onSuccess()
    } catch (err) {
      console.error(err)
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat()[0]
        : (err.response?.data?.message || 'Erreur lors de l’envoi.')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const addRecipient = () => setForm(p => ({ ...p, recipients: [...p.recipients, { recipient_type: 'structure', structure_id: '', service_id: '', user_id: '' }] }))
  const removeRecipient = (index) => setForm(p => ({ ...p, recipients: p.recipients.filter((_, i) => i !== index) }))
  const updateRecipient = (index, field, value) => {
    const nr = [...form.recipients]
    nr[index] = { ...nr[index], [field]: value }
    if (field === 'recipient_type' || field === 'structure_id') { nr[index].service_id = ''; nr[index].user_id = ''; }
    if (field === 'service_id') { nr[index].user_id = ''; }
    setForm(p => ({ ...p, recipients: nr }))
  }

  const addInstruction = () => setForm(p => ({ ...p, instructions: [...p.instructions, { instruction_id: '', commentaire: '', validation_requise: false }] }))
  const removeInstruction = (index) => setForm(p => ({ ...p, instructions: p.instructions.filter((_, i) => i !== index) }))
  const updateInstruction = (index, field, value) => {
    const ni = [...form.instructions]
    ni[index] = { ...ni[index], [field]: value }
    setForm(p => ({ ...p, instructions: ni }))
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* En-tête standard */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${type === 'entrant' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
               <Plus size={20} />
             </div>
             <div>
               <h2 className="text-base font-bold text-slate-900">
                 Nouveau Courrier {type === 'entrant' ? 'Arrivé' : 'Départ'}
               </h2>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                 Circuit hiérarchique
               </p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">


          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

            {/* Colonne 1: Infos Générales */}
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Objet du courrier</label>
                <input required value={form.objet} onChange={e => setForm({...form, objet: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Sujet..." />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Résumé / Contenu</label>
                <textarea required rows={4} value={form.resume} onChange={e => setForm({...form, resume: e.target.value})} className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Détails du contenu..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                  <select required value={form.courrier_type_id} onChange={e => setForm({...form, courrier_type_id: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                    {meta.types.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confidentialité</label>
                  <select required value={form.niveau_confidentialite_id} onChange={e => setForm({...form, niveau_confidentialite_id: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                    {meta.niveaux_confidentialite.map(n => <option key={n.id} value={n.id}>{n.libelle}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date de réception</label>
                  <input type="date" value={form.date_reception} onChange={e => setForm({...form, date_reception: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source (Entité)</label>
                  {!showNewSourceInput ? (
                    <div className="flex gap-2">
                      <select
                        required
                        value={form.source_id}
                        onChange={e => {
                          if (e.target.value === 'NEW') {
                            setShowNewSourceInput(true)
                            setForm({...form, source_id: '', source_libelle: ''})
                          } else {
                            const f = meta.sources.find(s => s.id == e.target.value)
                            setForm({...form, source_id: e.target.value, source_libelle: f ? f.libelle : ''})
                          }
                        }}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                      >
                        <option value="">Choisir la source...</option>
                        {meta.sources.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                        {peutAjouterSource && <option value="NEW">+ Nouvelle source...</option>}
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-left-2">
                      <input
                        autoFocus
                        required
                        value={form.source_libelle}
                        onChange={e => setForm({...form, source_libelle: e.target.value})}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none"
                        placeholder="Nom de la source..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewSourceInput(false)}
                        className="px-3 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Suivi réponse */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={form.requiert_reponse} onChange={e => setForm({...form, requiert_reponse: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Réponse attendue</span>
                </label>
                {form.requiert_reponse && (
                  <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Délai (jours)</label>
                    <input type="number" min="1" value={form.delai_reponse_jours} onChange={e => setForm({...form, delai_reponse_jours: e.target.value})} className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-bold outline-none" />
                  </div>
                )}
              </div>
            </div>

            {/* Colonne 2: Circuit & Pièces */}
            <div className="space-y-8">

              {/* Diffusion */}
              {/* TODO :if the choice is unicast , thier is no ajouter destinataire , elle apeir seulement dans le cas multicast */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Destinataires & Mode</p>
                <div className="flex gap-2 p-1 bg-slate-50 rounded-lg w-fit">
                  {['unicast', 'multicast', 'broadcast'].map(m => (
                    <button key={m} type="button" onClick={() => setForm({...form, mode_diffusion: m, recipients: m === 'broadcast' ? [] : form.recipients})} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${form.mode_diffusion === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {m}
                    </button>
                  ))}
                </div>

                {form.mode_diffusion !== 'broadcast' ? (
                  <div className="space-y-3">
                    {form.recipients.map((r, i) => (
                      <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3 animate-in zoom-in-95">
                        <button type="button" onClick={() => removeRecipient(i)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        <div className="grid grid-cols-2 gap-3">
                          <select value={r.recipient_type} onChange={e => updateRecipient(i, 'recipient_type', e.target.value)} className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none">
                            <option value="structure">Structure</option>
                            <option value="service">Service</option>
                            <option value="user">Utilisateur</option>
                          </select>
                          <select value={r.structure_id} onChange={e => updateRecipient(i, 'structure_id', e.target.value)} className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none">
                            <option value="">Structure...</option>
                            {meta.structures.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                          </select>
                        </div>
                        {r.recipient_type !== 'structure' && (
                          <select value={r.service_id} onChange={e => updateRecipient(i, 'service_id', e.target.value)} className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none">
                            <option value="">Service...</option>
                            {meta.services.filter(s => !r.structure_id || s.structure_id == r.structure_id).map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                          </select>
                        )}
                        {r.recipient_type === 'user' && (
                          <select value={r.user_id} onChange={e => updateRecipient(i, 'user_id', e.target.value)} className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none">
                            <option value="">Utilisateur...</option>
                            {meta.utilisateurs.filter(u => !r.service_id || u.service_id == r.service_id).map(u => <option key={u.id} value={u.id}>{u.nom_complet || `${u.prenom} ${u.nom}`}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addRecipient} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all">+ Ajouter un destinataire</button>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center gap-3">
                    <Users size={18} />
                    <p className="text-xs font-medium">Mode Broadcast : Visible par toute l'organisation.</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Instructions & Annotations</p>
                <div className="space-y-3">
                  {form.instructions.map((inst, i) => (
                    <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in slide-in-from-right-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Annotation {i+1}</span>
                        <button type="button" onClick={() => removeInstruction(i)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                      <select value={inst.instruction_id} onChange={e => updateInstruction(i, 'instruction_id', e.target.value)} className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none">
                        <option value="">Commentaire libre...</option>
                        {meta.instructions.map(it => <option key={it.id} value={it.id}>{it.libelle}</option>)}
                      </select>
                      <textarea value={inst.commentaire} onChange={e => updateInstruction(i, 'commentaire', e.target.value)} className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white outline-none" placeholder="Précisions..." />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={inst.validation_requise} onChange={e => updateInstruction(i, 'validation_requise', e.target.checked)} className="rounded" />
                        <span className="text-[10px] font-bold text-slate-500">Validation du chef requise</span>
                      </label>
                    </div>
                  ))}
                  <button type="button" onClick={addInstruction} className="w-full py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">+ Ajouter une instruction</button>
                </div>
              </div>

              {/* Pièces jointes */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Pièces Jointes</p>
                <div className="relative h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 hover:border-slate-300 transition-all">
                  <input type="file" multiple onChange={e => setForm({...form, documents: [...form.documents, ...Array.from(e.target.files)]})} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Upload size={20} className="text-slate-400 mb-1" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Glisser ou cliquer</p>
                </div>
                <div className="space-y-2">
                  {form.documents.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg text-xs font-medium text-slate-600 shadow-sm animate-in fade-in">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={14} className="text-slate-400" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <button type="button" onClick={() => setForm({...form, documents: form.documents.filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500 transition-colors"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
            {error && <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in"><AlertCircle size={14} /> {error}</div>}
        </form>

        {/* Pied de page standard */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all uppercase tracking-wider">Annuler</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-8 h-10 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-all">
            {submitting ? <Clock className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {submitting ? 'Traitement...' : 'Enregistrer le courrier'}
          </button>
        </div>
      </div>
    </div>
  )
}
