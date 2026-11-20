import { compareISODate, type DocumentType } from '@readyfile/core';
import type { DocumentMeta } from './types.ts';

/**
 * Document selection (PRD §10.2, BRD BR-03).
 *
 * The latest issue date governs; an older *valid* document does not rescue an
 * item whose newest evidence is invalid. Ordering is total — issue date, then
 * upload time, then version, then id — so the result never depends on the order
 * rows arrive in (TC-02, TRD §15.1 "Version tie-break").
 */
export function selectEvaluatedDocument(
  documents: readonly DocumentMeta[],
  documentType: DocumentType,
): DocumentMeta | null {
  let best: DocumentMeta | null = null;
  for (const candidate of documents) {
    if (candidate.documentType !== documentType) continue;
    if (best === null || isPreferred(candidate, best)) best = candidate;
  }
  return best;
}

function isPreferred(candidate: DocumentMeta, current: DocumentMeta): boolean {
  if (candidate.issueDate !== null && current.issueDate !== null) {
    const difference = compareISODate(candidate.issueDate, current.issueDate);
    if (difference !== 0) return difference > 0;
  } else if (candidate.issueDate !== current.issueDate) {
    // An undated document can never outrank a dated one.
    return candidate.issueDate !== null;
  }

  if (candidate.uploadedAt !== current.uploadedAt) {
    return candidate.uploadedAt > current.uploadedAt;
  }
  if (candidate.version !== current.version) {
    return candidate.version > current.version;
  }
  return candidate.id > current.id;
}
