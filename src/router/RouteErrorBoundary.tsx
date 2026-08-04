import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { ROUTES } from '@/constants/routes';

/**
 * Catches render, loader and action failures for every route.
 *
 * Guarantees the "never leave blank screens" rule from guidelines.md: a thrown
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
    <div className="container-page flex flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="text-h3 md:text-h2">We hit a snag</h1>

      <p className="max-w-md text-lg text-secondary">
        {isChunkLoadFailure
          ? 'A newer version of Yarnvia is available. Reload to continue.'
          : message}
      </p>

      <div className="flex flex-col gap-3 xs:flex-row">
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="flex h-control min-w-tap items-center justify-center rounded-button bg-primary px-6 text-button font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Reload page
        </button>

        <Link
          to={ROUTES.HOME}
          className="flex h-control min-w-tap items-center justify-center rounded-button border border-primary px-6 text-button font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
};
