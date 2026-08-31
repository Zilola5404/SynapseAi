import { sendEmailNotification } from './emailService';

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  plan: 'free' | 'trial' | 'pro' | 'vip';
  trialEndsAt: string; // ISO string
  emailVerified: boolean;
  avatarUrl?: string;
  binanceConnected?: boolean;
}

const USERS_STORAGE_KEY = 'synapse_users_db';
const CURRENT_USER_KEY = 'synapse_user';

export function getRegisteredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveUsers(users: UserAccount[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function getUserByEmail(email: string): UserAccount | undefined {
  const users = getRegisteredUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getCurrentSessionUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const existing = getUserByEmail(session.email);
    if (existing) return existing;
    return {
      id: 'USR-DEFAULT',
      email: session.email,
      passwordHash: '***',
      name: session.name || session.email.split('@')[0],
      createdAt: new Date().toISOString(),
      plan: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
      emailVerified: true,
    };
  } catch (e) {
    return null;
  }
}

export function setCurrentSessionUser(user: { email: string; name: string }): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearCurrentSessionUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function registerNewUser(
  email: string,
  password: string,
  name: string
): { success: boolean; error?: string; user?: UserAccount } {
  const users = getRegisteredUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    return {
      success: false,
      error: 'Пользователь с таким E-mail адресом уже зарегистрирован',
    };
  }

  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const newUser: UserAccount = {
    id: 'USR-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    email: email.trim().toLowerCase(),
    passwordHash: btoa(password), // simple encoder simulation
    name: name.trim() || email.split('@')[0],
    createdAt: new Date().toISOString(),
    plan: 'trial',
    trialEndsAt: trialEnds,
    emailVerified: false,
  };

  users.push(newUser);
  saveUsers(users);

  // Set session
  setCurrentSessionUser({ email: newUser.email, name: newUser.name });

  // Send email notifications
  sendEmailNotification(newUser.email, newUser.name, 'welcome');
  sendEmailNotification(newUser.email, newUser.name, 'verification', {
    verificationToken: btoa(newUser.id),
  });
  sendEmailNotification(newUser.email, newUser.name, 'new_device', {
    deviceInfo: 'Chrome / Web Session',
    ipAddress: '178.62.204.18 (SSL)',
  });

  return { success: true, user: newUser };
}

export function loginUser(
  email: string,
  password: string
): { success: boolean; error?: string; user?: UserAccount } {
  const users = getRegisteredUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!found) {
    return {
      success: false,
      error: 'Пользователь с указанным E-mail не найден',
    };
  }

  if (found.passwordHash !== btoa(password)) {
    return {
      success: false,
      error: 'Неверный пароль. Попробуйте еще раз или восстановите доступ',
    };
  }

  setCurrentSessionUser({ email: found.email, name: found.name });

  // Send new device / login email notification
  sendEmailNotification(found.email, found.name, 'new_device', {
    deviceInfo: 'Chrome Browser / Auth Session',
    ipAddress: '185.220.101.4 (HTTPS)',
  });

  return { success: true, user: found };
}

export function changeUserPassword(
  email: string,
  oldPass: string,
  newPass: string
): { success: boolean; error?: string } {
  const users = getRegisteredUsers();
  const index = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());

  if (index === -1) {
    return { success: false, error: 'Пользователь не найден' };
  }

  if (users[index].passwordHash !== btoa(oldPass)) {
    return { success: false, error: 'Текущий пароль указан неверно' };
  }

  users[index].passwordHash = btoa(newPass);
  saveUsers(users);

  // Send password changed notification
  sendEmailNotification(users[index].email, users[index].name, 'password_changed', {
    deviceInfo: 'Chrome / Desktop Client',
    ipAddress: '194.28.112.45',
  });

  return { success: true };
}

export function resetUserPasswordRequest(email: string): { success: boolean; error?: string } {
  const users = getRegisteredUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  const targetEmail = email.trim().toLowerCase();
  const userName = found ? found.name : targetEmail.split('@')[0];

  sendEmailNotification(targetEmail, userName, 'password_reset', {
    resetToken: 'RST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  });

  return { success: true };
}
