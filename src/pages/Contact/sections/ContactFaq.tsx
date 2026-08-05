import { Link } from 'react-router';

import { Accordion } from '@/components/common/Accordion';
import type { AccordionItem } from '@/components/common/Accordion';
import { Reveal } from '@/components/common/Reveal';
import { ROUTES } from '@/constants/routes';

/**
 * The three questions the support inbox actually receives, answered inline so
 * shoppers can resolve them without writing in. Each answer points at the page
 * that owns the detail rather than restating policy that could drift.
 */
const FAQ_ITEMS: readonly AccordionItem[] = [
  {
    id: 'shipping-time',
    question: 'How long does shipping take?',
    answer: (
      <p>
        Orders are dispatched within 24&ndash;48 hours of being placed. Delivery usually takes
        2&ndash;4 business days in metro cities and 4&ndash;7 business days elsewhere in India.
        Timelines can shift with location, logistics and weather.
      </p>
    ),
  },
  {
    id: 'returns',
    question: 'Can I return my order?',
    answer: (
      <p>
        Yes. Unused, unwashed items with their tags and packaging intact can be returned within 7
        days of delivery. The full terms, including what cannot be returned, are in our{' '}
        <Link
          to={ROUTES.REFUND_POLICY}
          className="rounded-input font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover"
        >
          Refund &amp; Cancellation Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: 'tracking',
    question: 'How can I track my shipment?',
    answer: (
      <p>
        Every order gets a tracking update by email once it is dispatched. You can also see the
        current status of each order on the{' '}
        <Link
          to={ROUTES.ORDERS}
          className="rounded-input font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover"
        >
          My Orders
        </Link>{' '}
        page.
      </p>
    ),
  },
];

export const ContactFaq = () => (
  <section aria-labelledby="contact-faq" className="flex flex-col gap-6">
    <Reveal className="flex flex-col gap-2 text-center">
      <h2 id="contact-faq" className="text-h4 text-heading md:text-h2">
        Frequently Asked Questions
      </h2>

      <p className="mx-auto max-w-xl text-base text-secondary md:text-lg">
        Quick answers to the questions we hear most often.
      </p>
    </Reveal>

    <Reveal delay={1} className="mx-auto w-full max-w-3xl">
      <Accordion items={FAQ_ITEMS} />
    </Reveal>
  </section>
);
