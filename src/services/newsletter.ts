import { supabase } from '@/lib/supabase';

/** Raised when the address is already on the list — a success, not a failure. */
export class AlreadySubscribedError extends Error {
  constructor() {
    super('This email is already subscribed.');
    this.name = 'AlreadySubscribedError';
  }
}

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = '23505';

/** Adds an address to the newsletter list. */
export const subscribeToNewsletter = async (email: string): Promise<void> => {
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: email.trim().toLowerCase() });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new AlreadySubscribedError();
    }

    throw new Error(`Subscription failed: ${error.message}`);
  }
};
