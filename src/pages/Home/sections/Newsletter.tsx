import { CheckCircle2 } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button } from '@/components/buttons/Button';
import { Container } from '@/components/common/Container';
import { AlreadySubscribedError, subscribeToNewsletter } from '@/services/newsletter';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.');

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Newsletter signup — prd.md §7 Section 7.
 *
 * Validates before hitting the network, disables while in flight, and reports
 * outcome in a live region so the result is announced. An address already on
 * the list is treated as success, since telling a visitor "you are subscribed"
 * is both true and better than surfacing a database constraint.
 */
export const Newsletter = () => {
  const inputId = useId();
  const messageId = `${inputId}-message`;

  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = emailSchema.safeParse(email);

    if (!parsed.success) {
      setState('error');
      setMessage(parsed.error.issues[0]?.message ?? 'Enter a valid email address.');
      return;
    }

    setState('submitting');
    setMessage('');

    try {
      await subscribeToNewsletter(parsed.data);
      setState('success');
      setMessage('You are on the list. Watch your inbox for the next drop.');
      setEmail('');
    } catch (cause) {
      if (cause instanceof AlreadySubscribedError) {
        setState('success');
        setMessage('You are already on the list.');
        setEmail('');
        return;
      }

      setState('error');
      setMessage('We could not sign you up just now. Please try again.');
    }
  };

  return (
    <section aria-labelledby={`${inputId}-heading`} className="bg-primary py-12 md:py-16">
      <Container className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h2 id={`${inputId}-heading`} className="text-h4 text-white md:text-h2">
            Be first to the new arrivals
          </h2>
          <p className="text-base text-white/80 md:text-lg">
            Style notes and early access to every drop. No noise, unsubscribe anytime.
          </p>
        </div>

        {state === 'success' ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-card bg-white/10 px-6 py-4 text-base text-white"
          >
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {message}
          </p>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
            className="max-w-lg flex w-full flex-col gap-3 xs:flex-row"
          >
            <div className="flex-1 text-left">
              <label htmlFor={inputId} className="sr-only">
                Email address
              </label>

              <input
                id={inputId}
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (state === 'error') {
                    setState('idle');
                    setMessage('');
                  }
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={state === 'submitting'}
                aria-invalid={state === 'error'}
                aria-describedby={message === '' ? undefined : messageId}
                className="h-control w-full rounded-input border border-transparent bg-white px-4 text-base text-text placeholder:text-muted focus:border-heading disabled:opacity-70"
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              isLoading={state === 'submitting'}
              loadingLabel="Subscribing"
              className="bg-white hover:bg-primary-light"
            >
              Subscribe
            </Button>
          </form>
        )}

        {state === 'error' && message !== '' && (
          <p id={messageId} role="alert" className="text-small font-medium text-white">
            {message}
          </p>
        )}
      </Container>
    </section>
  );
};
