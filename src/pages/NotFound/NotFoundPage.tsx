import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { ROUTES } from '@/constants/routes';

/**
 * 404 page. Reached by any unmatched URL.
 *
 * Offers both a recovery action and a browsing action so a mistyped or expired
 * product link becomes a shopping opportunity rather than a dead end.
 */
const NotFoundPage = () => (
  <Container className="flex flex-col items-center justify-center gap-6 py-24 text-center">
    <p className="text-h1 font-bold text-primary" aria-hidden="true">
      404
    </p>

    <h1 className="text-h3 md:text-h2">This page has unravelled</h1>

    <p className="max-w-md text-lg text-secondary">
      The page you are looking for was moved, removed, or never existed. Let&apos;s get you back to
      something worth wearing.
    </p>

    <div className="flex flex-col gap-3 xs:flex-row">
      <Link to={ROUTES.HOME} className={buttonVariants()}>
        Back to home
      </Link>

      <Link to={ROUTES.SHOP} className={buttonVariants({ variant: 'secondary' })}>
        Continue shopping
      </Link>
    </div>
  </Container>
);

export default NotFoundPage;
