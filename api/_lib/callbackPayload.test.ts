import { Readable } from 'node:stream';

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

/**
 * Raw-body and field-preservation tests.
 *
 * Vercel parses `req.body` into an object only for the content types it
 * recognises. Anything else — `text/plain`, an unexpected charset suffix, a
 * missing header — arrives as a string or Buffer, and used to flatten to
 * nothing. A dropped callback is a delayed settlement, so these cover the
 * shapes that do not depend on Airpay sending a header we do not control.
 *
 * The second group covers `fields`, the verbatim record the KKChat relay
 * forwards. It must keep Airpay's casing and string values exactly as received.
 */
describe('parseCallback — bodies the platform did not parse', () => {
  it('decodes a form-urlencoded body delivered as a raw string', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request('TRANSACTIONID=YV-RAW-0001&AMOUNT=2.00&TRANSACTIONSTATUS=200'),
    );

    expect(result?.orderRef).toBe('YV-RAW-0001');
    expect(result?.amount).toBe('2.00');
    expect(result?.transactionStatus).toBe('200');
  });

  it('decodes a JSON body delivered as a raw string', async () => {
    const parseCallback = await parse();

    const result = parseCallback(
      request(JSON.stringify({ TRANSACTIONID: 'YV-RAW-0002', AMOUNT: '7.50' })),
    );

    expect(result?.orderRef).toBe('YV-RAW-0002');
    expect(result?.amount).toBe('7.50');
  });

  it('decodes a body delivered as a Buffer', async () => {
    const parseCallback = await parse();

    const result = parseCallback(request(Buffer.from('TRANSACTIONID=YV-RAW-0003&AMOUNT=9.00')));

    expect(result?.orderRef).toBe('YV-RAW-0003');
    expect(result?.amount).toBe('9.00');
  });

  it('url-decodes percent-encoded values in a raw form body', async () => {
    const parseCallback = await parse();

    const result = parseCallback(request('TRANSACTIONID=YV-RAW-0004&MESSAGE=Payment%20Successful'));

    expect(result?.message).toBe('Payment Successful');
  });

  it('still returns null for a raw body carrying no reference', async () => {
    const parseCallback = await parse();

    expect(parseCallback(request('just-some-garbage'))).toBeNull();
    expect(parseCallback(request(''))).toBeNull();
  });
});

describe('parseCallbackEnvelope — fields forwarded to the relay', () => {
  const envelope = async () => (await import('./callbackPayload.js')).parseCallbackEnvelope;

  it('preserves every field with its original casing and string value', async () => {
    const parseCallbackEnvelope = await envelope();

    const fields = {
      MERCID: '366751',
      TRANSACTIONSTATUS: '200',
      TRANSACTIONID: 'YV-FWD-0001',
      APTRANSACTIONID: 'AP1234',
      AMOUNT: '2.00',
    };

    const result = parseCallbackEnvelope(request(fields));

    expect(result?.fields).toEqual(fields);
  });

  it('keeps fields the normalised payload has no slot for', async () => {
    const parseCallbackEnvelope = await envelope();

    const result = parseCallbackEnvelope(
      request({ TRANSACTIONID: 'YV-FWD-0002', MERCID: '366751', CUSTOM_GATEWAY_FIELD: 'kept' }),
    );

    // MERCID is not part of CallbackPayload, but the relay contract needs it.
    expect(result?.fields.MERCID).toBe('366751');
    expect(result?.fields.CUSTOM_GATEWAY_FIELD).toBe('kept');
  });

  it('forwards the decrypted plaintext, never the encdata blob', async () => {
    const { encrypt } = await import('./airpay.js');
    const parseCallbackEnvelope = await envelope();

    const encdata = encrypt({ TRANSACTIONID: 'YV-FWD-0003', AMOUNT: '4.00', MERCID: '366751' });

    const result = parseCallbackEnvelope(request({ encdata }));

    expect(result?.fields).toEqual({
      TRANSACTIONID: 'YV-FWD-0003',
      AMOUNT: '4.00',
      MERCID: '366751',
    });
    expect(result?.fields.encdata).toBeUndefined();
  });

  it('does not coerce numeric-looking values away from strings', async () => {
    const parseCallbackEnvelope = await envelope();

    const result = parseCallbackEnvelope(
      request({ TRANSACTIONID: 'YV-FWD-0004', TRANSACTIONSTATUS: 200, AMOUNT: '2.00' }),
    );

    // Airpay sends strings; a numeric arriving over the wire is stringified so
    // the relay reproduces the documented shape rather than a typed variant.
    expect(result?.fields.TRANSACTIONSTATUS).toBe('200');
    expect(typeof result?.fields.AMOUNT).toBe('string');
  });
});

