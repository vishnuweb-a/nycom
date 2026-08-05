import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Container } from '@/components/common/Container';
import { LegalContactCard } from '@/components/legal/LegalContactCard';
import { PolicyContents } from '@/components/legal/PolicyContents';
import { PolicySectionCard } from '@/components/legal/PolicySectionCard';
import { PolicyText } from '@/components/legal/PolicyText';
import type { EffectiveDate, LegalContact, PolicySection } from '@/types/legal';

export interface LegalPageLayoutProps {
  /** Page heading, also the final breadcrumb crumb. */
  title: string;
  /** Route the page is served at, for the breadcrumb. */
  path: string;
  effectiveDate: EffectiveDate;
  /** Lead paragraphs, shown in the header band. */
  intro: readonly string[];
  /** Numbered clauses, in reading order. */
  sections: readonly PolicySection[];
  /** Closing contact clause, numbered after the last section. */
  contact: LegalContact;
}

/**
 * Shared shell for statutory disclosure pages.
 *
 * Every legal page has the same anatomy — a header band carrying the title and
 * effective date, a clause index, and one card per clause — so the structure
 * lives here and each page supplies only its route metadata and its copy. That
 * keeps Terms, Refund & Cancellation and the policies still to come visually
 * identical without any of them owning a private copy of the layout.
 */
export const LegalPageLayout = ({
  title,
  path,
  effectiveDate,
  intro,
  sections,
  contact,
}: LegalPageLayoutProps) => (
  <>
    <header className="border-b border-border bg-section">
      <Container className="flex flex-col gap-4 py-8 md:py-12">
        <Breadcrumb items={[{ label: title, path }]} />

        <h1 className="text-h3 md:text-h1">{title}</h1>

        <p className="text-small text-secondary">
          Effective Date:{' '}
          <time dateTime={effectiveDate.iso} className="font-medium text-text">
            {effectiveDate.label}
          </time>
        </p>

        <div className="flex max-w-3xl flex-col gap-3">
          {intro.map((paragraph) => (
            <p key={paragraph} className="text-base text-body md:text-lg">
              <PolicyText text={paragraph} />
            </p>
          ))}
        </div>
      </Container>
    </header>

    <Container className="grid gap-8 py-10 md:py-14 lg:grid-cols-[240px_1fr] lg:items-start lg:gap-12">
      <PolicyContents
        entries={[
          ...sections.map(({ id, title: sectionTitle }) => ({ id, title: sectionTitle })),
          { id: contact.id, title: contact.title },
        ]}
      />

      <div className="flex flex-col gap-5 md:gap-6">
        {sections.map((section, index) => (
          <PolicySectionCard key={section.id} section={section} number={index + 1} />
        ))}

        <LegalContactCard contact={contact} number={sections.length + 1} />
      </div>
    </Container>
  </>
);
