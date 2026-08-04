import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { QuantitySelector } from '@/components/product/QuantitySelector/QuantitySelector';
import { productPath } from '@/constants/routes';
import type { CartLineIssue, ReconciledLine } from '@/types/cart';
import { cloudinaryUrlFromSrc } from '@/utils/cloudinary';
import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format';

export interface CartLineItemProps {
  line: ReconciledLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

/** Human wording for each discrepancy, with the tone it should be shown in. */
const describeIssue = (issue: CartLineIssue): { text: string; severe: boolean } => {
  switch (issue.type) {
    case 'unavailable':
      return { text: 'This product is no longer available.', severe: true };
    case 'size-unavailable':
      return { text: 'This size is no longer available. Please choose another.', severe: true };
    case 'out-of-stock':
      return { text: 'This size has sold out.', severe: true };
    case 'quantity-reduced':
      return {
        text: `Only ${String(issue.to)} left — quantity reduced from ${String(issue.from)}.`,
        severe: false,
      };
    case 'price-changed':
      return { text: 'Price updated since you added this item.', severe: false };
  }
};

/**
 * One cart line.
 *
 * Image and title link back to the product. Quantity is the same stepper the
 * product page uses, bounded by the freshly validated stock rather than the
 * figure captured when the item was added.
 */
export const CartLineItem = ({ line, onQuantityChange, onRemove }: CartLineItemProps) => {
  const { item, issues, purchasable } = line;
  const href = productPath(item.slug);
  const lineTotal = item.discountPrice * item.quantity;
  const hasDiscount = item.unitPrice > item.discountPrice;

  return (
    <article
      className={cn(
        'flex gap-4 rounded-card border border-border p-3 md:p-4',
        !purchasable && 'bg-surface',
      )}
    >
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden="true"
        className="w-24 shrink-0 overflow-hidden rounded-image bg-placeholder md:w-28"
      >
        <img
          src={cloudinaryUrlFromSrc(item.thumbnail, { width: 224, aspectRatio: '4:5' })}
          alt=""
          width={112}
          height={140}
          loading="lazy"
          decoding="async"
          className={cn('aspect-4/5 w-full object-cover', !purchasable && 'opacity-50')}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-semibold tracking-wide text-primary uppercase">
              {item.brand}
            </p>

            <h3 className="text-base font-medium text-text">
              <Link to={href} className="rounded-input hover:text-primary">
                {item.title}
              </Link>
            </h3>

            <p className="mt-1 text-small text-secondary">Size: {item.selectedSize}</p>
          </div>

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.title} from cart`}
            className="inline-flex size-tap shrink-0 items-center justify-center rounded-pill text-secondary transition-colors hover:bg-hover hover:text-danger"
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>

        {issues.length > 0 && (
          <ul className="flex flex-col gap-1">
            {issues.map((issue) => {
              const { text, severe } = describeIssue(issue);
              const Icon = severe ? AlertTriangle : Info;

              return (
                <li
                  key={issue.type}
                  className={cn(
                    'flex items-center gap-1.5 text-small',
                    severe ? 'text-danger' : 'text-warning',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {text}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {purchasable ? (
            <QuantitySelector value={item.quantity} max={item.stock} onChange={onQuantityChange} />
          ) : (
            <span className="text-small font-medium text-secondary">Not available</span>
          )}

          <div className="flex flex-col items-end">
            <span className="text-h5 font-bold text-heading">{formatPrice(lineTotal)}</span>

            {hasDiscount && (
              <span className="text-small text-muted line-through">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            )}

            {item.quantity > 1 && (
              <span className="text-caption text-muted">
                {formatPrice(item.discountPrice)} each
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
