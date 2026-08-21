import { createHash } from 'node:crypto';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Protocol-level tests for the Airpay primitives.
 *
 * These run entirely offline — no credential, no network, no Airpay account.
 * They pin the byte-level decisions that are easy to "correct" into silent
 * failure: the MD5-hex-as-ASCII key, the ASCII IV, the sort-by-key checksum,
 * and above all the IST date, whose bug only appears between 00:00 and 05:30
 * IST and would therefore never show up in a daytime test.
 *
 * Credentials are stubbed with obvious fixtures before the module under test is
 * imported, since it reads the environment lazily on first use.
 */

const USERNAME = 'test-user';
const PASSWORD = 'test-pass';
const SECRET_KEY = 'test-secret';
const API_KEY = 'test-api-key';
const MID = 'TESTMID';

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  process.env.AIRPAY_MID = MID;
  process.env.AIRPAY_CLIENT_ID = 'test-client-id';
  process.env.AIRPAY_API_KEY = API_KEY;
  process.env.AIRPAY_SECRET_KEY = SECRET_KEY;
  process.env.AIRPAY_USERNAME = USERNAME;
  process.env.AIRPAY_PASSWORD = PASSWORD;
  process.env.AIRPAY_ENV = 'sandbox';
});

const airpay = async () => import('./airpay.js');

