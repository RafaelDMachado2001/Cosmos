/**
 * O slug automático do RDM Studio, a partir do título em português.
 *
 * Mesma regra que o servidor exige (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, ver
 * `PublicationAdminController::SLUG_REGEX`): minúsculas, números e hífens,
 * sem acento. `normalize('NFD')` separa a letra do acento; descartar a
 * marca (`\p{Diacritic}`) é o que sobra só a letra.
 *
 * Módulo puro: sem DOM, sem React, sem Three.
 */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
