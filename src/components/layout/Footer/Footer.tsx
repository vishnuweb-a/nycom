import { Link } from 'react-router';

import { Container } from '@/components/common/Container';
import { Logo } from '@/components/common/Logo';
import { APP } from '@/constants/app';
import { FOOTER_NAV_GROUPS, SOCIAL_LINKS } from '@/constants/navigation';

/**
 * Global footer — design.md → Footer, prd.md §16.
 *
 * The newsletter column is added in Phase 4, when the Home page owns a submit
 * handler and Phase 10 supplies the service behind it. Policy pages (About,
 * Privacy, Terms, Refund, FAQs) are listed in prd.md §16 but have no routes
 * defined anywhere in the PRD, so they are not linked — a footer full of 404s
 * is worse than a shorter footer.
 */
export const Footer = () => (
  <footer className="mt-auto bg-footer text-light">
    <Container>
      <div className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4 lg:py-16">
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

        <p className="text-small text-muted">
          © {new Date().getFullYear()} {APP.name}. All rights reserved.
        </p>
      </div>
    </Container>
  </footer>
);
