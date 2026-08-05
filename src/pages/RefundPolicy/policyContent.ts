import { COMPANY } from '@/constants/company';
import type { EffectiveDate, LegalContact, PolicySection } from '@/types/legal';

/**
 * Refund & Cancellation Policy — the legal copy itself.
 *
 * Authored as data, with the inline markers documented in `types/legal.ts`.
 */

export const REFUND_EFFECTIVE_DATE: EffectiveDate = {
  label: 'August 5, 2026',
  iso: '2026-08-05',
};

export const REFUND_INTRO: readonly string[] = [
  `At **${COMPANY.legalName}**, customer satisfaction is important to us. Please read our Refund and Cancellation Policy carefully before placing an order.`,
];

export const REFUND_SECTIONS: readonly PolicySection[] = [
  {
    id: 'order-cancellation',
    title: 'Order Cancellation',
    blocks: [
      { kind: 'paragraph', text: 'Orders may be cancelled before they are shipped.' },
      {
        kind: 'paragraph',
        text: 'Once an order has been dispatched, it cannot be cancelled. However, customers may request a return if eligible under this policy.',
      },
    ],
  },
  {
    id: 'return-eligibility',
    title: 'Return Eligibility',
    blocks: [
      { kind: 'paragraph', text: 'Products may be returned if:' },
      {
        kind: 'list',
        items: [
          'The item received is damaged.',
          'The wrong product has been delivered.',
          'The product has a manufacturing defect.',
          'The item is unused, unwashed, and in its original condition with tags and packaging intact.',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Return requests should be submitted within **7 days** of receiving the order.',
      },
    ],
  },
  {
    id: 'non-returnable-items',
    title: 'Non-Returnable Items',
    blocks: [
      { kind: 'paragraph', text: 'The following items cannot be returned:' },
      {
        kind: 'list',
        items: [
          'Used or washed products',
          'Products without original tags',
          'Products damaged due to customer misuse',
          'Innerwear, intimate apparel, or hygiene-sensitive products (if applicable)',
          'Customized or personalized products',
        ],
      },
    ],
  },
  {
    id: 'refund-process',
    title: 'Refund Process',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Once the returned item is received and inspected, the refund will be processed if approved.',
      },
      {
        kind: 'paragraph',
        text: 'Refunds are generally credited within **5–10 business days** to the original payment method.',
      },
    ],
  },
  {
    id: 'shipping-charges',
    title: 'Shipping Charges',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Original shipping charges are generally non-refundable unless the return is due to our error, such as receiving a wrong, damaged, or defective product.',
      },
    ],
  },
  {
    id: 'exchange',
    title: 'Exchange',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Eligible products may be exchanged subject to stock availability.',
      },
    ],
  },
  {
    id: 'damaged-or-incorrect-products',
    title: 'Damaged or Incorrect Products',
    blocks: [
      {
        kind: 'paragraph',
        text: 'If you receive a damaged, defective, or incorrect product, please contact us within **48 hours** of delivery with photographs of the product and packaging.',
      },
    ],
  },
];

export const REFUND_CONTACT: LegalContact = {
  id: 'contact-us',
  title: 'Contact Us',
  intro: 'For any cancellation, return, exchange, or refund queries, contact:',
};
