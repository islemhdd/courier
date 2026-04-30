export default function Pagination({
  pagination,
  onPageChange,
  loading = false,
}) {
  if (!pagination || (pagination.last_page || 1) <= 1) {
    return null
  }

  const currentPage = pagination.current_page || 1
  const lastPage = pagination.last_page || 1

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Page {currentPage} sur {lastPage}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Précédent
        </button>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= lastPage}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Suivant
        </button>
      </div>
    </div>
  )
}