/**
 * The failure this suite exists to prevent, reproduced from the platform's own
 * rules rather than from a guess.
 *
 * Vercel's `getBodyParser` populates `req.body` for exactly four content types
 * — json, x-www-form-urlencoded, text/plain and octet-stream — and returns
 * `undefined` for every other, leaving the request stream unread. A missing
 * header is normalised to text/plain, so it is specifically a *present but
 * unrecognised* type that yields nothing, and `multipart/form-data` is the one
 * such type a payment gateway plausibly posts.
 *
 * The requests below are real readable streams with `body` undefined, which is
 * precisely what the handler receives in production. Every earlier "raw body"
 * test passed a string in `req.body` — a real case, but not this one, and the
 * reason the gap survived a full audit.
 */
describe('callbacks the platform hands over unparsed', () => {
  const BOUNDARY = '----AirpayFormBoundary7MA4YWxkTrZu0gW';

  /** Builds a multipart body of simple named text fields. */
  const multipart = (fields: Record<string, string>, boundary = BOUNDARY): string =>
    `${Object.entries(fields)
      .map(
        ([name, value]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      )
      .join('')}--${boundary}--\r\n`;

  /** A request whose body exists only in the stream, as Vercel delivers it. */
  const streamed = (raw: string, contentType?: string): VercelRequest => {
    const stream = Readable.from([Buffer.from(raw, 'utf8')]);

    return Object.assign(stream, {
      body: undefined,
      query: {},
      method: 'POST',
      headers: contentType === undefined ? {} : { 'content-type': contentType },
    }) as unknown as VercelRequest;
  };

  const read = async (req: VercelRequest) => {
    const { hydrateRequestBody, parseCallbackEnvelope } = await import('./callbackPayload.js');

    await hydrateRequestBody(req);

    return parseCallbackEnvelope(req);
  };

  const CALLBACK = {
    MERCID: 'TESTMID',
    TRANSACTIONID: 'YV-ABJ5T-3C1DDCEF',
    APTRANSACTIONID: '2051234999',
    AMOUNT: '83.00',
    TRANSACTIONSTATUS: '200',
    MESSAGE: 'Transaction Successful',
    CUSTOMERVPA: 'someone@okbank',
    ap_SecureHash: '1234567890',
  } as const;

  it('reads a multipart callback that arrives with body undefined', async () => {
    const result = await read(
      streamed(multipart(CALLBACK), `multipart/form-data; boundary=${BOUNDARY}`),
    );

    expect(result?.payload.orderRef).toBe('YV-ABJ5T-3C1DDCEF');
    expect(result?.payload.amount).toBe('83.00');
    expect(result?.payload.transactionStatus).toBe('200');
    expect(result?.payload.apTransactionId).toBe('2051234999');
    expect(result?.payload.message).toBe('Transaction Successful');
    expect(result?.payload.customerVpa).toBe('someone@okbank');
    expect(result?.payload.secureHash).toBe('1234567890');
  });

  it('preserves the original casing for the relay', async () => {
    const result = await read(
      streamed(multipart(CALLBACK), `multipart/form-data; boundary=${BOUNDARY}`),
    );

    // The relay forwards these verbatim; a normalised rewrite would change what
    // KKChat has always received.
    expect(result?.fields).toEqual({ ...CALLBACK });
  });

  it('accepts a quoted boundary in the content type', async () => {
    const result = await read(
      streamed(multipart(CALLBACK), `multipart/form-data; boundary="${BOUNDARY}"`),
    );

    expect(result?.payload.orderRef).toBe('YV-ABJ5T-3C1DDCEF');
  });

  /* The delimiter is in the payload either way, so a lost header is survivable. */
  it('recovers the boundary from the body when the header does not carry one', async () => {
    const result = await read(streamed(multipart(CALLBACK), 'multipart/form-data'));

    expect(result?.payload.orderRef).toBe('YV-ABJ5T-3C1DDCEF');
  });

  it('reads a form-urlencoded callback that arrives only in the stream', async () => {
    const result = await read(
      streamed(
        'TRANSACTIONID=YV-STREAM-0001&AMOUNT=5.00&TRANSACTIONSTATUS=200',
        'application/x-www-form-urlencoded',
      ),
    );

    expect(result?.payload.orderRef).toBe('YV-STREAM-0001');
    expect(result?.payload.amount).toBe('5.00');
  });

  it('reads a JSON callback that arrives only in the stream', async () => {
    const result = await read(
      streamed(JSON.stringify({ TRANSACTIONID: 'YV-STREAM-0002' }), 'application/json'),
    );

    expect(result?.payload.orderRef).toBe('YV-STREAM-0002');
  });

  /*
   * A multipart body run through URLSearchParams does not throw — it yields one
   * nonsense key. That would look like a parsed callback with no reference, and
   * is why multipart is tried before the form decoding rather than after.
   */
  it('does not mistake a multipart body for a urlencoded one', async () => {
    const result = await read(streamed(multipart({ TRANSACTIONID: 'YV-STREAM-0003' })));

    expect(result?.payload.orderRef).toBe('YV-STREAM-0003');
  });

  it('never overwrites a body the platform already parsed', async () => {
    const { hydrateRequestBody } = await import('./callbackPayload.js');
    const req = streamed('TRANSACTIONID=FROM-STREAM', 'application/x-www-form-urlencoded');

    (req as { body: unknown }).body = { TRANSACTIONID: 'FROM-PLATFORM' };

    await hydrateRequestBody(req);

    expect((req as { body: { TRANSACTIONID: string } }).body.TRANSACTIONID).toBe('FROM-PLATFORM');
  });

  it('still refuses a streamed body carrying no order reference', async () => {
    expect(await read(streamed('just-some-garbage', 'multipart/form-data'))).toBeNull();
    expect(await read(streamed('', 'multipart/form-data'))).toBeNull();
  });

  it('does not throw on a stream that yields nothing', async () => {
    const { hydrateRequestBody } = await import('./callbackPayload.js');
    const req = streamed('', 'multipart/form-data');

    await expect(hydrateRequestBody(req)).resolves.toBeUndefined();
  });
});

