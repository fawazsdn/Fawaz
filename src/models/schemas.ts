import { z } from 'zod';

/**
 * Shared Zod validation schemas, paired with React Hook Form via
 * @hookform/resolvers/zod. Used by the profile-setup and edit-profile forms;
 * other composers in this app (post/event/issue/listing creation) use plain
 * local state because their validation is a single length/selection check —
 * pulling in RHF there would add indirection without a real benefit. This
 * schema is the one place worth the extra structure, since name/privacy
 * rules are shared between onboarding and settings and are worth keeping in
 * one typed source of truth.
 */
export const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'الاسم الأول قصير جدًا').max(40, 'الاسم الأول طويل جدًا'),
  lastName: z.string().trim().max(40, 'اسم العائلة طويل جدًا').optional().or(z.literal('')),
  bio: z.string().trim().max(160, 'النبذة طويلة جدًا').optional().or(z.literal('')),
  namePrivacy: z.enum(['full', 'first_last_initial', 'first_only']),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
