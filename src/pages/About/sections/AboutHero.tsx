import { Shirt } from 'lucide-react';

import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { Reveal } from '@/components/common/Reveal';
import { APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';

/**
 * Opening band of the About page.
 *
 * Deliberately the same shape as the Contact hero — the gradient from the brand
 * tint into the page background, a centred icon plate, title and lede — so the
 * two informational pages read as a pair rather than as separate microsites.
 */
export const AboutHero = () => (
  <header className="bg-linear-to-b from-primary-light via-section to-background">
    <Container className="py-8 md:py-14">
      <Breadcrumb items={[{ label: 'About Us', path: ROUTES.ABOUT }]} />

      <Reveal className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4 text-center md:mt-12">
        <span className="flex size-14 items-center justify-center rounded-pill bg-background text-primary shadow-card">
          <Shirt className="size-6" aria-hidden="true" />
        </span>

        <p className="text-caption font-semibold tracking-wide text-primary uppercase">
          {APP.tagline}
        </p>

        <h1 className="text-h2 md:text-h1">About {APP.name}</h1>

        <p className="text-base text-body md:text-lg">
          An online clothing store for men, women and children &mdash; built so that finding
          something worth wearing takes minutes rather than an entire evening.
        </p>
      </Reveal>
    </Container>
  </header>
);
