/**
 * Miroir applicatif du trigger DB `trg_block_unverified_email_sends`
 * (migration 015) : aucun email ne part vers une adresse non vérifiée.
 *
 * Règle (v2) :
 * - refus absolu si l'adresse est morte (`email-bounced`, `non-existent`)
 * - refus si l'adresse vient de l'automatisation (`auto-source`, `via-hunter`,
 *   `email-pattern`) sans preuve de validité (`email-verified`,
 *   `email-public-site`)
 *
 * Toute évolution ici doit rester alignée avec la fonction SQL
 * `block_unverified_email_sends()` — le trigger reste la garantie finale.
 */

const DEAD_TAGS = ['email-bounced', 'non-existent'];
const AUTOMATED_TAGS = ['auto-source', 'via-hunter', 'email-pattern'];
const TRUSTED_TAGS = ['email-verified', 'email-public-site'];

export function isJournalistSendable(tags: string[] | null | undefined): boolean {
  return sendBlockReason(tags) === null;
}

/** Retourne la raison du blocage, ou null si l'envoi est autorisé. */
export function sendBlockReason(tags: string[] | null | undefined): string | null {
  const t = tags ?? [];
  if (DEAD_TAGS.some((tag) => t.includes(tag))) {
    return 'Adresse en bounce ou inexistante — envoi bloqué.';
  }
  if (
    AUTOMATED_TAGS.some((tag) => t.includes(tag)) &&
    !TRUSTED_TAGS.some((tag) => t.includes(tag))
  ) {
    return 'Email trouvé automatiquement et non vérifié — envoi bloqué tant qu\'il n\'est pas validé.';
  }
  return null;
}
