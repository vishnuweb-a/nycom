import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isApprovedCheckoutUrl,
  resetSabPaisaEnvCache,
  sabpaisaEnv,
  sabpaisaReturnUrl,
} from './env.js';

/**
 * SabPaisa configuration, and its isolation from Airpay.
 *
 * The isolation test is the important one here. Airpay is currently taking real
 * money, and a second provider's missing variable must not be able to stop it.
 */

const SABPAISA_KEYS = [
  'SABPAISA_CLIENT_CODE',
  'SABPAISA_MERCHANT_ID',
  'SABPAISA_API_KEY',
  'SABPAISA_SECRET_KEY',
  'SABPAISA_BASE_URL',
  'CLIENT_CODE',
  'MERCHANT_ID',
  'API_KEY',
  'SECRET_KEY',
] as const;

const original = new Map<string, string | undefined>();

const complete = (): void => {
  process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
  process.env.SABPAISA_MERCHANT_ID = 'TESTMI';
  process.env.SABPAISA_API_KEY = 'test-api-key';
  process.env.SABPAISA_SECRET_KEY = 'test-secret-key';
  process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
  process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';
};

beforeEach(() => {
  for (const key of [...SABPAISA_KEYS, 'PUBLIC_SITE_ORIGIN']) {
    original.set(key, process.env[key]);
    delete process.env[key];
  }

  resetSabPaisaEnvCache();
});

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  original.clear();
  resetSabPaisaEnvCache();
});

describe('Airpay isolation (mandatory)', () => {
  it('does not validate SabPaisa configuration at module import time', async () => {
    // Nothing is set at this point. Importing the Airpay environment module and
    // parsing it must be entirely unaffected by SabPaisa being absent.
    const airpay = await import('../env.js');

    expect(typeof airpay.serverEnv).toBe('function');
  });

  it('leaves the Airpay environment valid when every SabPaisa variable is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE = 'service-role';
    process.env.AIRPAY_MID = 'mid';
    process.env.AIRPAY_CLIENT_ID = 'client';
    process.env.AIRPAY_API_KEY = 'api';
    process.env.AIRPAY_SECRET_KEY = 'secret';
    process.env.AIRPAY_USERNAME = 'user';
    process.env.AIRPAY_PASSWORD = 'pass';
    process.env.AIRPAY_ENV = 'live';

    const { serverEnv } = await import('../env.js');

    // SabPaisa is entirely unset, and the Airpay environment still parses.
    expect(() => serverEnv()).not.toThrow();

    // And the SabPaisa parser fails independently, as it should.
    expect(() => sabpaisaEnv()).toThrow(/SabPaisa configuration is incomplete/);
  });

  it('does not expose SabPaisa names through the Airpay schema', async () => {
    complete();

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE = 'service-role';
    process.env.AIRPAY_MID = 'mid';
    process.env.AIRPAY_CLIENT_ID = 'client';
    process.env.AIRPAY_API_KEY = 'api';
    process.env.AIRPAY_SECRET_KEY = 'secret';
    process.env.AIRPAY_USERNAME = 'user';
    process.env.AIRPAY_PASSWORD = 'pass';
    process.env.AIRPAY_ENV = 'live';

    const { serverEnv } = await import('../env.js');

    expect(Object.keys(serverEnv())).not.toContain('SABPAISA_SECRET_KEY');
  });
});

