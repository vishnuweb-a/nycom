import { Building2, LayoutGrid, MapPin, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Reveal } from '@/components/common/Reveal';
import { APP } from '@/constants/app';
import { CATEGORIES } from '@/constants/categories';
import { COMPANY } from '@/constants/company';
import { DELIVERY_DAYS, FREE_SHIPPING_THRESHOLD } from '@/constants/commerce';
import { formatPrice } from '@/utils/format';

interface Fact {
  readonly icon: LucideIcon;
  readonly term: string;
  readonly detail: string;
}

/**
 * The "at a glance" panel reads from the same constants the storefront runs on
 * — the registered entity, the category table and the commercial policy — so
 * this page can never quote a delivery window or a threshold the checkout has
 * since moved away from.
 */
const FACTS: readonly Fact[] = [
  { icon: Building2, term: 'Registered name', detail: COMPANY.legalName },
  {
    icon: MapPin,
    term: 'Based in',
    detail: `${COMPANY.address.district}, ${COMPANY.address.state}, ${COMPANY.address.country}`,
  },
  {
    icon: LayoutGrid,
    term: 'We stock',
    detail: CATEGORIES.map((category) => category.name).join(' · '),
  },
  {
    icon: Truck,
    term: 'Delivery',
    detail: `${String(DELIVERY_DAYS.min)}–${String(DELIVERY_DAYS.max)} working days · free over ${formatPrice(FREE_SHIPPING_THRESHOLD)}`,
  },
];

export const AboutStory = () => (
  <section
    aria-labelledby="about-story"
    className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)] lg:gap-12"
  >
    <Reveal className="flex flex-col gap-4">
      <h2 id="about-story" className="text-h4 text-heading md:text-h2">
        Who we are
      </h2>

      <p className="text-base text-body md:text-lg">
        {APP.name} is an online clothing store offering women&rsquo;s wear, men&rsquo;s wear and
        children&rsquo;s wear. The website is owned and operated by{' '}
        <strong className="font-semibold text-text">{COMPANY.legalName}</strong>, a company
        registered in Delhi and shipping across India.
      </p>

      <p className="text-base text-body md:text-lg">
        The catalogue is edited rather than endless. Every piece is listed with its fabric, fit and
        sizes spelled out and photographed as it actually looks, so choosing comes down to taste
        instead of guesswork. Prices include taxes, shipping is shown before you confirm, and Cash
        on Delivery means nothing leaves your account before the parcel reaches your door.
      </p>

      <div className="mt-2 rounded-card border border-border bg-surface p-5">
        <h3 className="text-caption font-semibold tracking-wide text-primary uppercase">
          Our mission
        </h3>

        <p className="mt-2 text-base text-text md:text-lg">
          To make good everyday clothing easy to find, easy to buy and easy to send back &mdash; for
          every member of the family.
        </p>
      </div>
    </Reveal>

    <Reveal delay={1}>
      <aside
        aria-labelledby="about-glance"
        className="rounded-card border border-border bg-background p-6 shadow-card"
      >
        <h3 id="about-glance" className="text-h5 text-heading">
          At a glance
        </h3>

        <dl className="mt-5 flex flex-col gap-5">
          {FACTS.map((fact) => {
            const Icon = fact.icon;

            return (
              <div key={fact.term} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary-light text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>

                <div className="min-w-0">
                  <dt className="text-caption text-secondary">{fact.term}</dt>
                  <dd className="text-base font-medium break-words text-text">{fact.detail}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </aside>
    </Reveal>
  </section>
);
