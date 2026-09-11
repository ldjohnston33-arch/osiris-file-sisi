/**
 * sis.gov.eg has served its leaf certificate without the intermediate, which
 * browsers paper over (AIA fetching) but Node rejects. If the ingest health
 * page shows "unable to verify the first certificate" for SIS, paste the
 * issuing intermediate's PEM here. Empty means use Node's default trust only.
 */
export const SIS_EXTRA_CA: string[] = [];
