import Badge from '../ui/Badge'

export default function CourrierTable({ courriers, loading, selectedCourrier, onSelect }) {
  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        Chargement des courriers...
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          Courriers récents
        </h2>

        <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500">
          Filtrer
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Objet</th>
              <th className="px-4 py-3">Expéditeur</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Confidentialité</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>

          <tbody>
            {courriers.map(courrier => {
              const active = selectedCourrier?.id === courrier.id

              return (
                <tr
                  key={courrier.id}
                  onClick={() => onSelect(courrier)}
                  className={`cursor-pointer border-t border-slate-100 transition ${
                    active
                      ? 'bg-blue-50 ring-1 ring-blue-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-4 font-medium text-slate-700">
                    {courrier.numero}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {courrier.objet}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {courrier.expediteur || '-'}
                  </td>

                  <td className="px-4 py-4 text-slate-500">
                    {courrier.date_reception || courrier.date_creation}
                  </td>

                  <td className="px-4 py-4">
                    <Badge variant="blue">
                      {courrier.niveau_confidentialite?.nom || 'Interne'}
                    </Badge>
                  </td>

                  <td className="px-4 py-4">
                    <Badge variant="green">
                      {courrier.statut}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {courriers.length === 0 && (
        <div className="py-8 text-center text-sm text-slate-400">
          Aucun courrier trouvé.
        </div>
      )}
    </div>
  )
}