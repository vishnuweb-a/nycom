import { Star } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { SizeSelector } from '@/components/product/SizeSelector/SizeSelector';
import { GST_NOTE } from '@/constants/commerce';
import type { UsePurchase } from '@/pages/Product/usePurchase';
import { discountPercent, effectivePrice, type Product } from '@/types/product';
import { formatCount, formatPrice, formatRating } from '@/utils/format';

export interface PurchasePanelProps {
  product: Product;
  purchase: UsePurchase;
}

/**
 * Buying surface: identity, price, size, quantity and the two calls to action.
 *
 * All state and cart interaction lives in `usePurchase`; this component only
 * renders it, so the same logic drives the sticky mobile bar without a second
 * implementation.
 */
export const PurchasePanel = ({ product, purchase }: PurchasePanelProps) => {
  const { selectedSize, selectSize, quantity, setQuantity, availableStock, sizeError, soldOut } =
    purchase;

  const discount = discountPercent(product);
  const payable = effectivePrice(product);
  const savings = product.price - payable;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {product.ribbon !== null && (
          <span className="w-fit rounded-badge bg-accent px-3 py-1 text-caption font-semibold text-white">
            {product.ribbon}
          </span>
        )}

        <p className="text-base font-semibold tracking-wide text-primary uppercase">
          {product.brand}
        </p>

        <h1 className="text-h4 md:text-h2">{product.title}</h1>

        {product.subtitle !== null && <p className="text-lg text-secondary">{product.subtitle}</p>}

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-badge bg-success px-2 py-1 text-small font-semibold text-white">
            <Star className="size-3.5 fill-current" aria-hidden="true" />
            {formatRating(product.rating)}
          </span>

          <span className="text-small text-secondary">
            {formatCount(product.review_count)} ratings
          </span>

          <span aria-hidden="true" className="text-light">
            •
          </span>

          <span className="text-small text-secondary capitalize">{product.category}</span>
        </div>
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-h3 font-bold text-heading md:text-h2">{formatPrice(payable)}</span>

          {discount !== null && (
            <>
              <span className="text-lg text-muted line-through">{formatPrice(product.price)}</span>
              <span className="text-lg font-semibold text-success">{discount}% off</span>
            </>
          )}
        </div>

        {savings > 0 && (
          <p className="text-base font-medium text-success">
            You save {formatPrice(savings)} on this order
          </p>
        )}

        <p className="text-small text-muted">{GST_NOTE}</p>
      </div>

      {soldOut ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-base font-semibold text-heading">Currently out of stock</p>
          <p className="mt-1 text-base text-secondary">
            This piece has sold out. Browse the related styles below for something similar.
          </p>
        </div>
      ) : (
        <>
          <SizeSelector
            variants={product.variants}
            selectedSize={selectedSize}
            onSelect={selectSize}
            error={sizeError}
          />

          <QuantitySelector
            value={quantity}
            max={availableStock}
            onChange={setQuantity}
            disabled={availableStock === 0}
          />

          <div className="flex flex-col gap-3 xs:flex-row">
            <Button variant="secondary" fullWidth onClick={purchase.addToCart}>
              Add to cart
            </Button>

            <Button fullWidth onClick={purchase.buyNow}>
              Buy now
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
