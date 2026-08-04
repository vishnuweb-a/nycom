import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { StatusMessage } from '@/components/common/StatusMessage';
import { useAsyncData } from '@/hooks/useAsyncData';
import { getCarouselSlides } from '@/services/carousel';
import { cloudinarySrcSet, cloudinaryUrl } from '@/utils/cloudinary';
import { cn } from '@/utils/cn';

const AUTO_ADVANCE_MS = 6000;
const HERO_WIDTHS = [480, 768, 1024, 1440];

/**
 * Hero banner carousel — prd.md §7 Section 2.
 *
 * Auto-advances, but pauses on hover, on keyboard focus, and whenever the tab
 * is hidden. Auto-advance is disabled outright for users who have requested
 * reduced motion, since a self-moving banner is exactly what that setting is
 * meant to stop.
 *
 * Implemented as a labelled group of slides with previous/next controls and dot
 * navigation, following the ARIA carousel pattern.
 */
export const HeroCarousel = () => {
  const { data, status, error, retry } = useAsyncData(getCarouselSlides);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = data ?? [];
  const count = slides.length;

  const goTo = useCallback(
    (next: number) => {
      if (count > 0) {
        setIndex(((next % count) + count) % count);
      }
    },
    [count],
  );

  useEffect(() => {
    if (count < 2 || paused) {
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTO_ADVANCE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [count, paused]);

  // Pause while the tab is in the background so a returning shopper does not
  // find the banner several slides further along.
  useEffect(() => {
    const onVisibilityChange = () => {
      setPaused(document.hidden);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (status === 'loading') {
    return (
      <Container className="py-6">
        <div
          aria-busy="true"
          aria-label="Loading offers"
          className="h-64 animate-pulse rounded-hero bg-placeholder md:h-hero"
        />
      </Container>
    );
  }

  if (status === 'error') {
    return (
      <Container className="py-6">
        <StatusMessage
          icon={AlertCircle}
          tone="error"
          title="Offers unavailable"
          description={error ?? 'We could not load the latest offers.'}
          action={
            <button type="button" onClick={retry} className={buttonVariants({ size: 'sm' })}>
              Try again
            </button>
          }
        />
      </Container>
    );
  }

  if (count === 0) {
    return null;
  }

  return (
    <Container className="py-6">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions --
          Pause-on-hover supports WCAG 2.2.2 (Pause, Stop, Hide) rather than
          providing functionality. Keyboard users are served by the paired
          focus/blur handlers, and every control inside is separately operable,
          so no behaviour is mouse-only. */}
      <section
        aria-roledescription="carousel"
        aria-label="Featured offers"
        className="relative overflow-hidden rounded-hero bg-primary-light"
        onMouseEnter={() => {
          setPaused(true);
        }}
        onMouseLeave={() => {
          setPaused(false);
        }}
        onFocusCapture={() => {
          setPaused(true);
        }}
        onBlurCapture={() => {
          setPaused(false);
        }}
      >
        {slides.map((slide, slideIndex) => {
          const isCurrent = slideIndex === index;

          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${String(slideIndex + 1)} of ${String(count)}: ${slide.title}`}
              aria-hidden={!isCurrent}
              className={cn(
                'grid grid-cols-1 items-center gap-6 transition-opacity duration-250 md:grid-cols-2',
                isCurrent ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
              )}
            >
              <div className="order-2 flex flex-col items-start gap-4 p-6 md:order-1 md:p-10">
                <h2 className="text-h3 text-heading md:text-h1">{slide.title}</h2>

                {slide.subtitle !== null && (
                  <p className="text-base text-body md:text-lg">{slide.subtitle}</p>
                )}

                {slide.button_text !== null && slide.button_link !== null && (
                  <Link
                    to={slide.button_link}
                    className={buttonVariants()}
                    tabIndex={isCurrent ? undefined : -1}
                  >
                    {slide.button_text}
                  </Link>
                )}
              </div>

              <div className="order-1 h-56 w-full md:order-2 md:h-hero">
                <img
                  src={cloudinaryUrl(slide.image, { width: 768, aspectRatio: '4:3' })}
                  srcSet={cloudinarySrcSet(slide.image, HERO_WIDTHS, { aspectRatio: '4:3' })}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  alt={slide.image.alt}
                  width={768}
                  height={576}
                  loading={slideIndex === 0 ? 'eager' : 'lazy'}
                  fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="size-full object-cover"
                />
              </div>
            </div>
          );
        })}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => {
                goTo(index - 1);
              }}
              aria-label="Previous slide"
              className="absolute top-1/2 left-3 hidden size-tap -translate-y-1/2 items-center justify-center rounded-pill bg-white text-body shadow-card transition-colors hover:text-primary md:inline-flex"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => {
                goTo(index + 1);
              }}
              aria-label="Next slide"
              className="absolute top-1/2 right-3 hidden size-tap -translate-y-1/2 items-center justify-center rounded-pill bg-white text-body shadow-card transition-colors hover:text-primary md:inline-flex"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((slide, dotIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => {
                    goTo(dotIndex);
                  }}
                  aria-label={`Go to slide ${String(dotIndex + 1)}`}
                  aria-current={dotIndex === index}
                  className={cn(
                    'h-2 rounded-pill transition-all',
                    dotIndex === index ? 'w-6 bg-primary' : 'w-2 bg-white',
                  )}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </Container>
  );
};
