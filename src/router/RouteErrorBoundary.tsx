import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button, buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { ROUTES } from '@/constants/routes';

/**
 * Catches render, loader and action failures for every route.
 *
 * Guarantees the "never leave blank screens" rule from guildline.md: a thrown
 * error yields a recoverable page rather than an unmounted white document.
 * Chunk-load failures — common after a deploy invalidates a lazy chunk mid
 * session — are recovered with a hard reload rather than a generic message.
 */
export const RouteErrorBoundary = () => {
  const error = useRouteError();

  const isChunkLoadFailure =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);

  const message = isRouteErrorResponse(error)
    ? `${String(error.status)} — ${error.statusText}`
    : 'Something went wrong while loading this page.';

  return (
    <Container className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="text-h3 md:text-h2">We hit a snag</h1>

      <p className="max-w-md text-lg text-secondary">
        {isChunkLoadFailure
          ? 'A newer version of Yarnvia is available. Reload to continue.'
          : message}
      </p>

      <div className="flex flex-col gap-3 xs:flex-row">
        <Button
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload page
        </Button>

        <Link to={ROUTES.HOME} className={buttonVariants({ variant: 'secondary' })}>
          Back to home
        </Link>
      </div>
    </Container>
  );
};
