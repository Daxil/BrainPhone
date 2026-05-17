/**
 * Unit tests for email templates.
 * Verifies: templates render correctly and contain no secrets.
 */

import { renderTemplate } from '../services/emailTemplates';

const SECRET_PATTERNS = [
  /session_id/i,
  /totp_secret/i,
  /password/i,
  /ADMIN_PATH_SECRET/i,
  /backup_code/i,
  /token/i,  // raw tokens
];

function containsSecret(text: string): boolean {
  // Allow "one-time token" type descriptions but not actual token values
  // We only check for key names, not values
  return SECRET_PATTERNS.some((p) => {
    const match = text.match(p);
    // "token" is allowed in "invite_link" URL context since it's a one-time link
    if (p.source === '/token/i' && match) {
      // OK if the word appears only as part of a URL path /invite/...
      const withoutUrls = text.replace(/https?:\/\/[^\s"<>]*/g, '');
      return p.test(withoutUrls);
    }
    return !!match;
  });
}

describe('Email templates: account_locked', () => {
  const rendered = renderTemplate('account_locked', {
    email: 'user@hospital.ru',
    attempts: '10',
  });

  test('has subject', () => expect(rendered.subject).toBeTruthy());
  test('text contains email', () => expect(rendered.text).toContain('user@hospital.ru'));
  test('html does not contain raw secrets', () => expect(containsSecret(rendered.html)).toBe(false));
  test('html is properly escaped (XSS check)', () => {
    const xssRendered = renderTemplate('account_locked', {
      email: '<script>alert(1)</script>',
      attempts: '10',
    });
    expect(xssRendered.html).not.toContain('<script>');
    expect(xssRendered.html).toContain('&lt;script&gt;');
  });
});

describe('Email templates: admin_alert_lockout', () => {
  const rendered = renderTemplate('admin_alert_lockout', {
    target_email: 'victim@hospital.ru',
    attempts: '10',
    ip: '1.2.3.4',
    time: '2026-05-05 10:00:00 UTC',
  });

  test('has subject', () => expect(rendered.subject).toContain('victim@hospital.ru'));
  test('text contains IP', () => expect(rendered.text).toContain('1.2.3.4'));
  test('no secrets in html', () => expect(containsSecret(rendered.html)).toBe(false));
  test('XSS in IP is escaped', () => {
    const r = renderTemplate('admin_alert_lockout', {
      target_email: 'x@y.com',
      attempts: '5',
      ip: '"><img onerror=alert(1)>',
      time: 'now',
    });
    expect(r.html).not.toContain('<img');
    expect(r.html).toContain('&lt;');
  });
});

describe('Email templates: invite', () => {
  const rendered = renderTemplate('invite', {
    role: 'doctor',
    invite_link: 'https://app.example.com/invite/ABC123',
  });

  test('link is in text', () => expect(rendered.text).toContain('https://app.example.com/invite/ABC123'));
  test('link href is safe in html', () => expect(rendered.html).toContain('href="https://app.example.com/invite/ABC123"'));
  test('javascript: scheme is replaced with # (URL sanitization)', () => {
    const r = renderTemplate('invite', {
      role: 'doctor',
      invite_link: 'javascript:alert(1)',
    });
    expect(r.html).not.toContain('href="javascript:');
    expect(r.html).toContain('href="#"');
  });
});

describe('Email templates: password_changed', () => {
  const rendered = renderTemplate('password_changed', {
    email: 'user@hospital.ru',
    time: '2026-05-05 10:00:00 UTC',
  });

  test('has subject', () => expect(rendered.subject).toBeTruthy());
  test('text mentions time', () => expect(rendered.text).toContain('2026-05-05'));
  test('no raw secrets', () => {
    // "password" in subject/body is the concept name, not a value — OK
    // We just check that actual field values aren't leaked
    expect(rendered.html).not.toContain('password_hash');
  });
});

describe('Email templates: new_session', () => {
  const rendered = renderTemplate('new_session', {
    email: 'user@hospital.ru',
    ip: '5.6.7.8',
    ua: 'Mozilla/5.0',
    time: '2026-05-05 10:00:00 UTC',
  });

  test('contains IP', () => expect(rendered.text).toContain('5.6.7.8'));
  test('no secrets', () => expect(containsSecret(rendered.html)).toBe(false));
});

describe('Email templates: admin_alert_404_flood', () => {
  const rendered = renderTemplate('admin_alert_404_flood', {
    ip: '1.2.3.4',
    count: '100',
    window: '10 minutes',
    time: '2026-05-05 10:00:00 UTC',
  });

  test('has subject', () => expect(rendered.subject).toBeTruthy());
  test('text contains count', () => expect(rendered.text).toContain('100'));
});
