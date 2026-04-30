export const COURRIER_STATUS = {
  CREE: 'Cree',
  NON_VALIDE: 'Non valide',
  VALIDE: 'Valide',
  TRANSMIS: 'Transmis',
  RECU: 'Recu',
  ARCHIVE: 'Archive',
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

export function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('fr-FR')
}
