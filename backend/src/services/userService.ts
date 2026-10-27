import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User, UserPublic, UserRole } from '../types/auth';

const users: Map<string, User> = new Map();

function hashPassword(plainText: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(plainText, salt);
}

function initSeedAccounts(): void {
  const adminUser: User = {
    id: 'usr_admin_001',
    email: env.DEFAULT_ADMIN.email.toLowerCase().trim(),
    name: env.DEFAULT_ADMIN.name,
    role: 'Admin',
    passwordHash: hashPassword(env.DEFAULT_ADMIN.password),
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const dataEntryUser: User = {
    id: 'usr_data_entry_002',
    email: env.DEFAULT_DATA_ENTRY.email.toLowerCase().trim(),
    name: env.DEFAULT_DATA_ENTRY.name,
    role: 'Data Entry',
    passwordHash: hashPassword(env.DEFAULT_DATA_ENTRY.password),
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  users.set(adminUser.email, adminUser);
  users.set(dataEntryUser.email, dataEntryUser);
}

initSeedAccounts();

export function toPublicUser(user: User): UserPublic {
  const { passwordHash: _discard, ...publicData } = user;
  return publicData;
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase().trim();
  return users.get(normalized);
}

export function findUserById(id: string): User | undefined {
  for (const user of users.values()) {
    if (user.id === id) {
      return user;
    }
  }
  return undefined;
}

export function validateUserCredentials(
  email: string,
  plainPassword: string,
): UserPublic | null {
  const user = findUserByEmail(email);
  if (!user) {
    bcrypt.compareSync(plainPassword, '$2a$10$abcdefghijklmnopqrstuuNOPQRSTUVWXYZ1234567890abcdefghi');
    return null;
  }

  const isValid = bcrypt.compareSync(plainPassword, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return toPublicUser(user);
}

export function getAllUsers(): UserPublic[] {
  return Array.from(users.values()).map(toPublicUser);
}

export function createUser(
  email: string,
  plainPassword: string,
  name: string,
  role: UserRole,
): UserPublic {
  const normalized = email.toLowerCase().trim();
  if (users.has(normalized)) {
    throw new Error('User already exists with this email.');
  }

  const newUser: User = {
    id: `usr_${Date.now()}`,
    email: normalized,
    name,
    role,
    passwordHash: hashPassword(plainPassword),
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  users.set(normalized, newUser);
  return toPublicUser(newUser);
}
