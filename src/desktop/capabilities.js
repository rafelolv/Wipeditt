// Maintainer-confirmed native edit/delete evidence and release review: docs/DELETION-VALIDATION.md.
export const DELETION_VALIDATED = true;
export function deletionCapability({ packaged, developmentFlag }) {
  return DELETION_VALIDATED || (!packaged && developmentFlag === '1');
}
