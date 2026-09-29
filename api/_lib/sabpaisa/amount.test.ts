import { describe, expect, it } from 'vitest';

import {
  paiseToRupees,
  parseEnquiryPaise,
  parseReturnRupeesToPaise,
  rupeesToPaise,
} from './amount.js';

/**
 * The rupees/paise contract.
 *
 * SabPaisa PG 3.0 speaks two units, and mixing them is a 100× money bug:
 *
 *   Create Payment      amount                  PAISE
 *   Transaction Enquiry amountPaise             PAISE
 *   Return URL          amount / paid_amount    RUPEES
 *
 * These tests exist so that conversion cannot silently regress.
 */

describe('the ₹1.00 worked example from the integration brief', () => {
  it('is 100 paise to Create Payment, 100 from Enquiry, and "1.00" on the return', () => {
    const expectedPaise = rupeesToPaise(1);

    expect(expectedPaise).toBe(100);
    // What Enquiry sends back for the same payment.
    expect(parseEnquiryPaise(100)).toBe(100);
    // What the return URL sends back for the same payment — in RUPEES.
    expect(parseReturnRupeesToPaise('1.00')).toBe(100);

    // All three agree once, and only once, they are in the same unit.
    expect(parseEnquiryPaise(100)).toBe(expectedPaise);
    expect(parseReturnRupeesToPaise('1.00')).toBe(expectedPaise);
  });

  it('would mismatch by 100x if the return rupees were compared unconverted', () => {
    // The bug this module prevents: reading "1.00" as if it were paise.
    expect(Number('1.00')).not.toBe(rupeesToPaise(1));
  });
});

describe('rupeesToPaise', () => {
  it('converts a realistic order total', () => {
    expect(rupeesToPaise(1499)).toBe(149_900);
    expect(rupeesToPaise(1499.5)).toBe(149_950);
    expect(rupeesToPaise(79)).toBe(7_900);
  });

  it('rounds rather than truncating, so a paisa is never lost to floating point', () => {
    // 1.15 * 100 is 114.99999999999999 in IEEE-754. Truncation would undercharge.
    expect(rupeesToPaise(1.15)).toBe(115);
    expect(rupeesToPaise(2.675)).toBe(268);
  });

  it('refuses a negative, non-finite or absurd amount', () => {
    expect(() => rupeesToPaise(-1)).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.NaN)).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => rupeesToPaise(2_000_000_000)).toThrow(RangeError);
  });
});

describe('paiseToRupees', () => {
  it('round-trips a converted amount', () => {
    expect(paiseToRupees(rupeesToPaise(1499.5))).toBe(1499.5);
  });

  it('refuses a fractional paisa, which cannot be a real amount', () => {
    expect(() => paiseToRupees(100.5)).toThrow(RangeError);
  });
});

describe('parseReturnRupeesToPaise', () => {
  it('accepts the decimal-string forms SabPaisa actually sends', () => {
    expect(parseReturnRupeesToPaise('1')).toBe(100);
    expect(parseReturnRupeesToPaise('1.5')).toBe(150);
    expect(parseReturnRupeesToPaise('1499.00')).toBe(149_900);
    expect(parseReturnRupeesToPaise(' 1499.00 ')).toBe(149_900);
  });

  it('returns null for an absent amount rather than treating it as zero', () => {
    // Number('') is 0, which would turn a missing amount into a free order.
    expect(parseReturnRupeesToPaise(undefined)).toBeNull();
    expect(parseReturnRupeesToPaise('')).toBeNull();
  });

  it('rejects malformed and hostile input', () => {
    expect(parseReturnRupeesToPaise('abc')).toBeNull();
    expect(parseReturnRupeesToPaise('1.2.3')).toBeNull();
    expect(parseReturnRupeesToPaise('-1.00')).toBeNull();
    expect(parseReturnRupeesToPaise('1e3')).toBeNull();
    expect(parseReturnRupeesToPaise('NaN')).toBeNull();
  });

  it('rejects a third decimal place rather than rounding it away silently', () => {
    expect(parseReturnRupeesToPaise('1.005')).toBeNull();
  });
});

describe('parseEnquiryPaise', () => {
  it('accepts an integer, as a number or a numeric string', () => {
    expect(parseEnquiryPaise(149_900)).toBe(149_900);
    expect(parseEnquiryPaise('149900')).toBe(149_900);
    expect(parseEnquiryPaise(0)).toBe(0);
  });

  it('rejects anything that cannot be a paise count', () => {
    expect(parseEnquiryPaise(100.5)).toBeNull();
    expect(parseEnquiryPaise('1499.00')).toBeNull();
    expect(parseEnquiryPaise(-100)).toBeNull();
    expect(parseEnquiryPaise(null)).toBeNull();
    expect(parseEnquiryPaise(undefined)).toBeNull();
    expect(parseEnquiryPaise({})).toBeNull();
  });
});
