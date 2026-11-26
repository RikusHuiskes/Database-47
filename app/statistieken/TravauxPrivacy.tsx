'use client';

import { useLanguage } from '../i18n/Language';
import copy from '../../lib/travaux-analytics-privacy.json';

export default function TravauxPrivacy() {
  const { locale } = useLanguage();
  return <p>{copy[locale].details}</p>;
}
