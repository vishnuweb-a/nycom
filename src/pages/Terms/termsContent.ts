import { APP } from '@/constants/app';
import { COMPANY } from '@/constants/company';
import { ROUTES } from '@/constants/routes';
import type { EffectiveDate, LegalContact, PolicySection } from '@/types/legal';

/**
 * Terms and Conditions — the legal copy itself.
 *
 * Authored as data, with the inline markers documented in `types/legal.ts`.
 * Clause 8 links to the Refund & Cancellation Policy through `ROUTES`, so the
 * cross-reference cannot rot into a 404 if that path ever changes.
 */

export const TERMS_EFFECTIVE_DATE: EffectiveDate = {
  label: 'August 5, 2026',
  iso: '2026-08-05',
};

export const TERMS_INTRO: readonly string[] = [
  `Welcome to **${COMPANY.website}**. By accessing or using this website, you agree to comply with these Terms and Conditions.`,
];

export const TERMS_SECTIONS: readonly PolicySection[] = [
  {
    id: 'about-us',
    title: 'About Us',
    blocks: [
      {
        kind: 'paragraph',
        text: `This website is owned and operated by **${COMPANY.legalName}**.`,
      },
      {
        kind: 'paragraph',
        text: `${APP.name} offers online shopping for women's wear, men's wear, and children's wear.`,
      },
    ],
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    blocks: [
      {
        kind: 'paragraph',
        text: 'You must be at least 18 years of age or use the website under the supervision of a parent or legal guardian.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Products',
    blocks: [
      {
        kind: 'paragraph',
        text: 'We make every effort to display product images, descriptions, and colors accurately.',
      },
      {
        kind: 'paragraph',
        text: 'However, actual product colors may vary depending on your screen settings.',
      },
      { kind: 'paragraph', text: 'Product availability is subject to stock.' },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    blocks: [
      { kind: 'paragraph', text: 'All prices are displayed in Indian Rupees (INR).' },
      {
        kind: 'paragraph',
        text: 'We reserve the right to modify prices without prior notice.',
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    blocks: [
      { kind: 'paragraph', text: 'We reserve the right to:' },
      {
        kind: 'list',
        items: [
          'Accept or reject any order',
          'Cancel orders due to pricing errors',
          'Cancel orders due to stock unavailability',
          'Cancel suspicious or fraudulent transactions',
        ],
      },
      {
        kind: 'paragraph',
        text: 'If payment has already been received for a cancelled order, the applicable refund will be processed.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    blocks: [
      { kind: 'paragraph', text: 'Payments are processed through secure payment gateways.' },
      {
        kind: 'paragraph',
        text: 'We are not responsible for payment gateway downtime or technical failures.',
      },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Estimated delivery timelines are provided for convenience and may vary depending on location, logistics, weather conditions, or unforeseen circumstances.',
      },
    ],
  },
  {
    id: 'returns-and-refunds',
    title: 'Returns and Refunds',
    blocks: [
      {
        kind: 'paragraph',
        text: `Returns, cancellations, and refunds shall be governed by our [[Refund & Cancellation Policy|${ROUTES.REFUND_POLICY}]].`,
      },
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    blocks: [
      {
        kind: 'paragraph',
        text: `All website content including logos, product images, graphics, designs, text, and trademarks are the property of **${COMPANY.legalName}** unless otherwise stated.`,
      },
      {
        kind: 'paragraph',
        text: 'Unauthorized copying, reproduction, or distribution is prohibited.',
      },
    ],
  },
  {
    id: 'prohibited-activities',
    title: 'Prohibited Activities',
    blocks: [
      { kind: 'paragraph', text: 'Users shall not:' },
      {
        kind: 'list',
        items: [
          'Attempt unauthorized access to the website',
          'Use the website for fraudulent purposes',
          'Upload malicious software',
          'Interfere with website operations',
        ],
      },
    ],
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of Liability',
    blocks: [
      {
        kind: 'paragraph',
        text: `To the maximum extent permitted by law, **${COMPANY.legalName}** shall not be liable for indirect, incidental, or consequential damages arising from the use of this website.`,
      },
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    blocks: [
      { kind: 'paragraph', text: 'These Terms shall be governed by the laws of India.' },
      {
        kind: 'paragraph',
        text: 'Any disputes shall be subject to the jurisdiction of the competent courts located in Delhi.',
      },
    ],
  },
];

export const TERMS_CONTACT: LegalContact = {
  id: 'contact',
  title: 'Contact',
};