describe('istDate', () => {
  it('formats as YYYY-MM-DD', async () => {
    const { istDate } = await airpay();

    expect(istDate(new Date('2026-08-14T12:00:00Z'))).toBe('2026-08-14');
  });

  /*
   * The danger window. IST is UTC+05:30, so for the first 5.5 hours of every
   * IST day the UTC date still reads as the previous day. A checksum built on
   * the UTC date is rejected by Airpay for that entire window, every night.
   */
  it.each([
    ['2026-08-13T18:30:00Z', '2026-08-14', '00:00 IST — the moment the dates diverge'],
    ['2026-08-13T19:00:00Z', '2026-08-14', '00:30 IST'],
    ['2026-08-13T21:15:00Z', '2026-08-14', '02:45 IST'],
    ['2026-08-13T23:59:00Z', '2026-08-14', '05:29 IST — last minute of the window'],
    ['2026-08-14T00:00:00Z', '2026-08-14', '05:30 IST — dates realign'],
    ['2026-08-13T18:29:00Z', '2026-08-13', '23:59 IST the previous day'],
  ])('%s → %s (%s)', async (utc, expected) => {
    const { istDate } = await airpay();

    expect(istDate(new Date(utc))).toBe(expected);
  });

  it('disagrees with the naive UTC slice inside the danger window', async () => {
    const { istDate } = await airpay();
    const instant = new Date('2026-08-13T20:00:00Z'); // 01:30 IST on the 14th

    expect(istDate(instant)).toBe('2026-08-14');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-13');
    expect(istDate(instant)).not.toBe(instant.toISOString().slice(0, 10));
  });

  it('handles a month and year boundary inside the window', async () => {
    const { istDate } = await airpay();

    expect(istDate(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01');
  });
});

describe('checksum', () => {
  it('sorts by key, concatenates values only, then appends the date', async () => {
    const { checksum } = await airpay();

    const payload = { zebra: 'z', alpha: 'a', mike: 'm' };
    const expected = createHash('sha256').update('amz2026-08-14', 'utf8').digest('hex');

    expect(checksum(payload, '2026-08-14')).toBe(expected);
  });

  it('is independent of the order keys were declared in', async () => {
    const { checksum } = await airpay();

    const one = checksum({ b: '2', a: '1', c: '3' }, '2026-08-14');
    const two = checksum({ c: '3', b: '2', a: '1' }, '2026-08-14');

    expect(one).toBe(two);
  });

  it('changes when the date changes', async () => {
    const { checksum } = await airpay();

    expect(checksum({ a: '1' }, '2026-08-14')).not.toBe(checksum({ a: '1' }, '2026-08-13'));
  });

  it('coerces numbers to their string form', async () => {
    const { checksum } = await airpay();

    expect(checksum({ amount: 1499 }, '2026-08-14')).toBe(
      checksum({ amount: '1499' }, '2026-08-14'),
    );
  });
});

describe('encrypt / decrypt', () => {
  it('round-trips a payload', async () => {
    const { encrypt, decrypt } = await airpay();

    const payload = { orderid: 'YV-TEST-0001', amount: '1499.00', buyer_email: 'a@example.com' };

    expect(decrypt(encrypt(payload))).toBe(JSON.stringify(payload));
  });

  it('prefixes exactly 16 hexadecimal IV characters', async () => {
    const { encrypt } = await airpay();

    expect(encrypt({ a: '1' }).slice(0, 16)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces a different ciphertext each time, from the random IV', async () => {
    const { encrypt } = await airpay();

    expect(encrypt({ a: '1' })).not.toBe(encrypt({ a: '1' }));
  });

  /*
   * Pins the MD5-hex-as-ASCII decision. PHP's md5() returns a 32-character hex
   * string, and that string — not its 16 decoded bytes — is what reaches
   * OpenSSL, which is the only reading under which AES-256 has a valid key.
   * Hex-decoding it would halve the key to 128 bits and break interoperability
   * silently, so assert the width directly.
   */
  it('derives a 32-byte AES key from the MD5 hex string, not its decoded bytes', () => {
    const hex = createHash('md5').update(`${USERNAME}~:~${PASSWORD}`, 'utf8').digest('hex');

    expect(hex).toHaveLength(32);
    expect(Buffer.from(hex, 'ascii')).toHaveLength(32);
    expect(Buffer.from(hex, 'hex')).toHaveLength(16);
  });

  it('returns null for malformed encdata rather than throwing', async () => {
    const { decrypt } = await airpay();

    expect(decrypt('')).toBeNull();
    expect(decrypt('too-short')).toBeNull();
    expect(decrypt('0123456789abcdefnot-valid-base64!!')).toBeNull();
  });
});

describe('OAuth2 response envelope', () => {
  /*
   * Airpay v4 replies `{"response": "<16-hex IV><base64>"}`, and the token only
   * becomes readable after decrypting that envelope. The first implementation
   * read `access_token` straight off the parsed JSON and would therefore never
   * have found it — a bug that would have looked exactly like bad credentials.
   * These tests pin the real wire shape.
   */
  it('yields the documented decrypted envelope shape', async () => {
    const { encrypt, decrypt } = await airpay();

    // The exact structure documented on the OAuth2 page.
    const inner = {
      status_code: '200',
      response_code: '00',
      status: 'success',
      message: 'Success',
      data: { access_token: 'abc123token', expires_in: 300, scope: null },
    };

    const wire = { response: encrypt(inner as unknown as Record<string, string>) };
    const plaintext = decrypt(wire.response);

    expect(plaintext).not.toBeNull();
    expect(JSON.parse(plaintext as string)).toEqual(inner);
  });

  it('locates the token nested under `data`, not at the top level', async () => {
    const { encrypt, decrypt } = await airpay();

    const wire = encrypt({
      status: 'success',
      data: { access_token: 'nested-token', expires_in: 300 },
    } as unknown as Record<string, string>);

    const parsed = JSON.parse(decrypt(wire) as string) as {
      access_token?: string;
      data?: { access_token?: string };
    };

    expect(parsed.access_token).toBeUndefined();
    expect(parsed.data?.access_token).toBe('nested-token');
  });

  it('extracts the IV as the first 16 characters, per the decryption spec', async () => {
    const { encrypt } = await airpay();

    const encdata = encrypt({ a: '1' });

    expect(encdata.slice(0, 16)).toMatch(/^[0-9a-f]{16}$/);
    // Everything after the IV must be valid base64.
    expect(encdata.slice(16)).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe('token extraction tolerates the real response shape', () => {
  /*
   * Against the live gateway, Airpay returned response_code "00" / "success" —
   * an authenticated success — and the token was not where the documented
   * `data.access_token` shape said. The extractor now walks the structure, and
   * these cases pin the variants that must all resolve, since the wire format
   * cannot be re-checked without another live call.
   *
   * `getAccessToken` is exercised through a stubbed `fetch`, so no request
   * leaves the process.
   */
  const withResponse = async (payload: unknown) => {
    const { encrypt, resetTokenCache } = await airpay();

    resetTokenCache();

    const stub = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ response: encrypt(payload as Record<string, string>) }),
      } as unknown as Response),
    );

    vi.stubGlobal('fetch', stub);

    try {
      const { getAccessToken } = await airpay();

      return await getAccessToken();
    } finally {
      vi.unstubAllGlobals();
      (await airpay()).resetTokenCache();
    }
  };

  it('finds the documented data.access_token shape', async () => {
    await expect(
      withResponse({
        status: 'success',
        response_code: '00',
        data: { access_token: 'tok-documented', expires_in: 300 },
      }),
    ).resolves.toBe('tok-documented');
  });

  it('finds a top-level access_token', async () => {
    await expect(
      withResponse({ status: 'success', access_token: 'tok-top', expires_in: 300 }),
    ).resolves.toBe('tok-top');
  });

  /* The most likely real cause: `data` arrives as a JSON string, not an object. */
  it('finds a token inside a double-encoded data string', async () => {
    await expect(
      withResponse({
        status: 'success',
        data: JSON.stringify({ access_token: 'tok-stringified', expires_in: 300 }),
      }),
    ).resolves.toBe('tok-stringified');
  });

  it('finds a token nested more deeply than documented', async () => {
    await expect(
      withResponse({ status: 'success', data: { result: { access_token: 'tok-deep' } } }),
    ).resolves.toBe('tok-deep');
  });

  it('finds a token inside an array', async () => {
    await expect(
      withResponse({ status: 'success', data: [{ access_token: 'tok-array' }] }),
    ).resolves.toBe('tok-array');
  });

  it('accepts the camelCase alias', async () => {
    await expect(
      withResponse({ status: 'success', data: { accessToken: 'tok-camel' } }),
    ).resolves.toBe('tok-camel');
  });

  it('still rejects a response that genuinely carries no token', async () => {
    await expect(
      withResponse({ status: 'failure', response_code: '903', message: 'Invalid credentials' }),
    ).rejects.toThrow(/could not start a secure payment/i);
  });
});

describe('failure logging never leaks credentials', () => {
  /*
   * `describeFailure` reads a whitelist of Airpay's own status fields so an
   * OAuth failure is diagnosable. The danger it must avoid: an Airpay error can
   * echo the submitted request, and that request contains `encdata` — which
   * carries the client secret. The logger redacts by key name as a second line
   * of defence, but the first is never extracting the field at all.
   */
  it('redacts secret-shaped keys in structured logs', async () => {
    const { log } = await import('./log.js');

    const lines: string[] = [];
    const original = console.warn;
    console.warn = (line: string) => lines.push(line);

    try {
      log.warn('test.event', {
        encdata: 'SECRET-ENCDATA-VALUE',
        checksum: 'SECRET-CHECKSUM',
        client_secret: 'SECRET-CLIENT',
        token: 'SECRET-TOKEN',
        airpayResponseCode: '903',
        status: 404,
      });
    } finally {
      console.warn = original;
    }

    const emitted = lines.join('\n');

    expect(emitted).not.toContain('SECRET-ENCDATA-VALUE');
    expect(emitted).not.toContain('SECRET-CHECKSUM');
    expect(emitted).not.toContain('SECRET-CLIENT');
    expect(emitted).not.toContain('SECRET-TOKEN');

    // Diagnostic fields must survive, or the log is useless.
    expect(emitted).toContain('903');
    expect(emitted).toContain('404');
  });
});

describe('privateKey', () => {
  /*
   * The `secret` is AIRPAY_API_KEY, not AIRPAY_SECRET_KEY. Verified against the
   * live gateway: the SECRET_KEY form is refused outright ("Merchant Key
   * Authentication Failed") while the API_KEY form is recognised and advances to
   * the next check. The two credentials are the reverse of what was assumed —
   * SECRET_KEY is the OAuth client_secret — so this test pins which is which.
   */
  it('is sha256(AIRPAY_API_KEY@username:|:password)', async () => {
    const { privateKey } = await airpay();

    const expected = createHash('sha256')
      .update(`${API_KEY}@${USERNAME}:|:${PASSWORD}`, 'utf8')
      .digest('hex');

    expect(privateKey()).toBe(expected);
  });

  it('is not derived from the OAuth client secret', async () => {
    const { privateKey } = await airpay();

    const wrong = createHash('sha256')
      .update(`${SECRET_KEY}@${USERNAME}:|:${PASSWORD}`, 'utf8')
      .digest('hex');

    expect(privateKey()).not.toBe(wrong);
  });
});

describe('crc32 / verifySecureHash', () => {
  it('matches known CRC-32 vectors', async () => {
    const { crc32 } = await airpay();

    // Standard IEEE CRC-32 check values, as PHP's crc32() reports them.
    expect(crc32('')).toBe('0');
    expect(crc32('123456789')).toBe('3421780262');
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe('1095738169');
  });

  it('accepts a hash computed over the documented field order', async () => {
    const { crc32, verifySecureHash } = await airpay();

    const input = {
      transactionId: 'YV-TEST-0001',
      apTransactionId: 'AP123456',
      amount: '1499.00',
      transactionStatus: '200',
      message: 'SUCCESS',
    };

    const expected = crc32(
      ['YV-TEST-0001', 'AP123456', '1499.00', '200', 'SUCCESS', MID, USERNAME].join(':'),
    );

    expect(verifySecureHash(input, expected)).toBe(true);
  });

  it('appends the customer VPA for UPI transactions', async () => {
    const { crc32, verifySecureHash } = await airpay();

    const withoutVpa = {
      transactionId: 'YV-TEST-0002',
      apTransactionId: 'AP999',
      amount: '10.00',
      transactionStatus: '200',
      message: 'SUCCESS',
    };

    const upiHash = crc32(
      ['YV-TEST-0002', 'AP999', '10.00', '200', 'SUCCESS', MID, USERNAME, 'a@okbank'].join(':'),
    );

    expect(verifySecureHash({ ...withoutVpa, customerVpa: 'a@okbank' }, upiHash)).toBe(true);
    expect(verifySecureHash(withoutVpa, upiHash)).toBe(false);
  });

  it('rejects a tampered amount', async () => {
    const { crc32, verifySecureHash } = await airpay();

    const genuine = crc32(
      ['YV-TEST-0003', 'AP1', '10.00', '200', 'SUCCESS', MID, USERNAME].join(':'),
    );

    const tampered = {
      transactionId: 'YV-TEST-0003',
      apTransactionId: 'AP1',
      amount: '10000.00',
      transactionStatus: '200',
      message: 'SUCCESS',
    };

    expect(verifySecureHash(tampered, genuine)).toBe(false);
  });

  it('tolerates surrounding whitespace in the received hash', async () => {
    const { crc32, verifySecureHash } = await airpay();

    const input = {
      transactionId: 'YV-TEST-0004',
      apTransactionId: 'AP2',
      amount: '5.00',
      transactionStatus: '400',
      message: 'FAIL',
    };

    const hash = crc32(['YV-TEST-0004', 'AP2', '5.00', '400', 'FAIL', MID, USERNAME].join(':'));

    expect(verifySecureHash(input, `  ${hash}\n`)).toBe(true);
  });
});

/**
 * Order Confirmation — what happens when the gateway's answer is unreadable.
 *
 * This is the regression that cost a real payment. Against MID 366950 the live
 * `/verify/` endpoint replies `{"merchant_id": null, "response": "<encrypted>"}`
 * and the envelope does not open with the AES key every outbound call uses. The
 * parser then found no transaction status, reported one anyway as `null`, and
 * `settle.ts` read `null !== 200` as a definitive failure.
 *
 * `null` from this function means "no answer". A body we cannot read is exactly
 * that, and must not be dressed up as a confirmation.
 */
describe('verifyTransaction — an unreadable answer is not a failed one', () => {
  /** The OAuth leg, then the Order Confirmation leg. */
  const stubGateway = (verifyBody: unknown) => {
    const fetchMock = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: 'test-token', expires_in: 300 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(verifyBody),
      });

    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
  };

  beforeEach(async () => {
    (await airpay()).resetTokenCache();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null for an envelope it cannot decrypt', async () => {
    // Byte-for-byte the shape the live gateway returned for YV-3200A-2AB47227:
    // a well-formed envelope — 16 hex characters of IV, then block-aligned
    // base64 — encrypted under a key this code does not have.
    stubGateway({
      merchant_id: null,
      response: `509361e8503ab0a0${Buffer.from('x'.repeat(96)).toString('base64')}`,
    });

    const { verifyTransaction } = await airpay();

    await expect(verifyTransaction('YV-3200A-2AB47227')).resolves.toBeNull();
  });

  it('returns null when the body carries no transaction status at all', async () => {
    stubGateway({ merchant_id: null, message: 'something we did not model' });

    const { verifyTransaction } = await airpay();

    await expect(verifyTransaction('YV-3200A-2AB47227')).resolves.toBeNull();
  });

  it('still reads a confirmation that does state a status', async () => {
    stubGateway({
      data: {
        orderid: 'YV-3200A-2AB47227',
        ap_transactionid: '2051234202',
        amount: '81.00',
        transaction_status: '200',
        transaction_payment_status: 'SUCCESS',
      },
    });

    const { verifyTransaction } = await airpay();
    const confirmation = await verifyTransaction('YV-3200A-2AB47227');

    expect(confirmation?.transactionStatus).toBe(200);
    expect(confirmation?.amount).toBe(81);
    expect(confirmation?.apTransactionId).toBe('2051234202');
  });
});
