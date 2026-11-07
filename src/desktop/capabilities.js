// Promote this only after the manual validation record is completed and reviewed.
export const DELETION_VALIDATED = false;
export function deletionCapability({ packaged, developmentFlag }) {
  return DELETION_VALIDATED || (!packaged && developmentFlag === '1');
}
