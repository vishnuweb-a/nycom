import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Reveal } from '@/components/common/Reveal';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Closing call to action.
 *
 * The purple band and the white-on-primary button are the newsletter treatment
 * from the Home page, kept as a contained card rather than a full-bleed strip
 * because this page runs inside the narrower informational column.
 */
export const AboutCta = () => (
  <section aria-labelledby="about-cta">
    <Reveal>
      <div className="flex flex-col items-center gap-6 rounded-card bg-primary px-6 py-12 text-center md:px-12 md:py-16">
        <div className="flex flex-col gap-2">
          <h2 id="about-cta" className="text-h4 text-white md:text-h2">
            Come and have a look
          </h2>

          <p className="mx-auto max-w-xl text-base text-white/80 md:text-lg">
            The whole catalogue is two clicks away. If you would rather ask first, our team answers
            every message.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3 xs:flex-row xs:justify-center">
          <Link
            to={ROUTES.SHOP}
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              'bg-white hover:bg-primary-light',
            )}
          >
            Shop the collection
          </Link>

          <Link
            to={ROUTES.CONTACT}
            className={cn(buttonVariants({ variant: 'ghost' }), 'text-white hover:bg-white/10')}
          >
            Contact us
          </Link>
        </div>
      </div>
    </Reveal>
  </section>
);
