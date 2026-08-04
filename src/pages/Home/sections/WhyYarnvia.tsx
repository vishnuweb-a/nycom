import { RotateCcw, ShieldCheck, Sparkles, Truck } from 'lucide-react';

import { Section } from '@/components/common/Section';

/** prd.md §7 Section 6. Static brand promises — no data dependency. */
const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Secure payment',
    description: 'Every transaction is encrypted end to end, with UPI, cards and COD supported.',
  },
  {
    icon: Truck,
    title: 'Fast delivery',
    description: 'Dispatched within 24 hours, with express and next-day options at checkout.',
  },
  {
    icon: RotateCcw,
    title: 'Easy returns',
    description: 'Changed your mind? Return any unworn piece within 7 days, no questions asked.',
  },
  {
    icon: Sparkles,
    title: 'Premium quality',
    description: 'Handpicked fabrics and weaves, checked piece by piece before they reach you.',
  },
] as const;

export const WhyYarnvia = () => (
  <Section
    muted
    title="Why shop with us"
    description="The details we handle so you can focus on the drape."
  >
    <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:gap-6 lg:grid-cols-4">
      {BENEFITS.map((benefit) => {
        const Icon = benefit.icon;

        return (
          <li
            key={benefit.title}
            className="flex flex-col items-start gap-3 rounded-card bg-white p-6 shadow-card"
          >
            <span className="flex size-12 items-center justify-center rounded-pill bg-primary-light text-primary">
              <Icon className="size-6" aria-hidden="true" />
            </span>

            <h3 className="text-h5 text-heading">{benefit.title}</h3>
            <p className="text-base text-secondary">{benefit.description}</p>
          </li>
        );
      })}
    </ul>
  </Section>
);
