process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://unit:unit@localhost:5432/unit';

import { Request, Response } from 'express';
import { isSuperAdmin, strictCsrf } from '../middleware/dataset.middleware';
import { requireRole, hasAdminRights } from '../middleware/requireRole';
import { validateAnnotation, DATASET_FIELDS } from '../dataset/schema';
import { datasetAudioName } from '../dataset/export';

jest.mock('../models/AuthAudit', () => ({ logAudit: jest.fn() }));

const user = (email: string, role: 'superadmin' | 'admin' | 'doctor' = 'admin') =>
  ({ id: 'u1', email, role, session_version: 0 }) as Request['user'];

function mockRes() {
  const res: Partial<Response> & { statusCode?: number } = {};
  res.status = jest.fn((code: number) => { res.statusCode = code; return res as Response; });
  res.json = jest.fn(() => res as Response);
  return res as Response & { statusCode?: number };
}

function mockReq(method: string, headers: Record<string, string>): Request {
  return {
    method,
    headers,
    path: '/audio',
    protocol: 'https',
    get: (h: string) => (h.toLowerCase() === 'host' ? 'app.example.ru' : undefined),
    user: user('root@x.ru'),
  } as unknown as Request;
}

describe('isSuperAdmin', () => {
  it('is true only for the superadmin role', () => {
    expect(isSuperAdmin(user('root@x.ru', 'superadmin'))).toBe(true);
    expect(isSuperAdmin(user('root@x.ru', 'admin'))).toBe(false);
    expect(isSuperAdmin(user('root@x.ru', 'doctor'))).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe('requireRole hierarchy', () => {
  const run = (role: 'superadmin' | 'admin' | 'doctor', ...roles: Parameters<typeof requireRole>) => {
    const next = jest.fn();
    const res = mockRes();
    requireRole(...roles)({ user: user('x@x.ru', role) } as Request, res, next);
    return next.mock.calls.length ? 'ok' : res.statusCode;
  };

  it('superadmin passes admin-only routes', () => {
    expect(run('superadmin', 'admin')).toBe('ok');
    expect(run('superadmin', 'admin', 'doctor')).toBe('ok');
  });

  it('admin does not pass superadmin-only routes', () => {
    expect(run('admin', 'superadmin')).toBe(403);
    expect(run('doctor', 'admin')).toBe(403);
  });

  it('hasAdminRights covers admin and superadmin', () => {
    expect(['superadmin', 'admin', 'doctor'].map(hasAdminRights)).toEqual([true, true, false]);
  });
});

describe('strictCsrf', () => {
  const ok = { origin: 'https://app.example.ru', 'x-requested-with': 'BrainPhone' };

  it('lets GET through without checks', () => {
    const next = jest.fn();
    strictCsrf(mockReq('GET', {}), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it.each([
    ['no Origin', { 'x-requested-with': 'BrainPhone' }],
    ['foreign Origin', { ...ok, origin: 'https://evil.example' }],
    ['no marker header', { origin: ok.origin }],
  ])('rejects DELETE with %s', (_name, headers) => {
    const next = jest.fn();
    const res = mockRes();
    strictCsrf(mockReq('DELETE', headers as Record<string, string>), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('accepts same-host Origin with marker', () => {
    const next = jest.fn();
    strictCsrf(mockReq('DELETE', ok), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('validateAnnotation', () => {
  it('keeps template list values verbatim and drops unknown keys', () => {
    const { values, errors } = validateAnnotation({ T: '1 - ВЫКЛ ', H: 'ЖЕН', E: 'MCI, Norm, MCI', __proto__x: 'x', CF: 'формат FLAC' });
    expect(errors).toEqual({});
    expect(values).toEqual({ T: '1 - ВЫКЛ ', H: 'ЖЕН', E: 'MCI, Norm', CF: 'формат FLAC' });
  });

  it('rejects values outside lists and ranges', () => {
    const { errors } = validateAnnotation({ H: 'M', G: '500', AG: '2', C: '31.01.2023', E: 'Foo' });
    expect(Object.keys(errors).sort()).toEqual(['AG', 'C', 'E', 'G', 'H']);
  });

  it('accepts service marks for numeric fields', () => {
    const { values, errors } = validateAnnotation({ G: 'NA', L: 'х', Q: '?', V: '25,5' });
    expect(errors).toEqual({});
    expect(values).toEqual({ G: 'NA', L: 'х', Q: '?', V: '25.5' });
  });

  it('rejects non-object payloads', () => {
    expect(validateAnnotation(['A']).errors._).toBeDefined();
    expect(validateAnnotation('x').errors._).toBeDefined();
  });

  it('covers template columns A..BW', () => {
    expect(DATASET_FIELDS).toHaveLength(75);
  });
});

describe('datasetAudioName', () => {
  it('follows the 001АБВ(1)310123-1 convention', () => {
    expect(datasetAudioName({ A: '001АБВ', B: '1', C: '2023-01-31' }, 1)).toBe('001АБВ(1)310123-1');
  });
});
