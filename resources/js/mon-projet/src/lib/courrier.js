export const COURRIER_STATUS = {
  CREE: 'Cree',
  NON_VALIDE: 'Non valide',
  VALIDE: 'Valide',
  TRANSMIS: 'Transmis',
  RECU: 'Recu',
  ARCHIVE: 'Archive',
  ARCHIVED: 'Archive',
}

export function normalizeStatus(statut) {
  return String(statut || '').trim().toUpperCase()
}

export function getStatusLabel(statut) {
  const normalized = normalizeStatus(statut)
  return COURRIER_STATUS[normalized] || normalized || '-'
}

export function getStatusTone(statut) {
  const normalized = normalizeStatus(statut)

  switch (normalized) {
    case 'CREE':
      return 'amber'
    case 'NON_VALIDE':
      return 'red'
    case 'VALIDE':
      return 'emerald'
    case 'TRANSMIS':
      return 'sky'
    case 'RECU':
      return 'blue'
    case 'ARCHIVE':
    case 'ARCHIVED':
      return 'slate'
    default:
      return 'slate'
  }
}

export function getConfidentialityLabel(courrier) {
  return (
    courrier?.niveau_confidentialite?.libelle ||
    courrier?.niveau_confidentialite?.nom ||
    courrier?.niveauConfidentialite?.libelle ||
    courrier?.niveauConfidentialite?.nom ||
    '-'
  )
}

export function isRestrictedContent(courrier) {
  return (
    courrier?.contenu_restreint === true ||
    courrier?.peut_voir_details === false
  )
}

export function getConfidentialityTone(level) {
  const label = String(level?.libelle || level?.nom || level || '').toLowerCase()
  if (label.includes('secret')) return 'bg-red-50 text-red-700 border-red-200'
  if (label.includes('confidentiel')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export function getStatusBadgeClass(statut) {
  const tone = getStatusTone(statut)
  const map = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return map[tone] || map.slate
}

export function formatDate(date) {
  if (!date) return '-'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('fr-FR')
}
