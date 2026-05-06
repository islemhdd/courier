import { useState, useEffect } from 'react'
import {
  X,
  Upload,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'

export default function ReplyCourrierForm({
  type = 'entrant',
  onClose,
  onSuccess,
  initialData = null
}) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // État du formulaire - seulement les champs nécessaires pour une réponse
  const [form, setForm] = useState({
    objet: initialData?.objet || '',
    resume: '',
    type: type,
    date_reception: new Date().toISOString().slice(0, 10),
    requiert_reponse: false,
    delai_reponse_jours: 7,
    mode_diffusion: 'unicast', // Requis par la validation
    documents: [],
    parent_courrier_id: initialData?.parent_courrier_id || ''
  })

  useEffect(() => {
    // Pour les réponses, pas besoin de charger les métadonnées
    // On peut directement passer au rendu du formulaire
    setForm(prev => ({
      ...prev,
      objet: initialData?.objet || prev.objet,
      parent_courrier_id: initialData?.parent_courrier_id || prev.parent_courrier_id
    }))
    setLoading(false)
  }, [initialData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()

      // Ajout des champs simples - exclure les champs masqués pour les réponses
      Object.keys(form).forEach(key => {
        if (key === 'documents') {
          form.documents.forEach(file => formData.append('documents[]', file))
        } else if (!['recipients', 'instructions', 'concerned_user_ids'].includes(key)) {
          // Pour les réponses, ne pas envoyer les champs masqués sauf 'type' qui est nécessaire pour la validation
          if (['source_id', 'niveau_confidentialite_id', 'courrier_type_id'].includes(key)) {
            return
          }
          if (form[key] !== null && form[key] !== undefined) {
            let value = form[key]
            if (typeof value === 'boolean') {
              value = value ? 1 : 0
            }
            formData.append(key, value)
          }
        }
      })

      // Les destinataires, instructions et concerned_user_ids ne sont pas envoyés pour les réponses
      // car ils sont hérités du parent

      await courrierApi.create(formData)
      onSuccess()
    } catch (_) {
      console.error(_)
      const msg = _.response?.data?.errors
        ? Object.values(_.response.data.errors).flat()[0]
        : (_.response?.data?.message || 'Erreur lors de l’envoi.')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* En-tête pour réponse */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${type === 'entrant' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
               <Plus size={20} />
             </div>
             <div>
               <h2 className="text-base font-bold text-slate-900">
                 Réponse au courrier
               </h2>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                 Réponse simplifiée
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date de réception</label>
                  <input type="date" value={form.date_reception} onChange={e => setForm({...form, date_reception: e.target.value})} className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none" />
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

            {/* Colonne 2: Pièces jointes uniquement */}
            <div className="space-y-8">

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
            {submitting ? 'Traitement...' : 'Envoyer la réponse'}
          </button>
        </div>
      </div>
    </div>
  )
}
