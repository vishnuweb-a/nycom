import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';

import { Button, buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { Modal } from '@/components/common/Modal/Modal';
import { ROUTES } from '@/constants/routes';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/useToast';
import {
  addressSchema,
  EMPTY_ADDRESS,
  type AddressFormValues,
} from '@/pages/Checkout/addressSchema';
import { AddressForm } from '@/pages/Checkout/sections/AddressForm';
import { CheckoutSummary } from '@/pages/Checkout/sections/CheckoutSummary';
import { DeliveryCard } from '@/pages/Checkout/sections/DeliveryCard';
import { PaymentCard } from '@/pages/Checkout/sections/PaymentCard';
import { appendOrder } from '@/lib/orderStorage';
import { getCartProducts } from '@/services/cartValidation';
import { createPayment, PaymentError, redirectToAirpay } from '@/services/payment';
import type { PaymentMethod } from '@/types/order';
import { calculateOrderSummary, reconcileCart } from '@/utils/cart';
import { buildOrder } from '@/utils/order';
import { formatPrice } from '@/utils/format';

/** Pause before the success page, so placing an order reads as work happening. */
const PLACEMENT_DELAY_MS = 900;

/**
 * Single-page checkout — address, delivery, payment and summary on one screen.
 *
 * Deliberately not a wizard: with one delivery method there is little to branch
 * on, and stepping through four screens to confirm an address would add
 * friction without adding clarity.
 *
 * Two payment paths, which behave very differently:
 *
 * - **Cash on Delivery** is unchanged from before this integration. Placement
 *   is simulated on the client, the order is written to localStorage, and no
 *   server is involved. No money moves, so nothing needs verifying.
 *
 * - **Pay Online** hands off to the server. `/api/payments/create` re-prices
 *   the basket from the catalogue, records the authoritative order, and returns
 *   signed fields; the browser forwards them to Airpay's hosted page. Nothing
 *   here signs, encrypts, or decides an amount.
 */
const CheckoutPage = () => {
  const { items, clearCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  /**
   * Set the moment an order is committed.
   *
   * Placing an order empties the cart, which re-renders this page. Without this
   * flag the empty-cart guard below would fire on that render and redirect to
   * `/cart`, throwing the shopper off the success page they just earned.
   */
  const [placed, setPlaced] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY_ADDRESS,
    mode: 'onBlur',
  });

  // Final availability check: the cart may have been validated minutes ago, and
  // an order must never be built from a stale price.
  const idKey = useMemo(
    () => [...new Set(items.map((item) => item.productId))].sort().join(','),
    [items],
  );

  const fetcher = useCallback(
    (signal: AbortSignal) => getCartProducts(idKey === '' ? [] : idKey.split(','), signal),
    [idKey],
  );

  const { data: products, status } = useAsyncData(fetcher);

  const lines = useMemo(
    () => (products === null ? [] : reconcileCart(items, products)),
    [items, products],
  );

  const summary = useMemo(() => calculateOrderSummary(lines), [lines]);
  const itemCount = lines.reduce(
    (count, line) => count + (line.purchasable ? line.item.quantity : 0),
    0,
  );

  /** Validates the address, then opens the confirmation. */
  const requestConfirmation = handleSubmit(
    () => {
      if (itemCount === 0) {
        showToast('Your cart has no available items.', 'error');
        return;
      }

      setConfirmOpen(true);
    },
    () => {
      showToast('Please correct the highlighted fields.', 'error');
    },
  );

  /**
   * Cash on Delivery — the original path, deliberately untouched.
   *
   * Simulated placement: no database write and no API call. The order is built
   * from the validated cart, persisted to localStorage, and the cart cleared.
   */
  const placeCodOrder = () => {
    window.setTimeout(() => {
      const order = buildOrder(lines, summary, getValues());

      appendOrder(order);
      setPlaced(true);
      clearCart();
      setConfirmOpen(false);
      setIsPlacing(false);

      void navigate(ROUTES.ORDER_SUCCESS, { state: { orderId: order.id }, replace: true });
    }, PLACEMENT_DELAY_MS);
  };

  /**
   * Pay Online — hand off to the server, then to Airpay.
   *
   * The order is cached locally *before* the redirect so that a shopper who
   * closes the tab at the gateway still finds the order in My Orders rather
   * than nothing at all. It is cached as `initiated`, never as paid: at this
   * point no money has moved, and only server-side verification may say
   * otherwise.
   *
   * The cart is deliberately *not* cleared here. A payment that fails or is
   * abandoned must leave the shopper able to try again, and emptying the basket
   * on the way out would strand them. The success page clears it once the server
   * confirms the payment.
   */
  const startOnlinePayment = async () => {
    const purchasable = lines.filter((line) => line.purchasable).map((line) => line.item);

    try {
      const payment = await createPayment(purchasable, getValues());

      // The server's figure is authoritative. If it disagrees with what the
      // shopper was shown, stop and let them re-read the total rather than
      // sending them to a payment page for an unexpected amount.
      if (Math.abs(payment.amount - summary.grandTotal) > 0.01) {
        showToast('Your order total has changed. Please review your cart.', 'error');
        setConfirmOpen(false);
        setIsPlacing(false);

        return;
      }

      appendOrder(
        buildOrder(lines, summary, getValues(), {
          id: payment.orderRef,
          paymentMethod: 'airpay',
          paymentStatus: 'initiated',
          accessToken: payment.accessToken,
        }),
      );

      // Suppresses the empty-cart guard without emptying the cart, so leaving
      // for the gateway does not look like an abandoned checkout.
      setPlaced(true);

      // Leaves the SPA entirely; no state update follows.
      redirectToAirpay(payment);
    } catch (error) {
      showToast(
        error instanceof PaymentError
          ? error.message
          : 'We could not start your payment. Please try again in a moment.',
        'error',
      );

      setConfirmOpen(false);
      setIsPlacing(false);
    }
  };

  const confirmOrder = () => {
    setIsPlacing(true);

    if (paymentMethod === 'cod') {
      placeCodOrder();

      return;
    }

    void startOnlinePayment();
  };

  // An empty cart has nothing to check out; send the shopper back rather than
  // rendering a form that cannot be submitted. Skipped once an order is placed,
  // since clearing the cart is the expected outcome of success, not a dead end.
  if (items.length === 0 && !placed) {
    return <Navigate to={ROUTES.CART} replace />;
  }

  return (
    <>
      <Container className="flex flex-col gap-6 py-6 pb-28 md:gap-8 md:py-10 md:pb-14">
        <header className="flex flex-col gap-1">
          <h1 className="text-h4 md:text-h2">Checkout</h1>
          <p className="text-base text-secondary">
            Review your details and choose how you&apos;d like to pay.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
          <form
            noValidate
            onSubmit={(event) => {
              void requestConfirmation(event);
            }}
            className="flex flex-col gap-6"
          >
            <AddressForm register={register} errors={errors} />
            <DeliveryCard />
            <PaymentCard value={paymentMethod} onChange={setPaymentMethod} disabled={isPlacing} />

            {/* Submits the form so validation runs before the modal opens. */}
            <Button type="submit" fullWidth className="hidden md:inline-flex lg:hidden">
              Review and place order
            </Button>
          </form>

          {/* Sticky below the 72px header plus the 52px category bar. */}
          <aside className="lg:sticky lg:top-32">
            <CheckoutSummary
              lines={lines}
              summary={summary}
              itemCount={itemCount}
              isValidating={status === 'loading'}
              isPlacing={isPlacing}
              onPlaceOrder={() => {
                void requestConfirmation();
              }}
            />
          </aside>
        </div>
      </Container>

      {/* Sticky mobile action, mirroring the cart and product pages. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-modal md:hidden">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-caption text-secondary">Total</span>
            <span className="text-h5 font-bold text-heading">
              {status === 'loading' ? '—' : formatPrice(summary.grandTotal)}
            </span>
          </div>

          <Button
            fullWidth
            isLoading={isPlacing}
            loadingLabel={
              paymentMethod === 'cod' ? 'Placing your order' : 'Creating secure payment'
            }
            onClick={() => {
              void requestConfirmation();
            }}
            className="ml-auto flex-1"
          >
            {paymentMethod === 'cod' ? 'Place Order' : 'Pay Now'}
          </Button>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!isPlacing) {
            setConfirmOpen(false);
          }
        }}
        title="Confirm Order"
        footer={
          <>
            <button
              type="button"
              disabled={isPlacing}
              onClick={() => {
                setConfirmOpen(false);
              }}
              className={buttonVariants({ variant: 'secondary', fullWidth: true })}
            >
              Cancel
            </button>

            <Button
              fullWidth
              isLoading={isPlacing}
              loadingLabel={
                paymentMethod === 'cod' ? 'Placing your order' : 'Creating secure payment'
              }
              onClick={confirmOrder}
            >
              {paymentMethod === 'cod' ? 'Confirm Order' : 'Proceed to Pay'}
            </Button>
          </>
        }
      >
        {paymentMethod === 'cod' ? (
          <>
            <p>You have selected Cash on Delivery.</p>
            <p className="mt-2">
              Your order will be placed. Payment will be collected during delivery.
            </p>
            <p className="mt-4 font-semibold text-heading">
              Amount payable on delivery: {formatPrice(summary.grandTotal)}
            </p>
          </>
        ) : (
          <>
            <p>You&apos;ll be taken to Airpay to complete your payment securely.</p>
            <p className="mt-2">
              Please don&apos;t close your browser or press back while the payment is in progress.
              We&apos;ll confirm your order once payment is verified.
            </p>
            <p className="mt-4 font-semibold text-heading">
              Amount payable now: {formatPrice(summary.grandTotal)}
            </p>
          </>
        )}
      </Modal>

      {status === 'error' && (
        <p role="alert" className="sr-only">
          We could not confirm current prices.
        </p>
      )}
    </>
  );
};

export default CheckoutPage;
