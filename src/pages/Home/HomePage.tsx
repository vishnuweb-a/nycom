import { CategoryStrip } from '@/pages/Home/sections/CategoryStrip';
import { HeroCarousel } from '@/pages/Home/sections/HeroCarousel';
import { Newsletter } from '@/pages/Home/sections/Newsletter';
import { ProductShowcase } from '@/pages/Home/sections/ProductShowcase';
import { WhyYarnvia } from '@/pages/Home/sections/WhyYarnvia';
import { getFeaturedProducts, getTopSellingProducts } from '@/services/products';

/**
 * Landing page — prd.md §7.
 *
 * Composes sections in the documented order. Each data-backed section owns its
 * own fetch, so a failure in one rail never blanks the page: the rest of the
 * homepage still renders and only the failing section shows a retry.
 *
 * The contact form from Section 8 ships with the Contact feature, which owns
 * its validation and submission path.
 */
const HomePage = () => (
  <>
    <h1 className="sr-only">Yarnvia — style woven for every generation</h1>

    <HeroCarousel />

    <CategoryStrip />

    <ProductShowcase
      priority
      title="Featured picks"
      description="Handpicked pieces our stylists are reaching for right now."
      fetcher={getFeaturedProducts}
    />

    <ProductShowcase
      title="Top selling"
      description="The drapes everyone is adding to their wardrobe."
      fetcher={getTopSellingProducts}
    />

    <WhyYarnvia />

    <Newsletter />
  </>
);

export default HomePage;
