import { Mail, MapPin, Phone } from 'lucide-react';

import { COMPANY, COMPANY_ADDRESS_LINES } from '@/constants/company';
import type { LegalContact } from '@/types/legal';

export interface LegalContactCardProps {
  contact: LegalContact;
  /** Clause number shown before the title, 1-based. */
  number: number;
}

/**
 * Closing clause of a policy: who to write to, and where the company sits.
 *
 * Reads the entity, address and contact details from `COMPANY` rather than
 * repeating them in each policy's copy, so the registered office is stated
 * identically here, on every legal page and in the footer.
 */
export const LegalContactCard = ({ contact, number }: LegalContactCardProps) => (
  <section
    id={contact.id}
    aria-labelledby={`${contact.id}-heading`}
    className="scroll-mt-28 rounded-card border border-border bg-section p-5 md:p-8"
  >
    <h2 id={`${contact.id}-heading`} className="text-h5 text-heading md:text-h4">
      <span className="mr-2 text-primary">{number}.</span>
      {contact.title}
    </h2>

    {contact.intro !== undefined && (
      <p className="mt-4 text-base text-body md:text-lg">{contact.intro}</p>
    )}

    <p className="mt-4 text-base font-semibold text-heading md:text-lg">{COMPANY.legalName}</p>

    <div className="mt-6 grid gap-6 md:grid-cols-3">
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Address
        </h3>

        <address className="text-base text-body not-italic">
          {COMPANY_ADDRESS_LINES.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
          <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Email
        </h3>

        <a
          href={`mailto:${COMPANY.email}`}
          className="rounded-input text-base break-words text-body transition-colors hover:text-primary"
        >
          {COMPANY.email}
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
          <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Phone
        </h3>

        <a
          href={`tel:${COMPANY.phoneE164}`}
          className="rounded-input text-base text-body transition-colors hover:text-primary"
        >
          {COMPANY.phone}
        </a>
      </div>
    </div>
  </section>
);