describe('env name resolution', () => {
  it('reads the prefixed SABPAISA_* names', () => {
    complete();

    const env = sabpaisaEnv();

    expect(env.SABPAISA_CLIENT_CODE).toBe('TESTCC');
    expect(env.SABPAISA_MERCHANT_ID).toBe('TESTMI');
  });

  it('falls back to the bare names the merchant environment actually uses', () => {
    process.env.CLIENT_CODE = 'BARECC';
    process.env.MERCHANT_ID = 'BAREMI';
    process.env.API_KEY = 'bare-api-key';
    process.env.SECRET_KEY = 'bare-secret-key';
    process.env.SABPAISA_BASE_URL = 'https://merchant-api.sabpaisa.in';
    process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online';

    const env = sabpaisaEnv();

    expect(env.SABPAISA_CLIENT_CODE).toBe('BARECC');
    expect(env.SABPAISA_MERCHANT_ID).toBe('BAREMI');
    expect(env.SABPAISA_API_KEY).toBe('bare-api-key');
  });

  it('prefers the prefixed name when both are present', () => {
    complete();
    process.env.CLIENT_CODE = 'BARECC';

    expect(sabpaisaEnv().SABPAISA_CLIENT_CODE).toBe('TESTCC');
  });

  it('reads clientCode and merchantId from independent variables', () => {
    /*
     * This merchant's production account happens to have been assigned the SAME
     * value for both, which is why the two are never collapsed in code: the
     * equality is a property of one SabPaisa account, not of the protocol, and
     * would break silently if SabPaisa reissued either one.
     *
     * The test therefore sets them to DIFFERENT values and proves each is read
     * from its own variable — which is the invariant that protects us whether
     * or not they happen to be equal in production.
     */
    complete();
    process.env.SABPAISA_CLIENT_CODE = 'ONLY_CC';
    process.env.SABPAISA_MERCHANT_ID = 'ONLY_MI';
    resetSabPaisaEnvCache();

    const env = sabpaisaEnv();

    expect(env.SABPAISA_CLIENT_CODE).toBe('ONLY_CC');
    expect(env.SABPAISA_MERCHANT_ID).toBe('ONLY_MI');
  });

  it('accepts a production config in which both hold the same value', () => {
    // As this merchant's does. It must not be treated as a misconfiguration.
    complete();
    process.env.SABPAISA_CLIENT_CODE = 'SAME1';
    process.env.SABPAISA_MERCHANT_ID = 'SAME1';
    resetSabPaisaEnvCache();

    expect(() => sabpaisaEnv()).not.toThrow();
  });

  it('names every missing variable, and never prints a value', () => {
    process.env.SABPAISA_CLIENT_CODE = 'TESTCC';
    process.env.SABPAISA_SECRET_KEY = 'super-secret-value';

    let message = '';

    try {
      sabpaisaEnv();
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('SABPAISA_MERCHANT_ID');
    expect(message).toContain('SABPAISA_API_KEY');
    // The value of a variable that WAS set must not leak into the error.
    expect(message).not.toContain('super-secret-value');
  });

  it('treats a defined-but-blank variable as missing', () => {
    complete();
    process.env.SABPAISA_API_KEY = '   ';

    expect(() => sabpaisaEnv()).toThrow(/SABPAISA_API_KEY/);
  });

  it('rejects a base URL that is not an https sabpaisa.in host', () => {
    complete();
    process.env.SABPAISA_BASE_URL = 'http://merchant-api.sabpaisa.in';
    resetSabPaisaEnvCache();
    expect(() => sabpaisaEnv()).toThrow(/SABPAISA_BASE_URL/);

    process.env.SABPAISA_BASE_URL = 'https://evil.example.com';
    resetSabPaisaEnvCache();
    expect(() => sabpaisaEnv()).toThrow(/SABPAISA_BASE_URL/);

    // A lookalike host must not pass by suffix confusion.
    process.env.SABPAISA_BASE_URL = 'https://notsabpaisa.in';
    resetSabPaisaEnvCache();
    expect(() => sabpaisaEnv()).toThrow(/SABPAISA_BASE_URL/);
  });
});

describe('sabpaisaReturnUrl', () => {
  it('derives the production return URL from PUBLIC_SITE_ORIGIN', () => {
    complete();

    expect(sabpaisaReturnUrl()).toBe('https://www.yarnvia.online/api/payments/sabpaisa/return');
  });

  it('does not duplicate the domain when the origin has a trailing slash', () => {
    complete();
    process.env.PUBLIC_SITE_ORIGIN = 'https://www.yarnvia.online/';
    resetSabPaisaEnvCache();

    expect(sabpaisaReturnUrl()).toBe('https://www.yarnvia.online/api/payments/sabpaisa/return');
  });

  it.each([
    'http://www.yarnvia.online',
    'https://localhost:3000',
    'https://127.0.0.1',
    'https://yarnvia-git-main.vercel.app',
    'https://staging.yarnvia.online',
  ])('refuses to build a live return URL from %s', (origin) => {
    complete();
    process.env.PUBLIC_SITE_ORIGIN = origin;
    resetSabPaisaEnvCache();

    expect(() => sabpaisaReturnUrl()).toThrow();
  });
});

describe('isApprovedCheckoutUrl', () => {
  it('accepts an https SabPaisa host', () => {
    expect(isApprovedCheckoutUrl('https://checkout.sabpaisa.in/pay/abc')).toBe(true);
    expect(isApprovedCheckoutUrl('https://sabpaisa.in/checkout')).toBe(true);
  });

  it('rejects plaintext, foreign and lookalike hosts', () => {
    expect(isApprovedCheckoutUrl('http://checkout.sabpaisa.in/pay')).toBe(false);
    expect(isApprovedCheckoutUrl('https://evil.example.com/pay')).toBe(false);
    expect(isApprovedCheckoutUrl('https://sabpaisa.in.evil.com/pay')).toBe(false);
    expect(isApprovedCheckoutUrl('https://notsabpaisa.in/pay')).toBe(false);
    expect(isApprovedCheckoutUrl('not-a-url')).toBe(false);
    expect(isApprovedCheckoutUrl('javascript:alert(1)')).toBe(false);
  });
});
