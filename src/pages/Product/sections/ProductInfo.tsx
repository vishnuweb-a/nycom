import { availableSizes, type Product } from '@/types/product';

export interface ProductInfoProps {
  product: Product;
}

/** Renders a row only when the value exists, so no blank cells appear. */
const Row = ({ label, value }: { label: string; value: string | null }) =>
  value === null || value === '' ? null : (
    <div className="flex gap-4 border-b border-border py-3 last:border-b-0">
      <dt className="w-40 shrink-0 text-base text-secondary">{label}</dt>
      <dd className="text-base font-medium text-text">{value}</dd>
    </div>
  );

/**
 * Description and specifications.
 *
 * The description is rendered as a text node, never as HTML. Supabase holds
 * plain text, so there is nothing to sanitise; if rich copy is introduced
 * later, it must be sanitised before any change to how this renders.
 */
export const ProductInfo = ({ product }: ProductInfoProps) => {
  const sizes = availableSizes(product);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="product-description">
        <h2 id="product-description" className="mb-4 text-h5 md:text-h4">
          Product details
        </h2>

        <p className="max-w-3xl text-lg whitespace-pre-line text-body">{product.description}</p>
      </section>

      <section aria-labelledby="product-specifications">
        <h2 id="product-specifications" className="mb-4 text-h5 md:text-h4">
          Specifications
        </h2>

        <dl className="max-w-3xl">
          <Row label="Brand" value={product.brand} />
          <Row label="Material" value={product.material} />
          <Row label="Collection" value={product.collection} />
          <Row label="Season" value={product.season} />
          <Row label="Occasion" value={product.occasion} />
          <Row label="Category" value={product.gender} />
          <Row label="SKU" value={product.sku} />
          <Row
            label="Weight"
            value={product.weight_grams === null ? null : `${String(product.weight_grams)} g`}
          />
          <Row label="Available sizes" value={sizes.join(', ')} />
        </dl>

        {product.tags.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold text-heading">Tags</h3>

            <ul className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-pill bg-surface px-3 py-1 text-small text-secondary capitalize"
                >
                  {/* Namespaced facets read as "brand: levis" rather than raw. */}
                  {tag.replace(':', ': ').replace(/-/g, ' ')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};
