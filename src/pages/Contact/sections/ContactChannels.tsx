import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandIcon } from '@/components/common/BrandIcon';
import { Reveal } from '@/components/common/Reveal';
import type { RevealDelay } from '@/components/common/Reveal';
import { SOCIAL_PROFILES, SUPPORT } from '@/constants/support';

interface ChannelCardProps {
  icon: LucideIcon;
  title: string;
  delay: RevealDelay;
  children: ReactNode;
}

/**
 * One contact channel. The lift on hover is the same gesture the product cards
 * use, so the page feels like the rest of the store rather than a microsite.
 */
const ChannelCard = ({ icon: Icon, title, delay, children }: ChannelCardProps) => (
  <Reveal delay={delay} className="h-full">
    <article className="flex h-full flex-col gap-3 rounded-card border border-border bg-background p-5 shadow-card transition hover:-translate-y-0.5 hover:border-border-hover hover:shadow-card-hover">
      <span className="flex size-10 items-center justify-center rounded-pill bg-primary-light text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>

      <h3 className="text-base font-semibold text-heading">{title}</h3>

      <div className="flex flex-col gap-1 text-base text-body">{children}</div>
    </article>
  </Reveal>
);

/**
 * Left column of the Contact page: how to reach the team, and where to find it.
 *
 * Two tracks from Mobile up so the four cards read as a block beside the form,
 * collapsing to a single column only on the narrowest phones.
 */
export const ContactChannels = () => (
  <section aria-labelledby="contact-channels" className="flex flex-col gap-4">
    <h2 id="contact-channels" className="text-h4 text-heading md:text-h3">
      Contact information
    </h2>

    <p className="text-base text-secondary">
      Reach us on whichever channel suits you — we reply to every message.
    </p>

    <div className="mt-2 grid gap-4 xs:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <ChannelCard icon={Mail} title="Customer Support" delay={1}>
        <a
          href={`mailto:${SUPPORT.email}`}
          className="rounded-input break-words transition-colors hover:text-primary"
        >
          {SUPPORT.email}
        </a>
      </ChannelCard>

      <ChannelCard icon={Phone} title="Phone" delay={2}>
        <a
          href={`tel:${SUPPORT.phoneE164}`}
          className="rounded-input transition-colors hover:text-primary"
        >
          {SUPPORT.phone}
        </a>
      </ChannelCard>

      <ChannelCard icon={MapPin} title="Office" delay={3}>
        <address className="not-italic">{SUPPORT.office}</address>
      </ChannelCard>

      <ChannelCard icon={Clock} title="Working Hours" delay={4}>
        <span>{SUPPORT.hours.days}</span>
        <span>{SUPPORT.hours.time}</span>
      </ChannelCard>
    </div>

    <Reveal delay={4} className="mt-2">
      <div className="rounded-card border border-border bg-surface p-5">
        <h3 className="text-base font-semibold text-heading">Follow us</h3>

        <ul className="mt-4 flex flex-wrap gap-3">
          {SOCIAL_PROFILES.map((profile) => (
            <li key={profile.brand}>
              <a
                href={profile.href}
                target="_blank"
                rel="noreferrer noopener"
                className="flex size-11 items-center justify-center rounded-pill border border-border bg-background text-secondary transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-white"
              >
                <BrandIcon name={profile.brand} className="size-5" />
                <span className="sr-only">{profile.label} (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  </section>
);
