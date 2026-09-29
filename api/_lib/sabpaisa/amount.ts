/**
 * Money units — the one place rupees and paise are allowed to meet.
 *
 * SabPaisa PG 3.0 is not consistent about units, and the inconsistency is not
 * documented in one place, so it is stated here once:
 *
 *   Create Payment      `amount`                    PAISE   (integer)
 *   Transaction Enquiry `amountPaise`               PAISE   (integer)
 *   Return URL          `amount`, `paid_amount`     RUPEES  (decimal string)
 *
 * A ₹1.00 payment is therefore `100`, `100` and `"1.00"` across the three.
 * Comparing any two of those without converting is a money bug that looks like
 * a 100× discrepancy, and `amount.test.ts` exists to prove the conversion holds.
 *
 * Every comparison in the settlement path happens in paise, as an integer.
 * Floats never decide whether a customer has paid.
 */

/** Largest amount we will represent, as a guard against absurd inputs. */
const MAX_PAISE = 100_000_000_000;

/**
 * Rupees → paise.
 *
 * `Math.round` rather than truncation: `1.15 * 100` is `114.99999999999999` in
 * IEEE-754, and truncating would quietly undercharge by a paisa.
 */
export const rupeesToPaise = (rupees: number): number => {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new RangeError('rupees must be a finite, non-negative number');
  }

  const paise = Math.round(rupees * 100);

  if (paise > MAX_PAISE) {
    throw new RangeError('amount exceeds the supported maximum');
  }

  return paise;
};

/** Paise → rupees. Display and logging only; never a comparison. */
export const paiseToRupees = (paise: number): number => {
  if (!Number.isInteger(paise) || paise < 0) {
    throw new RangeError('paise must be a non-negative integer');
  }

  return paise / 100;
};

/**
 * Parses a RUPEES value as it arrives on the return URL — a decimal string
 * such as `"1.00"` or `"1499.50"` — into paise.
 *
 * Returns `null` rather than throwing, and rather than coercing: this parses
 * untrusted query input, where `""`, `"abc"`, `NaN` and `"1.2.3"` are all
 * expected. `Number('')` is `0`, which would turn a missing amount into a
 * free order, so the shape is validated before the conversion.
 */
export const parseReturnRupeesToPaise = (value: string | undefined): number | null => {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  // At most two decimal places: a third would mean SabPaisa sent a precision we
  // cannot represent in paise, and silently rounding it away is not our call.
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  try {
    return rupeesToPaise(Number(trimmed));
  } catch {
    return null;
  }
};

/**
 * Parses a PAISE value as it arrives from Transaction Enquiry.
 *
 * Accepts a number or a numeric string — JSON APIs are inconsistent about
 * which, and a large integer is sometimes serialised as a string — but insists
 * on an integer either way. A fractional "paise" means the field is not what we
 * think it is, and guessing would be worse than refusing.
 */
export const parseEnquiryPaise = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= MAX_PAISE ? value : null;
  }

  if (typeof value === 'string' && /^\d{1,15}$/.test(value.trim())) {
    const parsed = Number(value.trim());

    return parsed <= MAX_PAISE ? parsed : null;
  }

  return null;
};
