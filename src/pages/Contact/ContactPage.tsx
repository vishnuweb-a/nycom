import { Container } from '@/components/common/Container';
import { absoluteUrl, APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ContactChannels } from '@/pages/Contact/sections/ContactChannels';
import { ContactFaq } from '@/pages/Contact/sections/ContactFaq';
import { ContactForm } from '@/pages/Contact/sections/ContactForm';
import { ContactHero } from '@/pages/Contact/sections/ContactHero';
import { StoreMap } from '@/pages/Contact/sections/StoreMap';

/**
 * Contact Us — `/contact`.
 *
 * Presentation only. The message form carries no submit handler, no client
 * state and no service call; it is the finished UI waiting on the backend that
 * will receive it.
 *
 * Content sits in a 1152px column inside the standard page gutters — narrower
 * than the 1320px catalogue grid, because a wall of prose and form fields at
 * full catalogue width is tiring to read.
 */
const ContactPage = () => {
  usePageMeta({
    title: `Contact Us | ${APP.name}`,
    description:
      'Get in touch with the Yarnvia team. Customer support email and phone, working hours, our store location, and answers to common questions about shipping, returns and tracking.',
    canonical: absoluteUrl(ROUTES.CONTACT),
  });

  return (
    <>
      <ContactHero />

      <Container className="pb-14 md:pb-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-14 md:gap-20">
          {/* The form leads on wide screens: most people arrive here to write,
              not to read an address. */}
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-12">
            <ContactChannels />
            <ContactForm />
          </div>

          <ContactFaq />
          <StoreMap />
        </div>
      </Container>
    </>
  );
};

export default ContactPage;
