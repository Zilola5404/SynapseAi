export type EmailType =
  | 'welcome'
  | 'verification'
  | 'password_reset'
  | 'password_changed'
  | 'new_device';

export interface EmailNotification {
  id: string;
  to: string;
  subject: string;
  type: EmailType;
  sentAt: string;
  htmlBody: string;
  status: 'DELIVERED' | 'SENT';
  actionUrl?: string;
}

const STORAGE_KEY = 'synapse_email_logs';

export function getEmailLogs(userEmail?: string): EmailNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const logs: EmailNotification[] = JSON.parse(raw);
    if (userEmail) {
      return logs.filter((log) => log.to.toLowerCase() === userEmail.toLowerCase());
    }
    return logs;
  } catch (e) {
    return [];
  }
}

export function saveEmailLog(notification: EmailNotification): void {
  try {
    const current = getEmailLogs();
    const updated = [notification, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save email log', e);
  }
}

export function clearEmailLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function sendEmailNotification(
  toEmail: string,
  userName: string,
  type: EmailType,
  extraData: {
    resetToken?: string;
    verificationToken?: string;
    ipAddress?: string;
    deviceInfo?: string;
  } = {}
): EmailNotification {
  const sentAt = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const id = 'EML-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const origin = window.location.origin;

  let subject = '';
  let htmlBody = '';
  let actionUrl = '';

  switch (type) {
    case 'welcome':
      subject = 'Добро пожаловать в Synapse AI!';
      actionUrl = `${origin}/dashboard`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1117; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #22c55e33;">
          <h2 style="color: #22c55e; margin-top: 0;">Здравствуйте, ${userName}!</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Добро пожаловать в <strong>Synapse AI Crypto Intelligence Platform</strong>!
          </p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            Ваш аккаунт успешно зарегистрирован. Вам автоматически активирован бесплатный доступ <strong>Pro Analyst на 14 дней</strong>.
          </p>
          <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #e2e8f0; font-size: 14px;"><strong>Ваш тариф:</strong> Beta Pro Analyst (14 дней триала)</p>
            <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">Подключите Read-Only API ключи Binance в настройках кабинета для автоматической аналитики риска.</p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${actionUrl}" style="background: linear-gradient(90deg, #22c55e, #10b981); color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Открыть Личный Кабинет</a>
          </div>
          <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 12px; text-align: center;">Служба поддержки: <a href="mailto:support@synapseai.app" style="color: #22c55e;">support@synapseai.app</a></p>
        </div>
      `;
      break;

    case 'verification':
      subject = 'Подтвердите ваш email в Synapse AI';
      actionUrl = `${origin}/verify-email?token=${extraData.verificationToken || 'DEMO_VERIFY_123'}&email=${encodeURIComponent(toEmail)}`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1117; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #3b82f633;">
          <h2 style="color: #60a5fa; margin-top: 0;">Подтверждение адреса электронной почты</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Здравствуйте, ${userName}. Пожалуйста, подтвердите ваш E-mail адрес для защиты аккаунта Synapse AI.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${actionUrl}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Подтвердить E-mail адрес</a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">Ссылка действительна в течение 24 часов.</p>
        </div>
      `;
      break;

    case 'password_reset':
      subject = 'Сброс пароля Synapse AI';
      actionUrl = `${origin}/reset-password?token=${extraData.resetToken || 'DEMO_RESET_888'}&email=${encodeURIComponent(toEmail)}`;
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1117; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #f59e0b33;">
          <h2 style="color: #fbbf24; margin-top: 0;">Запрос на сброс пароля</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Уважаемый(ая) ${userName}, мы получили запрос на восстановление пароля к вашему аккаунту в Synapse AI.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${actionUrl}" style="background: #d97706; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Сбросить пароль</a>
          </div>
          <p style="color: #ef4444; font-size: 12px; line-height: 1.5;">
            Если вы не совершали данный запрос, просто проигнорируйте данное письмо. Ссылка действительна 1 час.
          </p>
        </div>
      `;
      break;

    case 'password_changed':
      subject = 'Пароль Synapse AI успешно изменён';
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1117; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #10b98133;">
          <h2 style="color: #34d399; margin-top: 0;">Пароль аккаунта изменен</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Здравствуйте, ${userName}. Пароль от вашего аккаунта Synapse AI был успешно изменен.
          </p>
          <ul style="background: #1e293b; padding: 16px 24px; border-radius: 12px; color: #94a3b8; font-size: 13px; line-height: 1.8;">
            <li><strong>Дата и время:</strong> ${sentAt}</li>
            <li><strong>IP-адрес:</strong> ${extraData.ipAddress || '194.28.112.45 (SSL Protected)'}</li>
            <li><strong>Устройство:</strong> ${extraData.deviceInfo || 'Chrome / macOS'}</li>
          </ul>
          <p style="color: #ef4444; font-size: 12px;">
            Если вы не изменяли пароль, незамедлительно свяжитесь со службой безопасности: <a href="mailto:security@synapseai.app" style="color: #f87171;">security@synapseai.app</a>
          </p>
        </div>
      `;
      break;

    case 'new_device':
      subject = 'Новый вход в аккаунт Synapse AI';
      htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f1117; color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #06b6d433;">
          <h2 style="color: #22d3ee; margin-top: 0;">Обнаружен новый вход в аккаунт</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
            Зафиксирована новая сессия входа в ваш аккаунт Synapse AI.
          </p>
          <div style="background: #1e293b; padding: 16px; border-radius: 12px; margin: 16px 0; color: #e2e8f0; font-size: 13px;">
            <p style="margin: 4px 0;"><strong>Браузер / ОС:</strong> ${extraData.deviceInfo || 'Chrome / Windows 11'}</p>
            <p style="margin: 4px 0;"><strong>IP-адрес:</strong> ${extraData.ipAddress || '185.220.101.4'}</p>
            <p style="margin: 4px 0;"><strong>Время входа:</strong> ${sentAt}</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">
            Если это были вы, никаких действий предпринимать не требуется.
          </p>
        </div>
      `;
      break;
  }

  const notification: EmailNotification = {
    id,
    to: toEmail,
    subject,
    type,
    sentAt,
    htmlBody,
    status: 'DELIVERED',
    actionUrl,
  };

  saveEmailLog(notification);
  return notification;
}
