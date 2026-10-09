import { z } from 'zod';

/**
 * Política de contraseñas: mínimo 8 caracteres con mayúscula, minúscula y
 * número. Se usa en registro y en el script de semilla del admin.
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula')
  .regex(/\d/, 'La contraseña debe incluir un número');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo electrónico inválido')
  .max(255);

/**
 * Registro. Sin campo `role`: Zod elimina claves desconocidas por defecto,
 * así que aunque el cliente envíe `role`, se ignora y el servicio fuerza
 * `lector`.
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1, 'El nombre es obligatorio').max(255)
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login. La contraseña solo debe ser no vacía: no se exige la política
 * vigente porque el usuario pudo crearla con reglas anteriores.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria')
});

export type LoginInput = z.infer<typeof loginSchema>;
