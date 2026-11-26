'use client';

import { useLanguage } from '../i18n/Language';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxText, type TravauxCategory } from '../../lib/travaux';
import styles from './travaux.module.css';

type Props = { legend: string } & (
  | { specialties: string[]; onChoose?: never }
  | { specialties?: never; onChoose: (key: TravauxCategory) => void }
);

export default function TradeFields({ legend, specialties, onChoose }: Props) {
  const { locale } = useLanguage();
  return <fieldset><legend>{legend}</legend>
    {Object.entries(travauxGroups).map(([group, label]) => <section key={group}>
      <strong>{travauxText(label, locale)}</strong>
      <div className={styles.fields}>
        {(Object.keys(travauxCategories) as TravauxCategory[]).filter(key => travauxCategories[key][0] === group)
          .map(key => <label key={key} className={styles.check}>
            <input type={onChoose ? 'radio' : 'checkbox'} name={onChoose ? 'category' : 'specialties'}
              value={key} defaultChecked={specialties?.includes(key)} required={Boolean(onChoose)}
              onChange={onChoose ? () => onChoose(key) : undefined} />
            {travauxCategoryLabel(key, locale)}
          </label>)}
      </div>
    </section>)}
  </fieldset>;
}
