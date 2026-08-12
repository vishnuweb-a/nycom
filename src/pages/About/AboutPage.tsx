import { Container } from '@/components/common/Container';
import { absoluteUrl, APP } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AboutCta } from '@/pages/About/sections/AboutCta';
import { AboutHero } from '@/pages/About/sections/AboutHero';
import { AboutPromise } from '@/pages/About/sections/AboutPromise';
import { AboutStory } from '@/pages/About/sections/AboutStory';
import { AboutValues } from '@/pages/About/sections/AboutValues';

/**
 * About Us — `/about`.
 *
 * A static read: no fetching, no loading state and no error state. Every fact
 * on the page is drawn from the constants the storefront already runs on —
 * `COMPANY`, `CATEGORIES` and `constants/commerce` — so the copy cannot drift
 * away from what the checkout actually does.
 *
 * Content sits in the same 1152px column the Contact page uses, inside the
 * standard page gutters: prose at the full 1320px catalogue width is tiring to
 * read.
 */
const AboutPage = () => {
  usePageMeta({
    title: `About Us | ${APP.name}`,
    description:
      "Yarnvia is an online clothing store for women's, men's and children's wear, operated by YARNVIA EXPORTS PRIVATE LIMITED. What we sell, how we work and what we stand for.",
    canonical: absoluteUrl(ROUTES.ABOUT),
  });

  return (
    <>
      <AboutHero />

      <Container className="pb-14 md:pb-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-14 md:gap-20">
          <AboutStory />
          <AboutValues />
          <AboutPromise />
          <AboutCta />
        </div>
      </Container>
    </>
  );
};

export default AboutPage;
