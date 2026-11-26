import type { Locale } from './i18n';

export const jobTitleLocales = ['fr', 'en', 'nl'] as const;

export type JobTitle = {
  title: string;
  title_translations?: Partial<Record<Locale, string>>;
};

export function localizedJobTitle(job: JobTitle, locale: Locale): string {
  return job.title_translations?.[locale] || job.title;
}
