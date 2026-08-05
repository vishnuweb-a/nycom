import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { absoluteUrl, APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  PRIVACY_CONTACT,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
} from '@/pages/Privacy/privacyContent';

const PAGE_TITLE = 'Privacy Policy';

/**
 * Privacy Policy — `/privacy-policy`.
 *
 * A statutory disclosure page: the copy is fixed, so the page is a static read
 * with no data fetching, no loading state and no error state. Structure comes
 * from the shared legal layout; this module owns only the route metadata.
 */
const PrivacyPage = () => {
  usePageMeta({
    title: `${PAGE_TITLE} | ${APP.name}`,
    description:
      'How Yarnvia collects, uses, stores and protects your personal information — the data we hold, cookies, payment security, sharing, your rights and how to contact us.',
    canonical: absoluteUrl(ROUTES.PRIVACY),
  });

  return (
    <LegalPageLayout
      title={PAGE_TITLE}
      path={ROUTES.PRIVACY}
      effectiveDate={PRIVACY_EFFECTIVE_DATE}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      contact={PRIVACY_CONTACT}
    />
  );
};

export default PrivacyPage;
