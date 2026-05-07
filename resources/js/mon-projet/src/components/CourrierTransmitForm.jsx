import { useEffect, useState } from 'react'
import {
  X,
  Trash2,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { courrierApi } from '../api/courrierApi'
import { useAuth } from '../context/auth-context'

export default function CourrierTransmitForm({ courrier, onClose, onSubmit }) {
  const { user } = useAuth()

  const [meta, setMeta] = useState({
    structures: [],
    services: [],
    utilisateurs: [],
    instructions: [],
  })

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    mode_diffusion: courrier?.mode_diffusion || 'unicast',
    recipients: [],
    instructions: [],
    commentaire: '',
    service_destinataire_id: courrier?.service_destinataire_id || '',
  })

  const isChefStructure = user?.role === 'chef' && user?.role_scope === 'structure'

  const allowedServices = isChefStructure
    ? meta.services.filter((service) => service.structure_id == user.structure_id)
    : meta.services

  const allowedStructures = isChefStructure
    ? meta.structures.filter((structure) => structure.id == user.structure_id)
    : meta.structures

  const allowedUtilisateurs = isChefStructure
    ? meta.utilisateurs.filter((utilisateur) => utilisateur.structure_id == user.structure_id)
    : meta.utilisateurs

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await courrierApi.getCreateData()

        setMeta(res.data)

        setForm((prev) => ({
          ...prev,
          mode_diffusion: courrier?.mode_diffusion || 'unicast',
          service_destinataire_id: courrier?.service_destinataire_id || '',
          recipients: [],
        }))
      } catch (err) {
        setError('Impossible de charger les données de transmission.')
      } finally {
        setLoading(false)
      }
    }

    fetchMeta()
  }, [courrier])

  const addRecipient = () =>
    setForm((prev) => ({
      ...prev,
      recipients: [
        ...prev.recipients,
        {
          recipient_type: 'service',
          structure_id: '',
          service_id: '',
          user_id: '',
        },
      ],
    }))

  const removeRecipient = (index) =>
    setForm((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }))

  const updateRecipient = (index, field, value) => {
    const nextRecipients = [...form.recipients]

    nextRecipients[index] = {
      ...nextRecipients[index],
      [field]: value,
    }

    if (field === 'recipient_type') {
      nextRecipients[index].structure_id = ''
      nextRecipients[index].service_id = ''
      nextRecipients[index].user_id = ''
    }

    if (field === 'structure_id') {
      nextRecipients[index].service_id = ''
      nextRecipients[index].user_id = ''
    }

    if (field === 'service_id') {
      nextRecipients[index].user_id = ''
    }

    setForm((prev) => ({
      ...prev,
      recipients: nextRecipients,
    }))
  }

  const addInstruction = () =>
    setForm((prev) => ({
      ...prev,
      instructions: [
        ...prev.instructions,
        {
          instruction_id: '',
          commentaire: '',
          validation_requise: false,
        },
      ],
    }))

  const removeInstruction = (index) =>
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }))

  const updateInstruction = (index, field, value) => {
    const nextInstructions = [...form.instructions]

    nextInstructions[index] = {
      ...nextInstructions[index],
      [field]: value,
    }

    setForm((prev) => ({
      ...prev,
      instructions: nextInstructions,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      mode_diffusion: form.mode_diffusion,
      service_destinataire_id:
        form.recipients.length === 0 ? form.service_destinataire_id || undefined : undefined,

      recipients:
        form.mode_diffusion === 'broadcast'
          ? []
          : form.recipients.map((recipient) => ({
              recipient_type: recipient.recipient_type,
              structure_id: recipient.structure_id || null,
              service_id: recipient.service_id || null,
              user_id: recipient.user_id || null,
            })),

      instructions: form.instructions.map((item) => ({
        instruction_id: item.instruction_id || null,
        commentaire: item.commentaire || '',
        validation_requise: item.validation_requise ? 1 : 0,
      })),

      commentaire: form.commentaire || undefined,
    }

    try {
      if (onSubmit) {
        await onSubmit(payload)
      } else {
        await courrierApi.transmit(courrier.id, payload)
      }
    } catch (err) {
      const msg = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat()[0]
        : err.response?.data?.message || 'Erreur lors de la transmission.'

      setError(msg)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  if (loading) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Transmettre le courrier
            </h2>
            <p className="text-xs text-slate-500">
              #{courrier.numero} — {courrier.objet}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Mode de diffusion
                </label>

                <div className="flex flex-wrap gap-2">
                  {['unicast', 'multicast', 'broadcast'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          mode_diffusion: mode,
                        }))
                      }
                      className={`rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        form.mode_diffusion === mode
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {form.mode_diffusion !== 'broadcast' ? (
                <div className="space-y-3">
                  {form.recipients.map((recipient, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3"
                    >
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={recipient.recipient_type}
                          onChange={(e) =>
                            updateRecipient(
                              index,
                              'recipient_type',
                              e.target.value
                            )
                          }
                          className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        >
                          <option value="structure">Structure</option>
                          <option value="service">Service</option>
                          <option value="user">Utilisateur</option>
                        </select>

                        <select
                          value={recipient.structure_id}
                          onChange={(e) =>
                            updateRecipient(
                              index,
                              'structure_id',
                              e.target.value
                            )
                          }
                          className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        >
                          <option value="">Structure...</option>
                          {allowedStructures.map((structure) => (
                            <option key={structure.id} value={structure.id}>
                              {structure.libelle}
                            </option>
                          ))}
                        </select>
                      </div>

                      {recipient.recipient_type !== 'structure' && (
                        <select
                          value={recipient.service_id}
                          onChange={(e) =>
                            updateRecipient(
                              index,
                              'service_id',
                              e.target.value
                            )
                          }
                          className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        >
                          <option value="">Service...</option>
                          {allowedServices
                            .filter(
                              (service) =>
                                !recipient.structure_id ||
                                service.structure_id == recipient.structure_id
                            )
                            .map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.libelle}
                              </option>
                            ))}
                        </select>
                      )}

                      {recipient.recipient_type === 'user' && (
                        <select
                          value={recipient.user_id}
                          onChange={(e) =>
                            updateRecipient(index, 'user_id', e.target.value)
                          }
                          className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        >
                          <option value="">Utilisateur...</option>
                          {allowedUtilisateurs
                            .filter(
                              (u) =>
                                !recipient.service_id ||
                                u.service_id == recipient.service_id
                            )
                            .map((userOption) => (
                              <option
                                key={userOption.id}
                                value={userOption.id}
                              >
                                {userOption.nom_complet ||
                                  `${userOption.prenom} ${userOption.nom}`}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addRecipient}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
                  >
                    + Ajouter un destinataire
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 flex items-center gap-3">
                  <Users size={18} />
                  <p className="text-xs font-medium">
                    Mode broadcast : le courrier sera visible par tous les
                    services.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Commentaire
                </label>

                <textarea
                  value={form.commentaire}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      commentaire: e.target.value,
                    }))
                  }
                  className="w-full min-h-[88px] p-3 border border-slate-200 rounded-lg text-sm outline-none"
                  placeholder="Ajouter une note ou contexte avant l'envoi..."
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Instructions / Commentaires
                    </p>
                    <p className="text-xs text-slate-500">
                      Vous pouvez ajouter une ou plusieurs directives pour le
                      prochain destinataire.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addInstruction}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    + Ajouter
                  </button>
                </div>

                <div className="space-y-3">
                  {form.instructions.map((instruction, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          Directive {index + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeInstruction(index)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <select
                        value={instruction.instruction_id}
                        onChange={(e) =>
                          updateInstruction(
                            index,
                            'instruction_id',
                            e.target.value
                          )
                        }
                        className="w-full h-9 px-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                      >
                        <option value="">
                          Choisissez un type d'instruction...
                        </option>
                        {meta.instructions.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.libelle}
                          </option>
                        ))}
                      </select>

                      <textarea
                        value={instruction.commentaire}
                        onChange={(e) =>
                          updateInstruction(
                            index,
                            'commentaire',
                            e.target.value
                          )
                        }
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white outline-none"
                        placeholder="Détails ou commentaire..."
                      />

                      <label className="flex items-center gap-2 text-[10px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={instruction.validation_requise}
                          onChange={(e) =>
                            updateInstruction(
                              index,
                              'validation_requise',
                              e.target.checked
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Validation requise
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all uppercase tracking-wider"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-8 h-10 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-lg shadow-slate-900/10 hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <Clock className="animate-spin" size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {submitting ? 'Envoi...' : 'Transmettre'}
          </button>
        </div>
      </div>
    </div>
  )
}
