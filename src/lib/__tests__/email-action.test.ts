/**
 * Unit Tests — email-action.ts
 * ทดสอบ HMAC token: สร้าง, ยืนยัน, หมดอายุ, แก้ไข
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createEmailActionToken,
  verifyEmailActionToken,
  buildEmailActionUrl,
} from '../email-action';

describe('createEmailActionToken + verifyEmailActionToken', () => {
  it('should create and verify a valid token', () => {
    const token = createEmailActionToken(123, 'cancel', 1);
    const payload = verifyEmailActionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.taskId).toBe(123);
    expect(payload!.action).toBe('cancel');
    expect(payload!.userId).toBe(1);
  });

  it('should create different tokens for different actions', () => {
    const cancelToken = createEmailActionToken(1, 'cancel', 1);
    const rescheduleToken = createEmailActionToken(1, 'reschedule', 1);
    expect(cancelToken).not.toBe(rescheduleToken);
  });

  it('should create different tokens for different tasks', () => {
    const token1 = createEmailActionToken(1, 'cancel', 1);
    const token2 = createEmailActionToken(2, 'cancel', 1);
    expect(token1).not.toBe(token2);
  });

  it('should create different tokens for different users', () => {
    const token1 = createEmailActionToken(1, 'cancel', 1);
    const token2 = createEmailActionToken(1, 'cancel', 2);
    expect(token1).not.toBe(token2);
  });

  it('should include expiresAt in payload (72 hours from now)', () => {
    const before = Date.now();
    const token = createEmailActionToken(1, 'view', 1);
    const after = Date.now();
    
    const payload = verifyEmailActionToken(token);
    const expectedExpiry72h = 72 * 60 * 60 * 1000;
    
    expect(payload!.expiresAt).toBeGreaterThanOrEqual(before + expectedExpiry72h);
    expect(payload!.expiresAt).toBeLessThanOrEqual(after + expectedExpiry72h);
  });
});

describe('verifyEmailActionToken — reject cases', () => {
  it('should return null for expired token', () => {
    // Mock Date.now to create an already-expired token
    const realDateNow = Date.now;
    const pastTime = Date.now() - 100 * 60 * 60 * 1000; // 100 hours ago
    vi.spyOn(Date, 'now').mockReturnValueOnce(pastTime);
    const token = createEmailActionToken(1, 'cancel', 1);
    
    // Restore Date.now for verification
    vi.restoreAllMocks();
    
    const payload = verifyEmailActionToken(token);
    expect(payload).toBeNull();
  });

  it('should return null for tampered token (modified data)', () => {
    const token = createEmailActionToken(1, 'cancel', 1);
    const [data, sig] = token.split('.');
    // Tamper with the base64 data
    const tamperedData = data + 'X';
    const tamperedToken = `${tamperedData}.${sig}`;
    
    expect(verifyEmailActionToken(tamperedToken)).toBeNull();
  });

  it('should return null for tampered signature', () => {
    const token = createEmailActionToken(1, 'cancel', 1);
    const [data] = token.split('.');
    const tamperedToken = `${data}.invalidsignature`;
    
    expect(verifyEmailActionToken(tamperedToken)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(verifyEmailActionToken('')).toBeNull();
  });

  it('should return null for random string', () => {
    expect(verifyEmailActionToken('not-a-valid-token')).toBeNull();
  });

  it('should return null for token without dot separator', () => {
    expect(verifyEmailActionToken('nodothere')).toBeNull();
  });
});

describe('buildEmailActionUrl', () => {
  it('should build URL with token parameter', () => {
    const url = buildEmailActionUrl(123, 'cancel', 1);
    expect(url).toContain('/email-action?token=');
  });

  it('should use NEXTAUTH_URL as base', () => {
    // Default fallback is http://localhost:3000
    const url = buildEmailActionUrl(1, 'reschedule', 1);
    expect(url).toMatch(/^https?:\/\/.+\/email-action\?token=.+$/);
  });

  it('should produce a verifiable token in URL', () => {
    const url = buildEmailActionUrl(42, 'view', 5);
    const token = new URL(url).searchParams.get('token');
    expect(token).not.toBeNull();
    
    const payload = verifyEmailActionToken(token!);
    expect(payload).not.toBeNull();
    expect(payload!.taskId).toBe(42);
    expect(payload!.action).toBe('view');
    expect(payload!.userId).toBe(5);
  });
});
