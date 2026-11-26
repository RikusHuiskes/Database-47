import { trackAnalytics } from './analytics-client';

export const travauxInteractions = {
  navigation: ['site_entry', 'site_exit', 'tab_intro', 'tab_jobs', 'tab_guide', 'tab_contact', 'language_change'],
  discovery: ['browse_jobs', 'view_job_card', 'filter_trade', 'filter_town', 'reset_filters', 'recommendations', 'all_jobs', 'refresh_jobs', 'more_jobs'],
  requester: ['start_project', 'my_projects', 'requester_login', 'project_email_verification', 'submit_project', 'close_project'],
  professional: ['register', 'professional_login', 'professional_link', 'professional_account', 'plan_monthly', 'plan_annual', 'checkout', 'resume_checkout', 'cancel_subscription', 'reply', 'quote', 'send_quote', 'open_email', 'copy_email', 'download_invoice'],
  support: ['submit_contact'],
} as const;

export type TravauxInteraction = typeof travauxInteractions[keyof typeof travauxInteractions][number];
const interactions: ReadonlySet<string> = new Set(Object.values(travauxInteractions).flat());

export function isTravauxInteraction(value: unknown): value is TravauxInteraction {
  return typeof value === 'string' && interactions.has(value);
}

export function trackTravaux(value: TravauxInteraction) {
  trackAnalytics('travaux_interaction', { interaction: value });
}
