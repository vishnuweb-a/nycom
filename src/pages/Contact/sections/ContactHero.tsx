import { MessageSquare } from 'lucide-react';

import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { Reveal } from '@/components/common/Reveal';
import { ROUTES } from '@/constants/routes';

/**
 * Opening band of the Contact page.
 *
 * The gradient runs from the brand tint into the page background so the header
 * dissolves into the content rather than ending on a hard edge. Everything in
 * it is centred: there is no second column here, and a left-aligned lede under
 * a centred title reads as a mistake.
 */
export const ContactHero = () => (
  <header className="bg-linear-to-b from-primary-light via-section to-background">
    <Container className="py-8 md:py-14">
      <Breadcrumb items={[{ label: 'Contact Us', path: ROUTES.CONTACT }]} />

      <Reveal className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4 text-center md:mt-12">
        <span className="flex size-14 items-center justify-center rounded-pill bg-background text-primary shadow-card">
          <MessageSquare className="size-6" aria-hidden="true" />
        </span>

        <h1 className="text-h2 md:text-h1">Get in Touch</h1>

        <p className="text-base text-body md:text-lg">
          We&rsquo;re here to help. Whether you have a question about your order, products, or
          anything else, our team is ready to assist.
        </p>
      </Reveal>
    </Container>
  </header>
);
