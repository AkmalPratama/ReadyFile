/**
 * Document type registry.
 *
 * A closed enum on purpose: TRD §8 requires that a rule draft referencing an
 * unknown document type be rejected at save time (PC-25) rather than silently
 * producing an unevaluable rule.
 *
 * Labels drive the reason_text and fix-pack wording (PRD §7.2), so they are
 * written for a borrower, not an engineer.
 */
export const DocumentType = {
    GOVERNMENT_ID: 'government_id',
    ADDRESS_PROOF: 'address_proof',
    PAYSLIPS: 'payslips',
    BANK_STATEMENT: 'bank_statement',
    TAX_RETURN: 'tax_return',
    BUSINESS_REGISTRATION: 'business_registration',
    EMPLOYMENT_VERIFICATION_LETTER: 'employment_verification_letter',
    PROPERTY_VALUATION_REPORT: 'property_valuation_report',
    CREDIT_BUREAU_REPORT: 'credit_bureau_report',
    INSURANCE_CERTIFICATE: 'insurance_certificate',
};
export const DOCUMENT_TYPES = Object.values(DocumentType);
export const DOCUMENT_LABELS = {
    government_id: 'government photo ID',
    address_proof: 'address proof',
    payslips: 'payslips',
    bank_statement: 'bank statement',
    tax_return: 'tax returns',
    business_registration: 'business registration',
    employment_verification_letter: 'employment verification letter',
    property_valuation_report: 'property valuation report',
    credit_bureau_report: 'credit bureau report',
    insurance_certificate: 'insurance certificate',
};
/** Singular noun used mid-sentence in borrower-facing guidance. */
export const DOCUMENT_REQUEST_LABELS = {
    government_id: 'a government photo ID',
    address_proof: 'an address proof',
    payslips: 'your payslips',
    bank_statement: 'a bank statement',
    tax_return: 'your tax returns',
    business_registration: 'your business registration',
    employment_verification_letter: 'an employment verification letter',
    property_valuation_report: 'a property valuation report',
    credit_bureau_report: 'a credit bureau report',
    insurance_certificate: 'an insurance certificate',
};
