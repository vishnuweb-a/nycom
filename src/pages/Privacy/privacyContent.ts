import { APP } from '@/constants/app';
import { COMPANY } from '@/constants/company';
import type { EffectiveDate, LegalContact, PolicySection } from '@/types/legal';

/**
 * Privacy Policy — the legal copy itself.
 *
 * Authored as data, with the inline markers documented in `types/legal.ts`.
 */

export const PRIVACY_EFFECTIVE_DATE: EffectiveDate = {
  label: 'August 5, 2026',
  iso: '2026-08-05',
};

export const PRIVACY_INTRO: readonly string[] = [
  `**${COMPANY.legalName}** ("${APP.name}", "we", "our", or "us") operates the website **${COMPANY.website}**.`,
  'We value your privacy and are committed to protecting your personal information.',
  'This Privacy Policy explains how we collect, use, store, and protect your information when you use our website.',
];

export const PRIVACY_SECTIONS: readonly PolicySection[] = [
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    blocks: [
      { kind: 'paragraph', text: 'We may collect:' },
      {
        kind: 'list',
        items: [
          'Full name',
          'Mobile number',
          'Email address',
          'Shipping and billing address',
          'Payment details (processed securely through third-party payment gateways)',
          'Order history',
          'Device information',
          'IP address',
          'Browser type',
          'Cookies and website usage data',
        ],
      },
    ],
  },
  {
    id: 'how-we-use-your-information',
    title: 'How We Use Your Information',
    blocks: [
      { kind: 'paragraph', text: 'We use your information to:' },
      {
        kind: 'list',
        items: [
          'Process and deliver your orders',
          'Provide customer support',
          'Send order confirmations and shipping updates',
          'Improve our products and services',
          'Prevent fraud and unauthorized activities',
          'Comply with legal obligations',
          'Send promotional offers and marketing communications (users may opt out at any time)',
        ],
      },
    ],
  },
  {
    id: 'payment-information',
    title: 'Payment Information',
    blocks: [
      {
        kind: 'paragraph',
        text: 'We do not store debit card, credit card, UPI PIN, or banking credentials.',
      },
      {
        kind: 'paragraph',
        text: 'Payments are processed securely through trusted third-party payment service providers.',
      },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    blocks: [
      { kind: 'paragraph', text: 'Our website uses cookies to:' },
      {
        kind: 'list',
        items: [
          'Improve user experience',
          'Remember preferences',
          'Analyze website traffic',
          'Provide personalized content',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Users may disable cookies through browser settings, although certain website features may not function correctly.',
      },
    ],
  },
  {
    id: 'sharing-of-information',
    title: 'Sharing of Information',
    blocks: [
      { kind: 'paragraph', text: 'We may share information with:' },
      {
        kind: 'list',
        items: [
          'Delivery and logistics partners',
          'Payment gateway providers',
          'Technology and hosting providers',
          'Government authorities when legally required',
        ],
      },
      {
        kind: 'paragraph',
        text: 'We do **not** sell personal information to third parties.',
      },
    ],
  },
  {
    id: 'data-security',
    title: 'Data Security',
    blocks: [
      {
        kind: 'paragraph',
        text: 'We implement reasonable administrative, technical, and organizational safeguards to protect personal information.',
      },
      {
        kind: 'paragraph',
        text: 'However, no internet transmission or electronic storage method can be guaranteed to be completely secure.',
      },
    ],
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    blocks: [
      { kind: 'paragraph', text: 'Users may request to:' },
      {
        kind: 'list',
        items: [
          'Access personal information',
          'Correct inaccurate information',
          'Update account details',
          'Delete an account (subject to applicable legal and business requirements)',
        ],
      },
      {
        kind: 'paragraph',
        text: 'Requests should be made using the contact information below.',
      },
    ],
  },
  {
    id: 'childrens-privacy',
    title: "Children's Privacy",
    blocks: [
      { kind: 'paragraph', text: 'Our website is intended for general audiences.' },
      {
        kind: 'paragraph',
        text: 'We do not knowingly collect personal information from children without appropriate consent.',
      },
    ],
  },
  {
    id: 'third-party-links',
    title: 'Third-Party Links',
    blocks: [
      { kind: 'paragraph', text: 'Our website may contain links to third-party websites.' },
      {
        kind: 'paragraph',
        text: 'We are not responsible for the privacy practices or content of those websites.',
      },
    ],
  },
  {
    id: 'changes-to-this-privacy-policy',
    title: 'Changes to this Privacy Policy',
    blocks: [
      {
        kind: 'paragraph',
        text: 'We reserve the right to update this Privacy Policy at any time.',
      },
      {
        kind: 'paragraph',
        text: 'Updated versions will be published on this page with the revised Effective Date.',
      },
    ],
  },
];

export const PRIVACY_CONTACT: LegalContact = {
  id: 'contact-information',
  title: 'Contact Information',
};
