import { Container } from '@/components/common/Container';

const bar = 'animate-pulse rounded-input bg-placeholder';

/**
 * Loading placeholder mirroring the real layout, so the page does not jump when
 * the product arrives.
 */
export const ProductSkeleton = () => (
  <Container className="py-6 md:py-10" aria-busy="true" aria-label="Loading product">
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="aspect-4/5 w-full animate-pulse rounded-card bg-placeholder" />

      <div className="flex flex-col gap-4">
        <div className={`h-4 w-24 ${bar}`} />
        <div className={`h-8 w-4/5 ${bar}`} />
        <div className={`h-5 w-2/5 ${bar}`} />
        <div className={`h-10 w-1/2 ${bar}`} />

        <div className="mt-4 flex gap-3">
          {['a', 'b', 'c', 'd'].map((key) => (
            <div key={key} className={`size-tap ${bar}`} />
          ))}
        </div>

        <div className={`mt-4 h-control w-full ${bar}`} />
        <div className={`h-control w-full ${bar}`} />
      </div>
    </div>
  </Container>
);
