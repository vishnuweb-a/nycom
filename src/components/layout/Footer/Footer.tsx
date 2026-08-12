import { Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router';

import { Container } from '@/components/common/Container';
import { Logo } from '@/components/common/Logo';
import { APP } from '@/constants/app';
import { COMPANY, COMPANY_ADDRESS_LINES } from '@/constants/company';
import { FOOTER_NAV_GROUPS, SOCIAL_LINKS } from '@/constants/navigation';

/**
 * Global footer — design.md → Footer, prd.md §16.
 *
 * Carries the registered business identity: the entity name, its contact
 * details and its registered office. An Indian ecommerce storefront is expected
 * to state who is actually selling, and the footer is the conventional place.
 *
 * The newsletter column is added in Phase 4, when the Home page owns a submit
 * handler and Phase 10 supplies the service behind it. The link columns carry
 * the prd.md §16 destinations that exist; the remaining one (FAQs) joins them
 * as it is built, since a footer full of 404s is worse than a shorter footer.
 */
export const Footer = () => (
  <footer className="mt-auto bg-footer text-light">
    <Container>
      {/* Seven tracks from Laptop up: brand, four nav groups, and a
          double-width contact column so the address and email do not wrap
          mid-word. The horizontal gap tightens with the extra column so the
          link columns keep a readable measure. */}
      <div className="grid gap-x-8 gap-y-10 py-12 md:grid-cols-2 lg:grid-cols-7 lg:py-16">
        <div className="flex flex-col gap-4">
          <Logo inverted />
          <p className="max-w-xs text-base text-light">{APP.tagline}</p>
        </div>

        {FOOTER_NAV_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title} className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-white">{group.title}</h2>

            <ul className="flex flex-col gap-3">
              {group.links.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="rounded-input text-base text-light transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <section aria-labelledby="footer-contact" className="flex flex-col gap-4 lg:col-span-2">
          <h2 id="footer-contact" className="text-base font-semibold text-white">
            Get in touch
          </h2>

          <ul className="flex flex-col gap-3">
            <li>
              <a
                href={`mailto:${COMPANY.email}`}
                className="inline-flex items-start gap-2 rounded-input text-base break-words text-light transition-colors hover:text-white"
              >
                <Mail className="mt-1 size-4 shrink-0" aria-hidden="true" />
                {COMPANY.email}
              </a>
            </li>

            <li>
              <a
                href={`tel:${COMPANY.phoneE164}`}
                className="inline-flex items-center gap-2 rounded-input text-base text-light transition-colors hover:text-white"
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {COMPANY.phone}
              </a>
            </li>

            <li className="flex items-start gap-2 text-base text-light">
              <MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" />

              <address className="not-italic">
                <span className="mb-1 block font-medium text-white">{COMPANY.legalName}</span>

                {COMPANY_ADDRESS_LINES.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
          </ul>
        </section>
      </div>

      <div className="flex flex-col items-center gap-6 border-t border-white/10 py-8 md:flex-row md:justify-between">
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {SOCIAL_LINKS.map((social) => (
            <li key={social.href}>
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-tap items-center rounded-input px-3 text-base text-light transition-colors hover:text-white"
              >
                {social.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="text-center text-small text-muted md:text-right">
          © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
        </p>
      </div>
    </Container>
  </footer>
);
