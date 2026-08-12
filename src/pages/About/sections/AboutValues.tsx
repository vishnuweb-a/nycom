import { MessageSquare, Ruler, Tag, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Reveal } from '@/components/common/Reveal';
import type { RevealDelay } from '@/components/common/Reveal';

interface Value {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly delay: RevealDelay;
}

/**
 * How the store is run, rather than a restatement of the delivery and returns
 * promises the trust badges below already carry.
 */
const VALUES: readonly Value[] = [
  {
    icon: Users,
    title: 'One store for the family',
    description:
      "Men's, women's and children's wear sit side by side, so a school uniform and a wedding saree can travel in the same order.",
    delay: 1,
  },
  {
    icon: Ruler,
    title: 'Described, not oversold',
    description:
      'Fabric, fit and available sizes are stated on every product page. We would rather lose a sale than have a piece arrive as a surprise.',
    delay: 2,
  },
  {
    icon: Tag,
    title: 'Plain pricing',
    description:
      'The price on the card is the price at checkout — inclusive of all taxes, with any shipping charge shown before you confirm.',
    delay: 3,
  },
  {
    icon: MessageSquare,
    title: 'Reachable',
    description:
      'Questions about sizing, an order or a return reach a real inbox, and we reply to every message we receive.',
    delay: 4,
  },
];

export const AboutValues = () => (
  <section aria-labelledby="about-values" className="flex flex-col gap-6">
    <Reveal className="flex flex-col gap-2 text-center">
      <h2 id="about-values" className="text-h4 text-heading md:text-h2">
        What we stand for
      </h2>

      <p className="mx-auto max-w-xl text-base text-secondary md:text-lg">
        Four things we hold to, whatever else changes about the catalogue.
      </p>
    </Reveal>

    <ul className="grid gap-4 xs:grid-cols-2 md:gap-6">
      {VALUES.map((value) => {
        const Icon = value.icon;

        return (
          <li key={value.title}>
            <Reveal delay={value.delay} className="h-full">
              <article className="flex h-full flex-col gap-3 rounded-card border border-border bg-background p-5 shadow-card transition hover:-translate-y-0.5 hover:border-border-hover hover:shadow-card-hover">
                <span className="flex size-10 items-center justify-center rounded-pill bg-primary-light text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>

                <h3 className="text-h5 text-heading">{value.title}</h3>

                <p className="text-base text-body">{value.description}</p>
              </article>
            </Reveal>
          </li>
        );
      })}
    </ul>
  </section>
);
