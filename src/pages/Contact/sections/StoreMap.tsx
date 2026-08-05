import { MapPin, Navigation } from 'lucide-react';

import { Reveal } from '@/components/common/Reveal';
import { COMPANY, COMPANY_ADDRESS_LINES } from '@/constants/company';

/**
 * Store location card.
 *
 * A drawn placeholder rather than an embedded map: a real map means a
 * third-party script, an API key and a set of cookies on a page that otherwise
 * loads nothing external, and none of that belongs in a UI pass. The grid of
 * faint lines reads as a street plan at a glance and costs one gradient.
 */
export const StoreMap = () => (
  <section aria-labelledby="store-location" className="flex flex-col gap-6">
    <Reveal className="flex flex-col gap-2 text-center">
      <h2 id="store-location" className="text-h4 text-heading md:text-h2">
        Store Location
      </h2>

      <p className="mx-auto max-w-xl text-base text-secondary md:text-lg">
        Our registered office, where every order is packed and dispatched.
      </p>
    </Reveal>

    <Reveal delay={1}>
      <div className="relative isolate overflow-hidden rounded-card border border-border shadow-card">
        {/* Decorative street plan. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-br from-primary-light via-section to-surface"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(0deg,var(--color-border)_0_1px,transparent_1px_56px),repeating-linear-gradient(90deg,var(--color-border)_0_1px,transparent_1px_56px)] opacity-60"
        />

        <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-14 text-center md:min-h-96">
          <span className="flex size-16 items-center justify-center rounded-pill bg-background text-primary shadow-card-hover">
            <MapPin className="size-7" aria-hidden="true" />
          </span>

          <div className="rounded-card border border-border bg-background/80 px-6 py-5 shadow-card backdrop-blur-sm">
            <p className="text-base font-semibold text-heading">{COMPANY.legalName}</p>

            <address className="mt-2 text-base text-body not-italic">
              {COMPANY_ADDRESS_LINES.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>

            <p className="mt-3 flex items-center justify-center gap-2 text-small text-secondary">
              <Navigation className="size-4 shrink-0" aria-hidden="true" />
              Visits by prior appointment
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  </section>
);
