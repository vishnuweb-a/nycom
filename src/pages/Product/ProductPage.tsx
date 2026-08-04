import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { StatusMessage } from '@/components/common/StatusMessage';
import { ProductGallery } from '@/components/product/ProductGallery/ProductGallery';
import { CATEGORIES } from '@/constants/categories';
import { productPath, ROUTES, shopCategoryPath } from '@/constants/routes';
import { useAsyncData } from '@/hooks/useAsyncData';
import NotFoundPage from '@/pages/NotFound';
import { DeliveryInfo } from '@/pages/Product/sections/DeliveryInfo';
import { MobilePurchaseBar } from '@/pages/Product/sections/MobilePurchaseBar';
import { ProductInfo } from '@/pages/Product/sections/ProductInfo';
import { ProductSkeleton } from '@/pages/Product/sections/ProductSkeleton';
import { PurchasePanel } from '@/pages/Product/sections/PurchasePanel';
import { RelatedProducts } from '@/pages/Product/sections/RelatedProducts';
import { usePurchase } from '@/pages/Product/usePurchase';
import { getProductBySlug } from '@/services/productDetail';
import type { Product } from '@/types/product';

/**
 * The detail view itself.
 *
 * Split from the route component so `usePurchase` and the document-title effect
 * run only once a product exists — hooks cannot be called conditionally, and
 * the route has to render loading, error and not-found states first.
 */
const ProductDetail = ({ product }: { product: Product }) => {
  const purchase = usePurchase(product);

  // prd.md §19 asks for SEO-friendly pages and the catalogue already carries
  // per-product meta copy. Restored on unmount so a stale title never leaks
  // onto the next route.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = product.meta_title ?? `${product.title} | Yarnvia`;

    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') ?? null;

    if (meta !== null && product.meta_description !== null) {
      meta.setAttribute('content', product.meta_description);
    }

    return () => {
      document.title = previousTitle;

      if (meta !== null && previousDescription !== null) {
        meta.setAttribute('content', previousDescription);
      }
    };
  }, [product]);

  const category = CATEGORIES.find((entry) => entry.slug === product.category);

  return (
    <>
      {/* Bottom padding clears the fixed mobile purchase bar. */}
      <Container className="flex flex-col gap-10 py-6 pb-28 md:gap-14 md:py-10 md:pb-14">
        <Breadcrumb
          items={[
            { label: 'Shop', path: ROUTES.SHOP },
            ...(category === undefined
              ? []
              : [{ label: category.name, path: shopCategoryPath(category.slug) }]),
            { label: product.title, path: productPath(product.slug) },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
          {/* The gallery holds position while the longer right column scrolls. */}
          <div className="lg:sticky lg:top-32">
            <ProductGallery images={product.images} ribbon={product.ribbon} />
          </div>

          <div className="flex flex-col gap-8">
            <PurchasePanel product={product} purchase={purchase} />
            <DeliveryInfo />
          </div>
        </div>

        <ProductInfo product={product} />

        <RelatedProducts product={product} />
      </Container>

      <MobilePurchaseBar product={product} purchase={purchase} />
    </>
  );
};

/**
 * `/product/:slug`.
 *
 * A slug matching nothing renders the production Not Found page rather than an
 * error state — a mistyped URL is not a failure worth retrying.
 */
const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const fetcher = useCallback(
    (signal: AbortSignal) => getProductBySlug(slug ?? '', signal),
    [slug],
  );

  const { data, status, error, retry } = useAsyncData(fetcher);

  if (status === 'loading') {
    return <ProductSkeleton />;
  }

  if (status === 'error') {
    return (
      <Container className="py-16">
        <StatusMessage
          icon={AlertCircle}
          tone="error"
          title="We couldn't load this product"
          description={error ?? 'Something went wrong while loading this page.'}
          action={
            <button type="button" onClick={retry} className={buttonVariants({ size: 'sm' })}>
              Try again
            </button>
          }
        />
      </Container>
    );
  }

  if (data === null) {
    return <NotFoundPage />;
  }

  // Remount on slug change so gallery and purchase state never carry over
  // between products when navigating from the related rail.
  return <ProductDetail key={data.id} product={data} />;
};

export default ProductPage;
