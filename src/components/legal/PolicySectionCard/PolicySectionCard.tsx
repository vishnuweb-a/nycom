import { PolicyText } from '@/components/legal/PolicyText';
import type { PolicySection } from '@/types/legal';

export interface PolicySectionCardProps {
  section: PolicySection;
  /** Clause number shown before the title, 1-based. */
  number: number;
}

/**
 * One numbered clause of a policy, in the bordered card used across the site.
 *
 * The `id` doubles as the anchor target for the "On this page" navigation, so
 * `scroll-mt` keeps the heading clear of the header after a jump.
 */
export const PolicySectionCard = ({ section, number }: PolicySectionCardProps) => (
  <section
    id={section.id}
    aria-labelledby={`${section.id}-heading`}
    className="scroll-mt-28 rounded-card border border-border bg-background p-5 shadow-card md:p-8"
  >
    <h2 id={`${section.id}-heading`} className="text-h5 text-heading md:text-h4">
      <span className="mr-2 text-primary">{number}.</span>
      {section.title}
    </h2>

    <div className="mt-4 flex flex-col gap-4">
      {section.blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index} className="text-base text-body md:text-lg">
            <PolicyText text={block.text} />
          </p>
        ) : (
          <ul key={index} className="flex list-disc flex-col gap-2 pl-5 marker:text-muted">
            {block.items.map((item) => (
              <li key={item} className="text-base text-body md:text-lg">
                <PolicyText text={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  </section>
);
