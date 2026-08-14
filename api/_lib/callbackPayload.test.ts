import type { VercelRequest } from '@vercel/node';

import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Callback parsing tests.
 *
 * This parser is the only thing standing between a public, unauthenticated URL
 * and the settlement logic, so what matters is that it handles every documented
 * shape and refuses everything else without throwing. A parser that throws on
 * malformed input would turn a junk POST into a 500 and, with retries, noise.
 */

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE = 'test-service-role';
  process.env.AIRPAY_MID = 'TESTMID';
  process.env.AIRPAY_CLIENT_ID = 'test-client-id';
  process.env.AIRPAY_API_KEY = 'test-api-key';
  process.env.AIRPAY_SECRET_KEY = 'test-secret';
  process.env.AIRPAY_USERNAME = 'test-user';
  process.env.AIRPAY_PASSWORD = 'test-pass';
  process.env.AIRPAY_ENV = 'live';
});

const request = (body: unknown, query: unknown = {}): VercelRequest =>
  ({ body, query, method: 'POST', headers: {} }) as VercelRequest;

const parse = async () => (await import('./callbackPayload.js')).parseCallback;

describe('parseCallback', () => {
  it('reads the documented uppercase field names', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request({
        TRANSACTIONID: 'YV-ABC-0001',
        APTRANSACTIONID: 'AP999',
        AMOUNT: '1499.00',
        TRANSACTIONSTATUS: '200',
        MESSAGE: 'SUCCESS',
        ap_SecureHash: '123456',
      }),
    );

    expect(result).toEqual({
      orderRef: 'YV-ABC-0001',
      apTransactionId: 'AP999',
      amount: '1499.00',
      transactionStatus: '200',
      message: 'SUCCESS',
      secureHash: '123456',
      customerVpa: undefined,
    });
  });

  it('reads lowercase and snake_case variants', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request({
        orderid: 'YV-ABC-0002',
        ap_transactionid: 'AP1',
        amount: '10.00',
        transaction_status: '400',
        message: 'FAIL',
        ap_securehash: '77',
      }),
    );

    expect(result?.orderRef).toBe('YV-ABC-0002');
    expect(result?.transactionStatus).toBe('400');
    expect(result?.secureHash).toBe('77');
  });

  it('captures the customer VPA for UPI payloads', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request({ TRANSACTIONID: 'YV-ABC-0003', CUSTOMERVPA: 'someone@okbank' }),
    );

    expect(result?.customerVpa).toBe('someone@okbank');
  });

  it('accepts the return leg arriving as query parameters', async () => {
    const parseCallback = await parse();

    const result = parseCallback(request(undefined, { TRANSACTIONID: 'YV-ABC-0004' }));

    expect(result?.orderRef).toBe('YV-ABC-0004');
  });

  it('lets the body win over the query string', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request({ TRANSACTIONID: 'from-body' }, { TRANSACTIONID: 'from-query' }),
    );

    expect(result?.orderRef).toBe('from-body');
  });

  it('decrypts an encdata envelope', async () => {
    const { encrypt } = await import('./airpay.js');
    const parseCallback = await parse();

    const encdata = encrypt({
      TRANSACTIONID: 'YV-ENC-0001',
      AMOUNT: '2500.00',
      TRANSACTIONSTATUS: '200',
    });

    const result = parseCallback(request({ encdata }));

    expect(result?.orderRef).toBe('YV-ENC-0001');
    expect(result?.amount).toBe('2500.00');
  });

  /*
   * An attacker must not be able to pair a genuine captured `encdata` with
   * plaintext fields of their own, so decrypted content replaces the outer
   * fields wholesale rather than merging with them.
   */
  it('does not let outer plaintext fields survive alongside encdata', async () => {
    const { encrypt } = await import('./airpay.js');
    const parseCallback = await parse();

    const encdata = encrypt({ TRANSACTIONID: 'YV-ENC-0002', AMOUNT: '5.00' });

    const result = parseCallback(request({ encdata, AMOUNT: '999999.00', MESSAGE: 'SUCCESS' }));

    expect(result?.amount).toBe('5.00');
    expect(result?.message).toBe('');
  });

  it('returns null when there is no order reference', async () => {
    const parseCallback = await parse();

    expect(parseCallback(request({ AMOUNT: '10.00' }))).toBeNull();
  });

  it('returns null rather than throwing on junk', async () => {
    const parseCallback = await parse();

    expect(parseCallback(request(undefined))).toBeNull();
    expect(parseCallback(request('not-an-object'))).toBeNull();
    expect(parseCallback(request(null))).toBeNull();
    expect(parseCallback(request([1, 2, 3]))).toBeNull();
  });

  it('ignores non-primitive field values instead of coercing them', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request({ TRANSACTIONID: 'YV-ABC-0005', AMOUNT: { nested: 'object' } }),
    );

    expect(result?.orderRef).toBe('YV-ABC-0005');
    expect(result?.amount).toBe('');
  });
});
