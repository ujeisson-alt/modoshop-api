import bcrypt from 'bcrypt';
import { User } from '../models/mysql';
import { createError } from '../middlewares/errorHandler';
import { signToken } from '../utils/jwt';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

const SALT_ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, SALT_ROUNDS);

export const AuthService = {
  async register(input: RegisterInput): Promise<{ user: User; token: string }> {
    const exists = await User.findOne({ where: { email: input.email } });
    if (exists) throw createError('El email ya está registrado', 409);
    const user = await User.create({
      name: input.name,
      email: input.email,
      password: await hashPassword(input.password),
      role: 'CUSTOMER', // el rol ADMIN nunca se asigna desde el registro público
      phone: input.phone ?? null,
      address: input.address ?? null,
    });
    return { user, token: signToken({ id: user.id, role: user.role }) };
  },

  async login(input: LoginInput): Promise<{ user: User; token: string }> {
    const user = await User.findOne({ where: { email: input.email } });
    // Mismo mensaje para email o contraseña incorrectos (evita enumeración de usuarios)
    const valid = user ? await bcrypt.compare(input.password, user.password) : false;
    if (!user || !valid) throw createError('Credenciales inválidas', 401);
    if (!user.isActive) throw createError('La cuenta está desactivada', 403);
    return { user, token: signToken({ id: user.id, role: user.role }) };
  },
};
