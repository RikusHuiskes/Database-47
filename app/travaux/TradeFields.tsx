'use client';

import { useLanguage } from '../i18n/Language';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxText, type TravauxCategory } from '../../lib/travaux';
import styles from './travaux.module.css';

const help = {
  fr: 'Ouvrez une catégorie pour choisir vos spécialités.',
  en: 'Open a category to select your specialities.',
  nl: 'Open een vakgebied en vink je specialismen aan.',
};

export default function TradeFields({ legend, specialties }: { legend: string; specialties: string[] }) {
  const { locale } = useLanguage();
  return <fieldset><legend>{legend}</legend>
    <p className={styles.meta}>{help[locale]}</p>
    {Object.entries(travauxGroups).map(([group, label]) => {
      const categories = (Object.keys(travauxCategories) as TravauxCategory[])
        .filter(key => travauxCategories[key][0] === group);
      return <details key={group} className={styles.tradeGroup} open={categories.some(key => specialties.includes(key))}>
        <summary>{travauxText(label, locale)}</summary>
        <div className={styles.fields}>
          {categories.map(key => <label key={key} className={styles.check}>
            <input type="checkbox" name="specialties" value={key} defaultChecked={specialties.includes(key)} />
            <span>{travauxCategoryLabel(key, locale)}</span>
          </label>)}
        </div>
      </details>;
    })}
  </fieldset>;
}
