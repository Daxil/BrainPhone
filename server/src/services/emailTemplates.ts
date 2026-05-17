/**
 * Email templates: text + HTML.
 * HTML vars are escaped via htmlEsc() — never raw-concatenated.
 * Templates MUST NOT include session_id, tokens, passwords, ADMIN_PATH_SECRET.
 */

function htmlEsc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Render a template string replacing {{KEY}} with escaped values. */
function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => htmlEsc(vars[k] ?? ''));
}

/** Plain-text renderer (no escaping needed for text/plain). */
function renderText(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

const htmlWrapper = (body: string) => `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;color:#222;background:#f9f9f9;padding:24px}
.card{background:#fff;border-radius:8px;padding:24px;max-width:520px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08)}
a{color:#2563eb}.footer{margin-top:24px;font-size:12px;color:#888}</style></head>
<body><div class="card">${body}<div class="footer">BrainPhone — автоматическое сообщение, не отвечайте на него.</div></div></body></html>`;

// ─── Template registry ────────────────────────────────────────────────────────

export type TemplateName =
  | 'account_locked'
  | 'admin_alert_lockout'
  | 'admin_alert_404_flood'
  | 'invite'
  | 'password_changed'
  | 'new_session';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderTemplate(
  name: TemplateName,
  vars: Record<string, string>
): RenderedEmail {
  switch (name) {
    // ─── Account locked after N failures ─────────────────────────────────────
    case 'account_locked': {
      const subject = 'Ваш аккаунт временно заблокирован';
      const text = renderText(
        `Здравствуйте,\n\n` +
        `Ваш аккаунт {{email}} в BrainPhone был временно заблокирован после {{attempts}} неудачных попыток входа.\n\n` +
        `Блокировка снимется автоматически через 1 час.\n\n` +
        `Если это были не вы, немедленно сообщите администратору.\n\nBrainPhone`,
        vars
      );
      const html = htmlWrapper(
        `<h2 style="color:#dc2626">⚠️ Аккаунт временно заблокирован</h2>` +
        `<p>Здравствуйте,</p>` +
        `<p>Аккаунт <strong>{{email}}</strong> в BrainPhone был заблокирован после <strong>{{attempts}}</strong> неудачных попыток входа.</p>` +
        `<p>Блокировка снимется автоматически через <strong>1 час</strong>.</p>` +
        `<p>Если это были не вы — немедленно сообщите администратору.</p>`
          .replace(/\{\{(\w+)\}\}/g, (_, k) => htmlEsc(vars[k] ?? ''))
      );
      return { subject, text, html: render(html, vars) };
    }

    // ─── Admin alert: user account locked ────────────────────────────────────
    case 'admin_alert_lockout': {
      const subject = '[BrainPhone] Аккаунт заблокирован: ' + (vars.target_email ?? '');
      const text = renderText(
        `Уведомление безопасности BrainPhone\n\n` +
        `Аккаунт {{target_email}} заблокирован после {{attempts}} неудачных попыток входа.\n` +
        `IP: {{ip}}\nВремя: {{time}}\n\n` +
        `Вы можете разблокировать пользователя в панели администратора.\n\nBrainPhone`,
        vars
      );
      const html = htmlWrapper(
        render(
          `<h2 style="color:#dc2626">🔒 Аккаунт заблокирован</h2>` +
          `<p><strong>Пользователь:</strong> {{target_email}}</p>` +
          `<p><strong>Попыток входа:</strong> {{attempts}}</p>` +
          `<p><strong>IP:</strong> {{ip}}</p>` +
          `<p><strong>Время:</strong> {{time}}</p>` +
          `<p>Разблокировать можно в панели администратора.</p>`,
          vars
        )
      );
      return { subject, text, html };
    }

    // ─── Admin alert: IP banned for 404 flood ────────────────────────────────
    case 'admin_alert_404_flood': {
      const subject = '[BrainPhone] IP заблокирован за 404-флуд';
      const text = renderText(
        `Уведомление безопасности BrainPhone\n\n` +
        `IP {{ip}} заблокирован за избыточные 404-запросы ({{count}} за {{window}}).\n` +
        `Время: {{time}}\n\nBrainPhone`,
        vars
      );
      const html = htmlWrapper(
        render(
          `<h2 style="color:#dc2626">🚫 IP заблокирован: 404-флуд</h2>` +
          `<p><strong>IP:</strong> {{ip}}</p>` +
          `<p><strong>Запросов:</strong> {{count}} за {{window}}</p>` +
          `<p><strong>Время:</strong> {{time}}</p>`,
          vars
        )
      );
      return { subject, text, html };
    }

    // ─── Invite: set password link ────────────────────────────────────────────
    case 'invite': {
      const subject = 'Приглашение в BrainPhone';
      const text = renderText(
        `Здравствуйте,\n\n` +
        `Вас пригласили в BrainPhone как {{role}}.\n\n` +
        `Для завершения регистрации перейдите по ссылке (действительна 48 часов):\n{{invite_link}}\n\n` +
        `Если вы не ожидали этого письма, проигнорируйте его.\n\nBrainPhone`,
        vars
      );
      const rawLink = vars.invite_link ?? '';
      // Only allow http/https — reject javascript: and other schemes
      const safeLink = /^https?:\/\//i.test(rawLink) ? rawLink : '#';
      const html = htmlWrapper(
        `<h2>Добро пожаловать в BrainPhone</h2>` +
        `<p>Вас пригласили как <strong>${htmlEsc(vars.role ?? '')}</strong>.</p>` +
        `<p>Нажмите кнопку ниже для завершения регистрации (ссылка действительна <strong>48 часов</strong>):</p>` +
        `<p><a href="${htmlEsc(safeLink)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Установить пароль</a></p>` +
        `<p style="font-size:12px;color:#888">Если кнопка не работает, скопируйте ссылку: ${htmlEsc(safeLink)}</p>` +
        `<p>Если вы не ожидали этого письма — проигнорируйте его.</p>`
      );
      return { subject, text, html };
    }

    // ─── Password changed notification ───────────────────────────────────────
    case 'password_changed': {
      const subject = 'Пароль в BrainPhone изменён';
      const text = renderText(
        `Здравствуйте,\n\n` +
        `Пароль вашего аккаунта {{email}} в BrainPhone был успешно изменён.\n` +
        `Время: {{time}}\n\n` +
        `Если это были не вы — немедленно обратитесь к администратору.\n\nBrainPhone`,
        vars
      );
      const html = htmlWrapper(
        render(
          `<h2>Пароль изменён</h2>` +
          `<p>Пароль аккаунта <strong>{{email}}</strong> в BrainPhone был изменён.</p>` +
          `<p><strong>Время:</strong> {{time}}</p>` +
          `<p>Если это были не вы — немедленно обратитесь к администратору.</p>`,
          vars
        )
      );
      return { subject, text, html };
    }

    // ─── New session from unknown IP/UA ──────────────────────────────────────
    case 'new_session': {
      const subject = 'Новый вход в BrainPhone';
      const text = renderText(
        `Здравствуйте,\n\n` +
        `Выполнен вход в аккаунт {{email}} из нового устройства или браузера.\n` +
        `IP: {{ip}}\nУстройство: {{ua}}\nВремя: {{time}}\n\n` +
        `Если это были не вы — немедленно смените пароль.\n\nBrainPhone`,
        vars
      );
      const html = htmlWrapper(
        render(
          `<h2>Новый вход в аккаунт</h2>` +
          `<p>Выполнен вход в <strong>{{email}}</strong> из нового устройства или браузера.</p>` +
          `<p><strong>IP:</strong> {{ip}}</p>` +
          `<p><strong>Устройство:</strong> {{ua}}</p>` +
          `<p><strong>Время:</strong> {{time}}</p>` +
          `<p>Если это были не вы — немедленно смените пароль.</p>`,
          vars
        )
      );
      return { subject, text, html };
    }

    default:
      throw new Error(`Unknown email template: ${name}`);
  }
}
