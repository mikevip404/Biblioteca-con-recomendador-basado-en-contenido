/**
 * Validación en cliente: MISMAS reglas que los schemas del backend
 * (`backend/src/schemas/auth.schemas.ts`) para fallar rápido sin esperar
 * a la red. El servidor sigue siendo la autoridad final.
 */

const EMAIL_MAX = 255;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FULL_NAME_MAX = 255;

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>;

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  fullName: string;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (trimmed === '') return 'El correo es obligatorio.';
  if (trimmed.length > EMAIL_MAX) return 'El correo no puede superar los 255 caracteres.';
  if (!EMAIL_RE.test(trimmed)) return 'Correo electrónico inválido.';
  return null;
}

/** Login: la contraseña solo debe ser no vacía (pudo crearse con reglas viejas). */
export function validateLoginPassword(password: string): string | null {
  if (password === '') return 'La contraseña es obligatoria.';
  return null;
}

/** Registro: política vigente de contraseñas (mín. 8, mayúscula, minúscula, número). */
export function validateRegisterPassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir una minúscula.';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir una mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir un número.';
  return null;
}

export function validateFullName(fullName: string): string | null {
  const trimmed = fullName.trim();
  if (trimmed === '') return 'El nombre es obligatorio.';
  if (trimmed.length > FULL_NAME_MAX) return 'El nombre no puede superar los 255 caracteres.';
  return null;
}

export function validateLoginForm(form: LoginForm): FieldErrors<LoginForm> {
  const errors: FieldErrors<LoginForm> = {};
  const email = validateEmail(form.email);
  if (email !== null) errors.email = email;
  const password = validateLoginPassword(form.password);
  if (password !== null) errors.password = password;
  return errors;
}

export function validateRegisterForm(form: RegisterForm): FieldErrors<RegisterForm> {
  const errors: FieldErrors<RegisterForm> = {};
  const email = validateEmail(form.email);
  if (email !== null) errors.email = email;
  const password = validateRegisterPassword(form.password);
  if (password !== null) errors.password = password;
  const fullName = validateFullName(form.fullName);
  if (fullName !== null) errors.fullName = fullName;
  return errors;
}

/** Estado del formulario tras un intento: errores por campo + mensaje global. */
export interface FormResult<T> {
  errors: FieldErrors<T>;
  ok: boolean;
}