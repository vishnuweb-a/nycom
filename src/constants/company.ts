/**
 * Registered business identity.
 *
 * The single source of truth for the legal entity behind the Yarnvia
 * storefront. Every surface that must show who is actually selling — the
 * footer today, invoices, order confirmations, legal pages and structured data
 * later — reads from here, so a change of registered address or contact number
 * is a one-file edit.
 *
 * Distinct from `APP` in `constants/app.ts`, which holds the *brand* the
 * shopper sees. "Yarnvia" is the storefront; the entity below is the company.
 */

export const COMPANY = {
  /** Full registered name. Use on legal and financial surfaces. */
  legalName: 'YARNVIA EXPORTS PRIVATE LIMITED',
  email: 'yarnviaexports5869@gmail.com',
  /** National format, as registered. */
  phone: '8796432623',
  /** E.164, for `tel:` links so the number dials correctly from abroad. */
  phoneE164: '+918796432623',

  /** Registered office, as filed. */
  address: {
    line1: 'H NO-9/149 Shyam Block',
    line2: 'Kailash Nagar',
    locality: 'Gandhi Nagar',
    district: 'East Delhi',
    state: 'Delhi',
    country: 'India',
    pincode: '110031',
  },
} as const;

/** Registered address as ordered lines, for rendering in an `<address>`. */
export const COMPANY_ADDRESS_LINES: readonly string[] = [
  COMPANY.address.line1,
  COMPANY.address.line2,
  COMPANY.address.locality,
  `${COMPANY.address.district}, ${COMPANY.address.state} ${COMPANY.address.pincode}`,
  COMPANY.address.country,
];

/** Single-line form, for meta tags and structured data. */
export const COMPANY_ADDRESS_INLINE = COMPANY_ADDRESS_LINES.join(', ');
