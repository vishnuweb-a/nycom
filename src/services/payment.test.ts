import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redirectToSabPaisa, resetSabPaisaHandoffLatch } from './payment';
import type { AddressFormValues } from '@/pages/Checkout/addressSchema';
import type { CartItem } from '@/types/cart';

/**
 * Duplicate-session protection on the SabPaisa handoff.
 *
 * The failure this guards against is specific and expensive: two clicks a
 * fraction of a second apart, each POSTing to `/api/payments/sabpaisa/create`,
 * each minting a fresh `merchantTxnId` server-side — two payable sessions for
 * one customer action, and a customer who can be charged twice.
 *
 * The latch is a UX guard, not the integrity boundary. These tests pin its two
 * halves: it must suppress the fumbled double-click, and it must NOT suppress a
 * deliberate retry minutes later, which would leave the shopper with a Pay
 * button that silently does nothing.
 *
 * The test environment is `node`, so `document` and `window` are stubbed to the
 * narrow surface the function actually uses. `form.submit()` is a no-op here —
 * exactly the point, since a real submit would navigate.
 */

const ITEMS = [
  { productId: '11111111-1111-4111-8111-111111111111', selectedSize: 'M', quantity: 2 },
] as unknown as readonly CartItem[];

const ADDRESS = {
  firstName: 'Asha',
  lastName: 'Rao',
  phone: '9876543210',
  email: 'asha@example.com',
  address: '12 Residency Road',
  landmark: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560025',
} satisfies AddressFormValues;

/** Records every form that reaches `submit()`. One entry = one payable session. */
let submitted: { action: string; payload: string }[] = [];

/**
 * The one submission a case expects, asserted to exist before it is read.
 *
 * Keeps the "exactly one session" expectation in the assertion rather than in
 * a non-null assertion operator that would hide a zero-submission regression.
 */
const onlySubmission = (): { action: string; payload: string } => {
  expect(submitted).toHaveLength(1);

  const [first] = submitted;

  if (first === undefined) {
    throw new Error('expected one submission');
  }

  return first;
};

/** The narrow slice of an element the handoff actually touches. */
interface StubElement {
  tagName: string;
  style: Record<string, string>;
  action: string;
  method: string;
  type: string;
  name: string;
  value: string;
  children: StubElement[];
  append: (child: StubElement) => void;
  submit: () => void;
}

const stubDom = (): void => {
  const makeElement = (tag: string): StubElement => {
    const element: StubElement = {
      tagName: tag.toUpperCase(),
      style: {},
      action: '',
      method: '',
      type: '',
      name: '',
      value: '',
      children: [],
      append(child) {
        element.children.push(child);
      },
      submit() {
        const [input] = element.children;

        submitted.push({
          action: element.action,
          payload: input?.value ?? '',
        });
      },
    };

    return element;
  };

  vi.stubGlobal('document', {
    createElement: (tag: string) => makeElement(tag),
    body: { append: () => undefined },
  });
};

beforeEach(() => {
  submitted = [];
  resetSabPaisaHandoffLatch();
  vi.useFakeTimers();
  stubDom();
  // The real `window.setTimeout` is replaced by the fake-timer clock.
  vi.stubGlobal('window', { setTimeout: globalThis.setTimeout.bind(globalThis) });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the fumbled double-click', () => {
  it('creates exactly one payable session from two immediate clicks', () => {
    const first = redirectToSabPaisa(ITEMS, ADDRESS);
    const second = redirectToSabPaisa(ITEMS, ADDRESS);

    expect(first).toBe(true);
    // The second click is swallowed, and says so, so the caller can leave its
    // own UI state alone rather than showing a second "processing".
    expect(second).toBe(false);

    // The assertion that matters: one submit, therefore one merchantTxnId.
    expect(submitted).toHaveLength(1);
  });

  it('suppresses a burst of clicks, not just the second', () => {
    const outcomes = Array.from({ length: 6 }, () => redirectToSabPaisa(ITEMS, ADDRESS));

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(submitted).toHaveLength(1);
  });
});

describe('the deliberate retry', () => {
  it('is allowed once the handoff window has passed', () => {
    expect(redirectToSabPaisa(ITEMS, ADDRESS)).toBe(true);
    expect(redirectToSabPaisa(ITEMS, ADDRESS)).toBe(false);

    // The shopper cancelled at the gateway and came back.
    vi.advanceTimersByTime(10_000);

    /*
     * A new attempt must go through. A permanently latched module would leave
     * the Pay button inert until a full page reload, which reads as a broken
     * checkout — and the previous session is dead anyway, so this correctly
     * mints a fresh reference rather than reusing an ambiguous one.
     */
    expect(redirectToSabPaisa(ITEMS, ADDRESS)).toBe(true);
    expect(submitted).toHaveLength(2);
  });

  it('is still suppressed just before the window closes', () => {
    redirectToSabPaisa(ITEMS, ADDRESS);

    vi.advanceTimersByTime(9_000);

    expect(redirectToSabPaisa(ITEMS, ADDRESS)).toBe(false);
    expect(submitted).toHaveLength(1);
  });
});

describe('what is sent to our own server', () => {
  it('posts to the SabPaisa create endpoint, not to SabPaisa directly', () => {
    redirectToSabPaisa(ITEMS, ADDRESS);

    // Our own origin. The browser never posts an order to the gateway, and
    // never holds a credential or a client secret to do so.
    expect(onlySubmission().action).toBe('/api/payments/sabpaisa/create');
  });

  it('sends no price, subtotal or total — the server re-prices', () => {
    redirectToSabPaisa(ITEMS, ADDRESS);

    const submission = onlySubmission();
    const payload = JSON.parse(submission.payload) as {
      items: Record<string, unknown>[];
      address: Record<string, unknown>;
    };

    expect(payload.items).toEqual([
      {
        productId: '11111111-1111-4111-8111-111111111111',
        size: 'M',
        quantity: 2,
      },
    ]);

    /*
     * The security property, asserted rather than assumed: there is nowhere in
     * this payload for the browser to state what it thinks the order costs.
     */
    expect(submission.payload).not.toMatch(/price|subtotal|grandTotal|amount/i);
  });
});
