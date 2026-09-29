import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPaymentChecksum,
  generateMerchantTxnId,
  nowInSeconds,
  returnSignatureBase,
  RETURN_SIGNED_PARAMS,
  verifyReturnSignature,
  type ReturnSignedParam,
} from './crypto.js';
import { resetSabPaisaEnvCache } from './env.js';

/**
 * Checksum and signature verification.
 *
 * No network is touched here, and no real credential: the secret below is a
 * fixture, and the expected digests are computed independently in the test from
 * the documented canonical strings rather than copied from the implementation.
 */

const SECRET = 'test-secret-key-not-a-real-credential';

/** A complete, well-formed set of return parameters. */
const RETURN_PARAMS: Record<ReturnSignedParam, string> = {
  amount: '1499.00',
  merchant_txn_id: 'YVSP-ABC123-DEADBEEF01',
  paid_amount: '1499.00',
  payment_mode: 'UPI',
  status: 'SUCCESS',
  timestamp: '1758000000000',
  transaction_id: 'SP1234567890',
};

/** Signs a parameter set the way the documentation describes. */
const sign = (params: Record<ReturnSignedParam, string>): string =>
  createHmac('sha256', SECRET).update(returnSignatureBase(params), 'utf8').digest('hex');

beforeEach(() => {
  process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
  process.env.SABPAISA_MERCHANT_ID = 'TESTMI';
  process.env.SABPAISA_API_KEY = 'test-api-key';
  process.env.SABPAISA_SECRET_KEY = SECRET;
  process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';
  resetSabPaisaEnvCache();
});

afterEach(() => {
  resetSabPaisaEnvCache();
});

describe('createPaymentChecksum', () => {
  it('signs the documented canonical string merchantId|merchantTxnId|amount|currency|timestamp', () => {
    const expected = createHmac('sha256', SECRET)
      .update('TESTMI|YVSP-1|149900|INR|1758000000', 'utf8')
      .digest('hex');

    expect(
      createPaymentChecksum({
        merchantId: 'TESTMI',
        merchantTxnId: 'YVSP-1',
        amountPaise: 149_900,
        currency: 'INR',
        timestampSeconds: 1_758_000_000,
      }),
    ).toBe(expected);
  });

  it('changes when the timestamp changes, so a checksum cannot be reused', () => {
    const base = {
      merchantId: 'TESTMI',
      merchantTxnId: 'YVSP-1',
      amountPaise: 149_900,
      currency: 'INR',
    };

    expect(createPaymentChecksum({ ...base, timestampSeconds: 1_758_000_000 })).not.toBe(
      createPaymentChecksum({ ...base, timestampSeconds: 1_758_000_001 }),
    );
  });

  it('changes when the amount changes, so the signed amount is binding', () => {
    const base = {
      merchantId: 'TESTMI',
      merchantTxnId: 'YVSP-1',
      currency: 'INR',
      timestampSeconds: 1_758_000_000,
    };

    expect(createPaymentChecksum({ ...base, amountPaise: 149_900 })).not.toBe(
      createPaymentChecksum({ ...base, amountPaise: 100 }),
    );
  });
});

describe('nowInSeconds', () => {
  it('returns UNIX SECONDS, not milliseconds', () => {
    const seconds = nowInSeconds();
    const millis = Date.now();

    expect(Number.isInteger(seconds)).toBe(true);
    // A milliseconds value would be ~1000x larger and read as a date ~50,000
    // years in the future, which SabPaisa's freshness window rejects.
    expect(seconds).toBeLessThan(millis / 100);
    expect(Math.abs(seconds - Math.floor(millis / 1000))).toBeLessThanOrEqual(1);
  });
});

describe('returnSignatureBase', () => {
  it('joins the seven params alphabetically as key=value with a pipe', () => {
    expect(returnSignatureBase(RETURN_PARAMS)).toBe(
      'amount=1499.00|merchant_txn_id=YVSP-ABC123-DEADBEEF01|paid_amount=1499.00|payment_mode=UPI|status=SUCCESS|timestamp=1758000000000|transaction_id=SP1234567890',
    );
  });

  it('covers exactly the seven non-signature parameters', () => {
    expect([...RETURN_SIGNED_PARAMS]).toEqual([
      'amount',
      'merchant_txn_id',
      'paid_amount',
      'payment_mode',
      'status',
      'timestamp',
      'transaction_id',
    ]);
    expect(RETURN_SIGNED_PARAMS).not.toContain('signature');
  });
});

describe('verifyReturnSignature', () => {
  it('accepts a correctly signed return', () => {
    expect(verifyReturnSignature(RETURN_PARAMS, sign(RETURN_PARAMS))).toBe(true);
  });

  it('accepts an uppercase hex signature', () => {
    expect(verifyReturnSignature(RETURN_PARAMS, sign(RETURN_PARAMS).toUpperCase())).toBe(true);
  });

  it('rejects a tampered status — the whole point of the signature', () => {
    const signature = sign(RETURN_PARAMS);

    expect(verifyReturnSignature({ ...RETURN_PARAMS, status: 'SUCCESS' }, signature)).toBe(true);
    // An attacker flipping FAILED to SUCCESS cannot re-sign it.
    expect(verifyReturnSignature({ ...RETURN_PARAMS, status: 'FAILED' }, signature)).toBe(false);
  });

  it('rejects a tampered amount', () => {
    const signature = sign(RETURN_PARAMS);

    expect(verifyReturnSignature({ ...RETURN_PARAMS, paid_amount: '1.00' }, signature)).toBe(false);
  });

  it('rejects a tampered merchant reference', () => {
    const signature = sign(RETURN_PARAMS);

    expect(
      verifyReturnSignature({ ...RETURN_PARAMS, merchant_txn_id: 'YVSP-SOMEONE-ELSE' }, signature),
    ).toBe(false);
  });

  it('rejects a signature signed with the wrong key', () => {
    const forged = createHmac('sha256', 'wrong-key')
      .update(returnSignatureBase(RETURN_PARAMS), 'utf8')
      .digest('hex');

    expect(verifyReturnSignature(RETURN_PARAMS, forged)).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    expect(verifyReturnSignature(RETURN_PARAMS, '')).toBe(false);
    expect(verifyReturnSignature(RETURN_PARAMS, 'not-hex')).toBe(false);
    // Right alphabet, wrong length — timingSafeEqual would throw on this.
    expect(verifyReturnSignature(RETURN_PARAMS, 'ab'.repeat(10))).toBe(false);
    expect(verifyReturnSignature(RETURN_PARAMS, 'f'.repeat(63))).toBe(false);
    expect(verifyReturnSignature(RETURN_PARAMS, 'f'.repeat(65))).toBe(false);
  });
});

describe('generateMerchantTxnId', () => {
  it('mints a fresh reference every time, so no attempt reuses one', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateMerchantTxnId()));

    expect(seen.size).toBe(500);
  });

  it('is prefixed and long enough not to be guessable', () => {
    const id = generateMerchantTxnId();

    expect(id).toMatch(/^YVSP-[0-9A-Z]{1,6}-[0-9A-F]{10}$/);
  });
});
