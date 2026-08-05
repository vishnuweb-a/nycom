import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { absoluteUrl, APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  TERMS_CONTACT,
  TERMS_EFFECTIVE_DATE,
  TERMS_INTRO,
  TERMS_SECTIONS,
} from '@/pages/Terms/termsContent';

const PAGE_TITLE = 'Terms & Conditions';

/**
 * Terms and Conditions — `/terms-and-conditions`.
 *
 * A statutory disclosure page: the copy is fixed, so the page is a static read
 * with no data fetching, no loading state and no error state. Structure comes
 * from the shared legal layout; this module owns only the route metadata.
 */
const TermsPage = () => {
  usePageMeta({
    title: `${PAGE_TITLE} | ${APP.name}`,
    description:
      'The terms and conditions governing use of the Yarnvia online store — eligibility, product and pricing terms, orders, payments, shipping, liability and governing law.',
    canonical: absoluteUrl(ROUTES.TERMS),
  });

  return (
    <LegalPageLayout
      title={PAGE_TITLE}
      path={ROUTES.TERMS}
      effectiveDate={TERMS_EFFECTIVE_DATE}
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
      contact={TERMS_CONTACT}
    />
  );
};

export default TermsPage;