/**
 * The diagnostics attached to `payment.callback.unparseable`.
 *
 * The line previously carried only the leg and the method, which cannot
 * separate a body that never arrived from an envelope that would not decrypt
 * from field names we do not recognise. On a live gateway each wrong guess
 * costs another real payment to observe, so the shape is logged — names and
 * counts only, never a value, because the values are a customer's phone,
 * email and VPA.
 */
describe('describeCallbackRequest', () => {
  it('reports the content type, body shape and field names', async () => {
    const { describeCallbackRequest } = await import('./callbackPayload.js');

    const fields = describeCallbackRequest({
      body: 'TRANSACTIONID=YV-1&CUSTOMEREMAIL=someone@example.com',
      query: { ref: 'YV-1' },
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    } as unknown as VercelRequest);

    expect(fields.contentType).toBe('application/x-www-form-urlencoded');
    expect(fields.bodyType).toBe('string');
    expect(fields.decodedFieldCount).toBe(2);
    expect(fields.decodedKeys).toBe('TRANSACTIONID,CUSTOMEREMAIL');
    expect(fields.queryKeys).toBe('ref');
  });

  it('never includes a field value', async () => {
    const { describeCallbackRequest } = await import('./callbackPayload.js');

    const emitted = JSON.stringify(
      describeCallbackRequest({
        body: { CUSTOMEREMAIL: 'someone@example.com', CUSTOMERPHONE: '9876543210' },
        query: {},
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      } as unknown as VercelRequest),
    );

    expect(emitted).toContain('CUSTOMEREMAIL');
    expect(emitted).not.toContain('someone@example.com');
    expect(emitted).not.toContain('9876543210');
  });

  it('describes a body the platform dropped entirely', async () => {
    const { describeCallbackRequest } = await import('./callbackPayload.js');

    const fields = describeCallbackRequest({
      body: undefined,
      query: {},
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    } as unknown as VercelRequest);

    // Exactly the signature of the production failure: a multipart content
    // type, an undefined body, and nothing decoded.
    expect(fields.bodyType).toBe('undefined');
    expect(fields.decodedFieldCount).toBe(0);
    expect(fields.decodedKeys).toBe('(none)');
  });
});
