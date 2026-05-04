export const COURRIER_STATUS = {
  CREE: 'Crée',
  NON_VALIDE: 'Attente Validation',
  VALIDE: 'Validé',
  TRANSMIS: 'Transmis',
  RECU: 'Reçu',
  ARCHIVE: 'Archivé',
}

export function normalizeStatus(statut) {
  return String(statut || '').trim().toUpperCase()
}

export function getStatusLabel(statut) {
  const normalized = normalizeStatus(statut)
  return COURRIER_STATUS[normalized] || normalized || '-'
}

export function getStatusTone(statut, type = 'text') {
  const normalized = normalizeStatus(statut)
  
  const colors = {
    CREE: { text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    NON_VALIDE: { text: 'text-red-600', badge: 'bg-red-100 text-red-700 border-red-200' },
    VALIDE: { text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    TRANSMIS: { text: 'text-sky-600', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
    RECU: { text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    ARCHIVE: { text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  }

  const color = colors[normalized] || colors.ARCHIVE
  return type === 'badge' ? `border ${color.badge}` : color.text
}

export function getConfidentialityLabel(courrier) {
  return (
    courrier?.niveau_confidentialite?.libelle ||
    courrier?.niveauConfidentialite?.libelle ||
    '-'
  )
}

export function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR')
}
