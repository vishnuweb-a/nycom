import { Link } from 'react-router';

import { Reveal } from '@/components/common/Reveal';
import { TrustBadges } from '@/components/common/TrustBadges/TrustBadges';
import { RETURN_WINDOW_DAYS } from '@/constants/commerce';
import { ROUTES } from '@/constants/routes';

/**
 * The promises made at the point of purchase, repeated here on the page where
 * someone is deciding whether to buy from us at all.
 *
 * Reuses the same `TrustBadges` strip the cart and checkout show, so the four
 * promises are worded identically wherever a shopper meets them.
 */
export const AboutPromise = () => (
  <section aria-labelledby="about-promise" className="flex flex-col gap-6">
    <Reveal className="flex flex-col gap-2 text-center">
      <h2 id="about-promise" className="text-h4 text-heading md:text-h2">
        What you can count on
      </h2>

      <p className="mx-auto max-w-xl text-base text-secondary md:text-lg">
        The same terms on every order, whether it is your first or your fiftieth.
      </p>
    </Reveal>

    <Reveal delay={1} className="flex flex-col gap-4">
      <TrustBadges />

      <p className="text-center text-small text-secondary">
        Unused, unwashed items can be returned within {RETURN_WINDOW_DAYS} days of delivery. The
        full terms are in our{' '}
        <Link
          to={ROUTES.REFUND_POLICY}
          className="rounded-input font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover"
        >
          Refund &amp; Cancellation Policy
        </Link>
        .
      </p>
    </Reveal>
  </section>
);
