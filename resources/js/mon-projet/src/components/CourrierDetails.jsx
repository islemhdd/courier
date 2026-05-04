import { useState } from 'react'
import { 
  FileText, 
  Archive, 
  Trash2, 
  Download, 
  MessageSquare, 
  User, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Share2,
  Calendar,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  Link2,
  Lock,
  Building,
  Building2
} from 'lucide-react'
import { formatDate, getStatusTone, getStatusLabel, getConfidentialityLabel } from '../lib/courrier'

export default function CourrierDetails({
  courrier,
  actionLoading,
  onArchive,
  onDelete,
  onTransmit,
  onValidate,
  onReject,
  onReply
}) {
  const [showChain, setShowChain] = useState(true)

  if (!courrier) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText size={24} className="text-slate-300" />
        </div>
        <p className="text-sm font-medium text-slate-500">Sélectionnez un courrier pour voir les détails.</p>
      </div>
    )
  }

  const isRestricted = courrier.contenu_restreint
  const hasDeadline = courrier.requiert_reponse
  const isOverdue = courrier.est_en_retard
  const isAnswered = courrier.a_ete_repondu

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/30">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusTone(courrier.statut, 'badge')}`}>
            {getStatusLabel(courrier.statut)}
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded uppercase">
            {courrier.type}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-950 truncate">{courrier.numero}</h2>
        <p className="text-sm font-medium text-slate-600 mt-1 line-clamp-2">{courrier.objet}</p>
        
        <div className="mt-4 flex flex-wrap gap-2">
          {hasDeadline && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-bold ${isAnswered ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : isOverdue ? 'bg-red-50 border-red-100 text-red-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              {isAnswered ? <CheckCircle2 size={12} /> : isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
              {isAnswered ? 'Répondu' : isOverdue ? 'En retard' : `Attendu sous ${courrier.delai_reponse_jours}j`}
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
            <Lock size={12} />
            {getConfidentialityLabel(courrier)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        
        {/* Actions */}
        <div className="grid grid-cols-1 gap-2">
          {courrier.peut_etre_valide && (
            <button 
              onClick={() => onValidate(courrier.id)}
              className="w-full h-10 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={14} />
              Valider
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {courrier.peut_etre_non_valide && (
              <button 
                onClick={() => onReject(courrier.id)}
                className="h-10 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Rejeter
              </button>
            )}
            {courrier.peut_etre_transmis && (
              <button 
                onClick={() => onTransmit(courrier.id)}
                className="h-10 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                Transmettre
              </button>
            )}
            {courrier.peut_repondre && (
              <button 
                onClick={() => onReply(courrier)}
                className="h-10 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <CornerDownRight size={14} />
                Répondre
              </button>
            )}
          </div>
        </div>

        {/* Info */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
             <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Résumé</p>
               <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                 {isRestricted ? "Contenu restreint (Confidentialité)." : (courrier.resume || "Aucun résumé.")}
               </p>
             </div>
             
             <div className="flex items-center gap-4 text-xs">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expéditeur</p>
                  <p className="font-bold text-slate-800 mt-1 truncate">{courrier.expediteur || "-"}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="font-bold text-slate-800 mt-1">{formatDate(courrier.date_reception)}</p>
                </div>
             </div>
          </div>

          {courrier.recipients?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destinataires</p>
              <div className="flex flex-wrap gap-1.5">
                {courrier.recipients.map((r, i) => (
                  <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-600 flex items-center gap-1">
                    {r.recipient_type === 'structure' ? <Building2 size={10} /> : <User size={10} />}
                    {r.structure?.libelle || r.user?.nom_complet || "Tous"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Attachments */}
        {!isRestricted && courrier.attachments?.length > 0 && (
          <section className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documents ({courrier.attachments.length})</p>
            <div className="grid gap-2">
              {courrier.attachments.map((file, i) => (
                <a 
                  key={i}
                  href={'/storage/' + file.chemin} 
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-slate-400 group-hover:text-blue-500" />
                    <span className="text-xs font-medium text-slate-600 truncate">{file.nom_original}</span>
                  </div>
                  <Download size={14} className="text-slate-300 group-hover:text-slate-600" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Chain */}
        <section className="space-y-2">
          <button onClick={() => setShowChain(!showChain)} className="flex items-center justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Chaîne de réponses
            {showChain ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showChain && (
            <div className="pl-3 border-l border-slate-200 space-y-3 mt-2">
              {courrier.parent && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Link2 size={12} />
                  <span className="truncate">Réponse à {courrier.parent.numero}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                <CheckCircle2 size={12} />
                <span>Actuel: {courrier.numero}</span>
              </div>
              {courrier.reponses?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                  <CornerDownRight size={12} className="text-slate-300" />
                  <span className="truncate">{r.numero}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Comments */}
        {courrier.comments?.length > 0 && (
          <section className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instructions</p>
            <div className="space-y-3">
              {courrier.comments.map((c, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900">{c.user?.nom_complet}</span>
                    <span className="text-[9px] text-slate-400">{formatDate(c.created_at)}</span>
                  </div>
                  <p className="text-slate-600 italic">"{c.commentaire}"</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/30 grid grid-cols-2 gap-2">
        {courrier.peut_etre_archive && (
          <button onClick={onArchive} className="h-10 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center justify-center gap-2">
            <Archive size={14} /> Archiver
          </button>
        )}
        {courrier.peut_etre_supprime && (
          <button onClick={onDelete} className="h-10 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 flex items-center justify-center gap-2">
            <Trash2 size={14} /> Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
