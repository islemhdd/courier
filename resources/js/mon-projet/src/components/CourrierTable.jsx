import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Paperclip, 
  MessageSquare,
  ShieldAlert,
  ChevronRight
} from 'lucide-react'
import { formatDate, getStatusTone, getStatusLabel } from '../lib/courrier'

export default function CourrierTable({ 
  courriers, 
  loading, 
  selectedCourrier, 
  onSelect 
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chargement...</p>
      </div>
    )
  }

  if (courriers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
        <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
          <ShieldAlert size={24} className="text-slate-200" />
        </div>
        <h4 className="text-sm font-bold text-slate-900">Aucun résultat</h4>
        <p className="text-xs text-slate-400 mt-1">Aucun courrier trouvé.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Référence</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Objet</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Expéditeur</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {courriers.map((courrier) => {
            const isSelected = selectedCourrier?.id === courrier.id
            const hasAttachments = courrier.attachments?.length > 0
            const hasComments = courrier.comments?.length > 0
            const needsResponse = courrier.requiert_reponse
            const isAnswered = courrier.a_ete_repondu
            const isOverdue = courrier.est_en_retard

            return (
              <tr 
                key={courrier.id}
                onClick={() => onSelect(courrier)}
                className={`group cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50 bg-white'}`}
              >
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                      {courrier.numero}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hasAttachments && <Paperclip size={12} className="text-slate-400" />}
                      {hasComments && <MessageSquare size={12} className="text-slate-400" />}
                    </div>
                  </div>
                </td>
                
                <td className="px-4 py-4">
                  <div className="max-w-[150px] sm:max-w-xs">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {courrier.objet}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {courrier.resume || 'Aucun résumé'}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-4 hidden md:table-cell">
                  <p className="text-xs font-medium text-slate-600 truncate max-w-[120px]">
                    {courrier.expediteur || courrier.source?.libelle || '-'}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider w-fit ${getStatusTone(courrier.statut, 'badge')}`}>
                      {getStatusLabel(courrier.statut)}
                    </span>
                    {needsResponse && (
                      <div className={`flex items-center gap-1 text-[9px] font-bold uppercase ${
                        isAnswered ? 'text-emerald-600' : isOverdue ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {isAnswered ? <CheckCircle2 size={10} /> : isOverdue ? <AlertCircle size={10} /> : <Clock size={10} />}
                        {isAnswered ? 'Répondu' : isOverdue ? 'Retard' : 'Attente'}
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-xs font-medium text-slate-500">
                      {formatDate(courrier.date_reception)}
                    </p>
                    <ChevronRight size={14} className={`text-slate-300 ${isSelected ? 'text-blue-500' : ''}`} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}