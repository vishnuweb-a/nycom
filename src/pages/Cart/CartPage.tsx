import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { StatusMessage } from '@/components/common/StatusMessage';
import { TrustBadges } from '@/components/common/TrustBadges/TrustBadges';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import { CartLineItem } from '@/pages/Cart/sections/CartLineItem';
import { EmptyCart } from '@/pages/Cart/sections/EmptyCart';
import { MobileCheckoutBar } from '@/pages/Cart/sections/MobileCheckoutBar';
import { OrderSummaryPanel } from '@/pages/Cart/sections/OrderSummaryPanel';
import { getCartProducts } from '@/services/cartValidation';
import { calculateOrderSummary, hasCorrections, reconcileCart } from '@/utils/cart';

/** Skeleton mirroring a cart line, shown while the catalogue is checked. */
const LineSkeleton = () => (
  <div aria-hidden="true" className="flex gap-4 rounded-card border border-border p-4">
    <div className="aspect-4/5 w-24 animate-pulse rounded-image bg-placeholder md:w-28" />

    <div className="flex flex-1 flex-col gap-3">
      <div className="h-3 w-20 animate-pulse rounded-input bg-placeholder" />
      <div className="h-4 w-3/5 animate-pulse rounded-input bg-placeholder" />
      <div className="h-4 w-16 animate-pulse rounded-input bg-placeholder" />
      <div className="mt-auto h-tap w-32 animate-pulse rounded-input bg-placeholder" />
    </div>
  </div>
);

/**
 * Shopping cart — prd.md §10.
 *
 * Every line is revalidated against Supabase on load. The live catalogue always
 * wins: prices, stock and availability are re-derived rather than trusted,
 * because a basket persisted in localStorage can be days old. Corrections are
 * committed back through CartContext in a single update.
 *
 * Unpurchasable lines are kept and flagged rather than silently removed —
 * deleting someone's items behind their back is worse than showing them what
 * changed — but they are excluded from every total and block checkout.
 */
const CartPage = () => {
  const { items, removeItem, updateQuantity, replaceItems } = useCart();
  const { showToast } = useToast();

  // Keyed on the product ids alone, so correcting a price or quantity does not
  // trigger another round trip and risk a revalidation loop.
  const productIds = useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort(),
    [items],
  );
  const idKey = productIds.join(',');

  const fetcher = useCallback(
    (signal: AbortSignal) => getCartProducts(idKey === '' ? [] : idKey.split(','), signal),
    [idKey],
  );

  const { data: products, status, error, retry } = useAsyncData(fetcher);

  const lines = useMemo(
    () => (products === null ? [] : reconcileCart(items, products)),
    [items, products],
  );

  // Commit corrections once per validated result. The ref stops a second pass
  // from re-reporting the same changes after state settles.
  const reportedFor = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'success' || lines.length === 0) {
      return;
    }

    const signature = lines
      .map((line) => line.issues.map((issue) => issue.type).join('|'))
      .join(';');

    if (reportedFor.current === signature || !hasCorrections(lines)) {
      return;
    }

    reportedFor.current = signature;

    const corrected = lines.map((line) => line.item);
    const changed = corrected.some((item, index) => {
      const original = items[index];

      return (
        original === undefined ||
        original.quantity !== item.quantity ||
        original.discountPrice !== item.discountPrice ||
        original.unitPrice !== item.unitPrice ||
        original.stock !== item.stock ||
        original.title !== item.title
      );
    });

    if (changed) {
      replaceItems(corrected);
    }

    const priceChanged = lines.some((line) =>
      line.issues.some((issue) => issue.type === 'price-changed'),
    );
    const stockChanged = lines.some((line) =>
      line.issues.some((issue) => issue.type === 'quantity-reduced'),
    );

    if (priceChanged) {
      showToast('Some prices were updated to the latest catalogue.', 'info');
    }

    if (stockChanged) {
      showToast('Some quantities were reduced to match available stock.', 'info');
    }
  }, [status, lines, items, replaceItems, showToast]);

  const summary = useMemo(() => calculateOrderSummary(lines), [lines]);
  const purchasableCount = lines.reduce(
    (count, line) => count + (line.purchasable ? line.item.quantity : 0),
    0,
  );
  const canCheckout = purchasableCount > 0 && lines.every((line) => line.purchasable);

  if (items.length === 0) {
    return (
      <Container className="py-6 md:py-10">
        <h1 className="sr-only">Your cart</h1>
        <EmptyCart />
      </Container>
    );
  }

  return (
    <>
      <Container className="flex flex-col gap-8 py-6 pb-28 md:py-10 md:pb-14">
        <header className="flex flex-col gap-1">
          <h1 className="text-h4 md:text-h2">Your cart</h1>
          <p className="text-base text-secondary">
            {items.length} {items.length === 1 ? 'item' : 'items'} ready for review
          </p>
        </header>

        {status === 'error' && (
          <StatusMessage
            icon={AlertCircle}
            tone="error"
            title="We couldn't check availability"
            description={error ?? 'Your items are safe. Retry to confirm current prices and stock.'}
            action={
              <button type="button" onClick={retry} className={buttonVariants({ size: 'sm' })}>
                Try again
              </button>
            }
          />
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
          <section aria-label="Cart items" className="flex flex-col gap-4">
            {status === 'loading'
              ? items.map((item) => <LineSkeleton key={`${item.productId}-${item.selectedSize}`} />)
              : lines.map((line) => (
                  <CartLineItem
                    key={`${line.item.productId}-${line.item.selectedSize}`}
                    line={line}
                    onQuantityChange={(quantity) => {
                      updateQuantity(line.item.productId, line.item.selectedSize, quantity);
                    }}
                    onRemove={() => {
                      removeItem(line.item.productId, line.item.selectedSize);
                      showToast(`${line.item.title} removed from cart.`, 'info');
                    }}
                  />
                ))}

            <TrustBadges />
          </section>

          {/* Sticky below the 72px header plus the 52px category bar. */}
          <aside className="lg:sticky lg:top-32">
            <h2 className="sr-only">Summary</h2>

            <OrderSummaryPanel
              summary={summary}
              itemCount={purchasableCount}
              isValidating={status === 'loading'}
              canCheckout={canCheckout && status === 'success'}
            />
          </aside>
        </div>
      </Container>

      <MobileCheckoutBar
        grandTotal={summary.grandTotal}
        canCheckout={canCheckout && status === 'success'}
      />
    </>
  );
};

export default CartPage;
