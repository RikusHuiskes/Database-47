import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { LOCALE_COOKIE, localeFrom } from '../../lib/i18n';
import { missionCopy } from '../../lib/mission-copy';
import { travauxEnabled } from '../../lib/travaux-server';
import Mission from './Mission';

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFrom((await cookies()).get(LOCALE_COOKIE)?.value);
  const copy = missionCopy[locale];
  return {
    title: copy.menu + ' | Côte de Duras',
    description: copy.description,
    alternates: { canonical: '/missie-visie' },
  };
}

export default function MissionPage() {
  return <Mission showTravaux={travauxEnabled()} />;
}
