import { Send } from 'lucide-react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/buttons/Button';
import { Reveal } from '@/components/common/Reveal';
import { Checkbox } from '@/components/forms/Checkbox/Checkbox';
import { TextArea } from '@/components/forms/TextArea/TextArea';
import { TextField } from '@/components/forms/TextField/TextField';
import { ROUTES } from '@/constants/routes';

/**
 * Message form — presentation only.
 *
 * The fields are deliberately uncontrolled and unvalidated in JavaScript: this
 * is the UI ahead of the service that will carry it. Every input already states
 * its own constraints (`required`, `type`, `autoComplete`, `maxLength`), so
 * wiring this to `react-hook-form` and a zod schema later is additive — no
 * markup has to move.
 *
 * `preventDefault` is the one behaviour present, and it exists only to stop the
 * browser navigating away on Enter. Nothing is sent, stored or logged.
 */
export const ContactForm = () => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <Reveal delay={2}>
      <section
        aria-labelledby="contact-form"
        className="rounded-card border border-border bg-background p-5 shadow-card md:p-8"
      >
        <h2 id="contact-form" className="text-h4 text-heading md:text-h3">
          Send us a message
        </h2>

        <p className="mt-2 text-base text-secondary">
          Fill in the form and our team will get back to you. Fields marked{' '}
          <span aria-hidden="true" className="text-danger">
            *
          </span>{' '}
          are required.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate={false}>
          <div className="sm:grid-cols-2 grid gap-5">
            <TextField
              label="First Name"
              name="firstName"
              placeholder="Aditi"
              autoComplete="given-name"
              maxLength={40}
              required
              requiredMark
            />

            <TextField
              label="Last Name"
              name="lastName"
              placeholder="Sharma"
              autoComplete="family-name"
              maxLength={40}
              required
              requiredMark
            />

            <TextField
              label="Email Address"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              requiredMark
            />

            <TextField
              label="Phone Number"
              name="phone"
              type="tel"
              placeholder="98765 43210"
              autoComplete="tel"
              inputMode="tel"
              required
              requiredMark
            />
          </div>

          <TextField
            label="Subject"
            name="subject"
            placeholder="What is your message about?"
            maxLength={120}
            required
            requiredMark
          />

          <TextField
            label="Order ID"
            name="orderId"
            placeholder="YV-MB3K2-8FQ1"
            hint="Add this if your message is about an existing order."
            optional
          />

          <TextArea
            label="Message"
            name="message"
            placeholder="Tell us how we can help…"
            rows={6}
            maxLength={1000}
            required
            requiredMark
          />

          <Checkbox
            name="privacyConsent"
            required
            label={
              <>
                I agree to the{' '}
                <Link
                  to={ROUTES.PRIVACY}
                  className="rounded-input font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary-hover"
                >
                  Privacy Policy
                </Link>
                .
              </>
            }
          />

          <Button type="submit" size="md" fullWidth className="mt-1">
            <Send className="size-4" aria-hidden="true" />
            Send Message
          </Button>
        </form>
      </section>
    </Reveal>
  );
};
