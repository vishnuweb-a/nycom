import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { absoluteUrl, APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  REFUND_CONTACT,
  REFUND_EFFECTIVE_DATE,
  REFUND_INTRO,
  REFUND_SECTIONS,
} from '@/pages/RefundPolicy/policyContent';

const PAGE_TITLE = 'Refund & Cancellation Policy';

/**
 * Refund & Cancellation Policy — `/refund-and-cancellation-policy`.
 *
 * A statutory disclosure page: the copy is fixed, so the page is a static read
 * with no data fetching, no loading state and no error state. Structure comes
 * from the shared legal layout; this module owns only the route metadata.
 */
const RefundPolicyPage = () => {
  usePageMeta({
    title: `${PAGE_TITLE} | ${APP.name}`,
    description:
      'Read the Yarnvia refund and cancellation policy — order cancellation, 7-day return eligibility, non-returnable items, refund timelines and exchanges.',
    canonical: absoluteUrl(ROUTES.REFUND_POLICY),
  });

  return (
    <LegalPageLayout
      title={PAGE_TITLE}
      path={ROUTES.REFUND_POLICY}
      effectiveDate={REFUND_EFFECTIVE_DATE}
      intro={REFUND_INTRO}
      sections={REFUND_SECTIONS}
      contact={REFUND_CONTACT}
    />
  );
};

export default RefundPolicyPage;
