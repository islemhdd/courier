import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText,
  Scan,
  ScanText,
  Eye,
  EyeOff,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  ShieldCheck,
  Send,
  Loader2,
  RefreshCw,
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
  // Pour les courriers sortants, interdire la création de nouvelle source
  const canAddNewSource = peutAjouterSource && type !== 'sortant'
  const [showNewSourceInput, setShowNewSourceInput] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ocrStates, setOcrStates] = useState({}) // { index: { status, summary, text, error } }
  const [showExtractedText, setShowExtractedText] = useState(false)
  const [activeTab, setActiveTab] = useState('infos') // 'infos' or 'circuit'

  // Données de métadonnées
  const [meta, setMeta] = useState({
    niveaux_confidentialite: [],
    structures: [],
    services: [],
    utilisateurs: [],
    types: [],
    sources: [],
    instructions: [],
    modes_diffusion: ['unicast', 'multicast', 'broadcast'],
    courriers_recus: []
  })

  // État du formulaire
  const [form, setForm] = useState({
    objet: '',
    resume: '',
    type: type,
    courrier_type_id: '',
    date_creation: new Date().toISOString().slice(0, 10),
    date_reception: new Date().toISOString().slice(0, 10),
    niveau_confidentialite_id: '',
    source_id: '',
    source_libelle: '',
    requiert_reponse: false,
    delai_reponse_jours: 7,
    mode_diffusion: 'unicast',
    recipients: [],
    concerned_user_ids: [],
    instructions: [],
    documents: [],
    parent_courrier_id: '',
    ...initialData
  })

  const runOcrPreview = useCallback(async (file, index) => {
    setOcrStates(prev => ({ ...prev, [index]: { status: 'processing', summary: '', text: '', error: '' } }))

    try {
      const res = await courrierApi.ocrPreview(file)
      const { summary, text, success } = res.data

      if (success) {
        setOcrStates(prev => ({
          ...prev,
          [index]: { status: 'completed', summary: summary || '', text: text || '', error: '' }
        }))

        if (summary) {
          setForm(prev => ({
            ...prev,
            resume: prev.resume ? prev.resume + "\n" + summary : summary
          }))
        }
      } else {
        setOcrStates(prev => ({
          ...prev,
          [index]: { status: 'failed', summary: '', text: '', error: res.data.error || 'Échec OCR' }
        }))
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erreur lors de l\'analyse OCR'
      setOcrStates(prev => ({
        ...prev,
        [index]: { status: 'failed', summary: '', text: '', error: errorMsg }
      }))
    }
  }, [])

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await courrierApi.getCreateData()
        const newMeta = { ...res.data, courriers_recus: [] }

        // Charger les courriers reçus si c'est un courrier sortant (pour réponses)
        if (type === 'sortant') {
          try {
            const receivedRes = await courrierApi.recus({ q: '', page: 1 })
            newMeta.courriers_recus = receivedRes.data.courriers || []
          } catch {
            // Ignore error for received courriers
          }
        }

        setMeta(newMeta)
        if (!initialData) {
          setForm(prev => ({
            ...prev,
            niveau_confidentialite_id: newMeta.niveaux_confidentialite[0]?.id || '',
            courrier_type_id: newMeta.types[0]?.id || ''
          }))
        } else {
          setForm(prev => ({
            ...prev,
            ...initialData,
            niveau_confidentialite_id: initialData.niveau_confidentialite_id || newMeta.niveaux_confidentialite[0]?.id || '',
            courrier_type_id: initialData.courrier_type_id || newMeta.types[0]?.id || ''
          }))
        }
      } catch {
        setError('Impossible de charger les métadonnées.')
      } finally {
        setLoading(false)
      }
    }
    fetchMeta()
  }, [initialData, type])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()

      Object.keys(form).forEach(key => {
        if (key === 'documents') {
          form.documents.forEach(file => formData.append('documents[]', file))
        } else if (!['recipients', 'instructions', 'concerned_user_ids', 'date_creation'].includes(key)) {
          if (form[key] !== null && form[key] !== undefined) {
            let value = form[key]
            if (typeof value === 'boolean') {
              value = value ? 1 : 0
            }
            formData.append(key, value)
          }
        }
      })

      // Pour les courriers sortants, ne pas envoyer de destinataires (pas de diffusion interne)
      if (type === 'entrant') {
        form.recipients.forEach((r, i) => {
          formData.append(`recipients[${i}][recipient_type]`, r.recipient_type)
          if (r.structure_id) formData.append(`recipients[${i}][structure_id]`, r.structure_id)
          if (r.service_id) formData.append(`recipients[${i}][service_id]`, r.service_id)
          if (r.user_id) formData.append(`recipients[${i}][user_id]`, r.user_id)
        })
      } else {
        // Pour les sortants, mode unicast sans destinataires
        formData.set('mode_diffusion', 'unicast')
      }

      form.instructions.forEach((inst, i) => {
        if (inst.instruction_id) formData.append(`instructions[${i}][instruction_id]`, inst.instruction_id)
        formData.append(`instructions[${i}][commentaire]`, inst.commentaire)
        formData.append(`instructions[${i}][validation_requise]`, inst.validation_requise ? 1 : 0)
      })

      form.concerned_user_ids.forEach(id => formData.append('concerned_user_ids[]', id))

      await courrierApi.create(formData)
      onSuccess()
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat()[0]
        : (err.response?.data?.message || 'Erreur lors de l’envoi.')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileAdd = (files) => {
    const newFiles = Array.from(files)
    const startIndex = form.documents.length

    setForm(p => ({ ...p, documents: [...p.documents, ...newFiles] }))

    newFiles.forEach((file, i) => {
      const index = startIndex + i
      runOcrPreview(file, index)
    })
  }

  const handleFileRemove = (index) => {
    setForm(p => ({ ...p, documents: p.documents.filter((_, idx) => idx !== index) }))
    setOcrStates(prev => {
      const updated = {}
      Object.keys(prev).forEach(key => {
        const k = parseInt(key)
        if (k < index) updated[k] = prev[k]
        else if (k > index) updated[k - 1] = prev[k]
      })
      return updated
    })
  }

  const getOcrIcon = (state) => {
    if (!state) return <FileText size={16} className="text-slate-400" />
    switch (state.status) {
      case 'processing': return <RefreshCw size={16} className="text-blue-500 animate-spin" />
      case 'completed': return <ScanText size={16} className="text-emerald-500" />
      case 'failed': return <AlertCircle size={16} className="text-rose-500" />
      default: return <FileText size={16} className="text-slate-400" />
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

  const addInstruction = () => setForm(p => ({ ...p, instructions: [...p.instructions, { instruction_id: '', commentaire: '', validation_requise: true }] }))
  const removeInstruction = (index) => setForm(p => ({ ...p, instructions: p.instructions.filter((_, i) => i !== index) }))
  const updateInstruction = (index, field, value) => {
    const ni = [...form.instructions]
    ni[index] = { ...ni[index], [field]: value }
    setForm(p => ({ ...p, instructions: ni }))
  }

  if (loading) return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-slide-in">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-500">Chargement du formulaire...</p>
          <p className="text-xs text-slate-400 mt-1">Préparation des données</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-slide-in">
      {/* Header */}
      <div className="shrink-0 px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${type === 'entrant' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
            <Send size={20} className={type === 'entrant' ? 'rotate-180' : ''} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nouveau Courrier {type === 'entrant' ? 'Arrivé' : 'Départ'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${type === 'entrant' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                {type}
              </span>
              <ChevronRight size={10} className="text-slate-300" />
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                Enregistrement dans le circuit
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex px-6 bg-slate-50/50 border-b border-slate-100">
        <button
          onClick={() => setActiveTab('infos')}
          className={`px-5 py-3.5 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'infos' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Informations & Fichiers
          {activeTab === 'infos' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
        </button>
        {/* Affiche le tab destinataires uniquement pour les courriers entrants */}
        {type === 'entrant' && (
          <button
            onClick={() => setActiveTab('circuit')}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'circuit' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Destinataires & Circuit
            {activeTab === 'circuit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
          </button>
        )}
      </div>

      <form id="courrier-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
        <div className="p-6">
          {activeTab === 'infos' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Info size={15} className="text-indigo-500" />
                    Détails de l'envoi
                  </h3>
                  <p className="text-xs text-slate-500">
                    <strong>Type de courrier :</strong> {type === 'entrant' ? 'Entrant' : 'Sortant'} •
                    <strong className="ml-1">Date de création :</strong> {form.date_creation}
                  </p>

                  {/* Info pour les courriers sortants */}
                  {type === 'sortant' && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-700">
                        <strong>ℹ️ Courrier Sortant :</strong> Le destinataire est la source externe que vous avez spécifiée ci-dessus. Pas de diffusion interne.
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">Objet du courrier</label>
                    <input
                      required
                      value={form.objet}
                      onChange={e => setForm({...form, objet: e.target.value})}
                      className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
                      placeholder="Ex: Demande de matériel informatique..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">Résumé / Contenu analytique</label>
                    <textarea
                      required
                      rows={4}
                      value={form.resume}
                      onChange={e => setForm({...form, resume: e.target.value})}
                      className="w-full p-4 bg-slate-50 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition leading-relaxed resize-none"
                      placeholder="Saisissez un résumé..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                        <Layers size={12} /> Type
                      </label>
                      <select
                        disabled
                        required
                        value={type === 'entrant'?1:2}
                        // onChange={e => setForm({...form, courrier_type_id: e.target.value})}
                        className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-medium outline-none cursor-not-allowed opacity-60"
                      >
                        {meta.types.map(t => <option key={t.id} value={t.id}>{t.libelle}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                        <ShieldCheck size={12} /> Confidentialité
                      </label>
                      <select
                        required
                        value={form.niveau_confidentialite_id}
                        onChange={e => setForm({...form, niveau_confidentialite_id: e.target.value})}
                        className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-medium outline-none cursor-pointer"
                      >
                        {meta.niveaux_confidentialite.map(n => <option key={n.id} value={n.id}>{n.libelle}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                        <Calendar size={12} /> {type === 'sortant' ? 'Date de création' : 'Date de réception'}
                      </label>
                      <input disabled
                        type="date"
                        value={form.date_reception}
                        onChange={e => setForm({...form, date_reception: e.target.value})}
                        readOnly={type === 'sortant'}
                        className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-medium outline-none cursor-not-allowed opacity-60  "
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500">Source (Expéditeur)</label>
                      {!showNewSourceInput ? (
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
                          className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-medium outline-none cursor-pointer"
                        >
                          <option value="">Choisir la source...</option>
                          {meta.sources.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                          {canAddNewSource && <option value="NEW" className="text-indigo-600 font-bold">+ Créer nouvelle source</option>}
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            required
                            value={form.source_libelle}
                            onChange={e => setForm({...form, source_libelle: e.target.value})}
                            className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm outline-none"
                            placeholder="Nom de l'entité..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewSourceInput(false)}
                            className="h-11 px-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {type === 'sortant' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-500">Courrier  Réponse à</label>
                      <select
                        value={form.parent_courrier_id}
                        onChange={e => setForm({...form, parent_courrier_id: e.target.value})}
                        className="w-full h-11 px-4 bg-slate-50 border-0 rounded-xl text-sm font-medium outline-none cursor-pointer"
                      >
                        <option value="">Aucun (Nouveau courrier)</option>
                        {meta.courriers_recus.map(c => <option key={c.id} value={c.id}>{c.numero ? `${c.numero} - ` : ''}{c.objet}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className={`p-5 rounded-xl transition-all border ${form.requiert_reponse ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${form.requiert_reponse ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                        <Clock size={15} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-700">Ce courrier nécessite une réponse</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Activez pour définir un délai de traitement</p>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${form.requiert_reponse ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <input type="checkbox" checked={form.requiert_reponse} onChange={e => setForm({...form, requiert_reponse: e.target.checked})} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.requiert_reponse ? 'right-1' : 'left-1'}`} />
                    </div>
                  </label>

                  {form.requiert_reponse && (
                    <div className="mt-4 pt-4 border-t border-amber-100 flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1.5 ml-1">Délai (jours)</label>
                        <input
                          type="number"
                          min="1"
                          value={form.delai_reponse_jours}
                          onChange={e => setForm({...form, delai_reponse_jours: e.target.value})}
                          className="w-full h-10 px-4 bg-white border border-amber-200 rounded-xl text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                      </div>
                      <div className="flex-[2] p-3 bg-white/60 rounded-xl border border-amber-100">
                        <p className="text-[10px] text-amber-700 leading-tight">
                          Date limite : <strong>{new Date(new Date(form.date_reception).getTime() + (form.delai_reponse_jours * 86400000)).toLocaleDateString()}</strong>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Scan size={15} className="text-indigo-500" />
                    Numérisation & Pièces
                  </h3>

                  <div className="relative group cursor-pointer">
                    <div className="h-36 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-white hover:border-indigo-400 transition-all">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        onChange={e => { handleFileAdd(e.target.files); e.target.value = '' }}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className="h-11 w-11 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Plus size={22} className="text-indigo-500" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Ajouter des documents</p>
                      <p className="text-[10px] text-slate-400 mt-1">PDF, DOC, images...</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {form.documents.map((f, i) => {
                      const ocr = ocrStates[i]
                      return (
                        <div key={i} className="group p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 transition-all hover:bg-white hover:shadow-sm">
                          <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${ocr?.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-400'}`}>
                            {getOcrIcon(ocr)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{f.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} Mo</span>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                ocr?.status === 'processing' ? 'text-blue-500' :
                                ocr?.status === 'completed' ? 'text-emerald-500' :
                                ocr?.status === 'failed' ? 'text-rose-500' : 'text-slate-400'
                              }`}>
                                {ocr?.status === 'processing' ? 'Analyse...' :
                                 ocr?.status === 'completed' ? 'Texte Extrait' :
                                 ocr?.status === 'failed' ? 'Échec OCR' : 'En attente'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFileRemove(i)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {Object.values(ocrStates).some(s => s.status === 'completed' && s.text) && (
                    <div className="space-y-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowExtractedText(!showExtractedText)}
                        className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                          showExtractedText ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {showExtractedText ? <EyeOff size={13} /> : <ScanText size={13} />}
                        {showExtractedText ? 'Masquer le texte extrait' : 'Inspecter le contenu OCR'}
                      </button>

                      {showExtractedText && (
                        <div className="p-4 bg-slate-900 rounded-xl max-h-56 overflow-y-auto">
                          {Object.entries(ocrStates)
                           .filter(([_, s]) => s.status === 'completed' && s.text)
                           .map(([idx, s]) => (
                             <div key={idx} className="mb-4 last:mb-0">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                 Document {parseInt(idx) + 1}
                               </p>
                               <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                                 {s.text}
                               </p>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Users size={15} className="text-indigo-500" />
                      Circuit de diffusion
                    </h3>
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                      {['unicast', 'multicast', 'broadcast'].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setForm({...form, mode_diffusion: m, recipients: m === 'broadcast' ? [] : form.recipients})}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${form.mode_diffusion === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.mode_diffusion !== 'broadcast' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        {form.recipients.map((r, i) => (
                          <div key={i} className="group p-4 bg-slate-50 border border-slate-100 rounded-xl relative space-y-3 transition-all hover:bg-white hover:shadow-sm">
                            <button
                              type="button"
                              onClick={() => removeRecipient(i)}
                              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center bg-white text-slate-300 hover:text-rose-500 rounded-full shadow-sm border border-slate-100 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>

                            <div className="flex items-center gap-3">
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type Cible</label>
                                <select
                                  value={r.recipient_type}
                                  onChange={e => updateRecipient(i, 'recipient_type', e.target.value)}
                                  className="w-full h-9 px-3 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none"
                                >
                                  <option value="structure">Structure</option>
                                  <option value="service">Service</option>
                                  <option value="user">Utilisateur</option>
                                </select>
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Structure</label>
                                <select
                                  value={r.structure_id}
                                  onChange={e => updateRecipient(i, 'structure_id', e.target.value)}
                                  className="w-full h-9 px-3 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none"
                                >
                                  <option value="">Choisir...</option>
                                  {meta.structures.map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              {r.recipient_type !== 'structure' && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</label>
                                  <select
                                    value={r.service_id}
                                    onChange={e => updateRecipient(i, 'service_id', e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none disabled:opacity-50"
                                    disabled={!r.structure_id}
                                  >
                                    <option value="">Choisir...</option>
                                    {meta.services.filter(s => !r.structure_id || s.structure_id == r.structure_id).map(s => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                                  </select>
                                </div>
                              )}
                              {r.recipient_type === 'user' && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent</label>
                                  <select
                                    value={r.user_id}
                                    onChange={e => updateRecipient(i, 'user_id', e.target.value)}
                                    className="w-full h-9 px-3 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none disabled:opacity-50"
                                    disabled={!r.service_id}
                                  >
                                    <option value="">Choisir...</option>
                                    {meta.utilisateurs.filter(u => !r.service_id || u.service_id == r.service_id).map(u => <option key={u.id} value={u.id}>{u.nom_complet || `${u.prenom} ${u.nom}`}</option>)}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={addRecipient}
                        className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={15} />
                        Ajouter un point de diffusion
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col items-center text-center gap-3">
                      <div className="h-14 w-14 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                        <Users size={28} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-indigo-900">Mode Broadcast activé</p>
                        <p className="text-xs text-indigo-700/70 mt-1 max-w-xs leading-relaxed">
                          Visible par l'ensemble des structures et services.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ScanText size={15} className="text-indigo-500" />
                    Instructions & Annotations
                  </h3>

                  <div className="space-y-3">
                    {form.instructions.map((inst, i) => (
                      <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 relative group">
                        <button
                          type="button"
                          onClick={() => removeInstruction(i)}
                          className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="space-y-1 pr-7">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type d'instruction</label>
                          <select
                            value={inst.instruction_id}
                            onChange={e => updateInstruction(i, 'instruction_id', e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-100 rounded-lg text-xs font-bold outline-none"
                          >
                            <option value="">Commentaire libre</option>
                            {meta.instructions.map(it => <option key={it.id} value={it.id}>{it.libelle}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Note</label>
                          <textarea
                            value={inst.commentaire}
                            onChange={e => updateInstruction(i, 'commentaire', e.target.value)}
                            className="w-full p-3 bg-white border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-200 transition"
                            placeholder="Saisissez vos instructions..."
                          />
                        </div>

                      <label className="flex items-center gap-2.5 w-fit">
  <div className="w-9 h-5 rounded-full relative bg-emerald-500">
    <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full" />
  </div>
  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
    Validation hiérarchique requise
  </span>
</label>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addInstruction}
                      className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      Ajouter une annotation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full sm:w-auto">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 flex items-center gap-2">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-all uppercase tracking-widest"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="courrier-form"
              disabled={submitting}
              className={`flex-1 sm:flex-none px-8 h-11 rounded-xl text-xs font-bold uppercase tracking-widest text-white shadow-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 ${
                type === 'entrant'
                  ? 'bg-slate-950 hover:bg-slate-800'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Traitement...</>
              ) : (
                <><CheckCircle2 size={16} /> Finaliser l'enregistrement</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
