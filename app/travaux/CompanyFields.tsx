'use client';

import { useLanguage } from '../i18n/Language';
import { companyCopy, companySizes, legalForms, type CompanyDetails } from '../../lib/travaux-company';
import { travauxCategories, travauxCategoryLabel, travauxGroups, travauxText, type TravauxCategory } from '../../lib/travaux';
import { travauxCopy } from '../../lib/travaux-copy';
import styles from './travaux.module.css';

export default function CompanyFields({ profile, email }: { profile: {
  name: string; phone: string; details: CompanyDetails | null;
} | null; email?: string }) {
  const { locale } = useLanguage();
  const c = companyCopy(locale), t = travauxCopy(locale);
  const d = profile?.details;
  return <>
    <div className={styles.fields}>
      <label>{c('company')}<input name="company" defaultValue={profile?.name} autoComplete="organization" maxLength={120} required /></label>
      <label>{c('representative')}<input name="representative" defaultValue={d?.representative} autoComplete="name" maxLength={120} required /></label>
      <label>{t("Téléphone professionnel")}<input name="phone" defaultValue={profile?.phone} type="tel" autoComplete="tel" maxLength={30} required /></label>
      <label>{t("Adresse e-mail")}<input type="email" value={email ?? ''} readOnly /></label>
    </div>
    <label>{c('street')}<input name="address" defaultValue={d?.address} autoComplete="address-line1" maxLength={160} required /></label>
    <label>{c('complement')}<input name="complement" defaultValue={d?.complement} autoComplete="address-line2" maxLength={80} /></label>
    <div className={styles.fields}>
      <label>{c('postcode')}<input name="postcode" defaultValue={d?.postcode} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required /></label>
      <label>{c('city')}<input name="city" defaultValue={d?.city} autoComplete="address-level2" maxLength={100} required /></label>
      <label>SIRET<input name="siret" defaultValue={d?.siret} inputMode="numeric" pattern="[0-9]{14}" maxLength={14} required /></label>
      <label>{c('legal')}<select name="legalForm" defaultValue={d?.legalForm ?? ''} required><option value="">{t("Sélectionner")}</option>
        {legalForms.map(form => <option key={form}>{form}</option>)}</select></label>
      <label>{c('size')}<select name="size" defaultValue={d?.size ?? ''} required><option value="">{t("Sélectionner")}</option>
        {companySizes.map(size => <option key={size}>{size}</option>)}</select></label>
    </div>
    <label>{c('cert')}<textarea name="certifications" defaultValue={d?.certifications} rows={2} maxLength={400} placeholder="RGE, Qualibat…" /></label>
    <fieldset><legend>{c('specialty')}</legend>
      {Object.entries(travauxGroups).map(([group, label]) => <section key={group}>
        <strong>{travauxText(label, locale)}</strong>
        <div className={styles.fields}>
          {(Object.keys(travauxCategories) as TravauxCategory[]).filter(key => travauxCategories[key][0] === group)
            .map(key => <label key={key} className={styles.check}>
              <input type="checkbox" name="specialties" value={key} defaultChecked={d?.specialties.includes(key)} />
              {travauxCategoryLabel(key, locale)}
            </label>)}
        </div>
      </section>)}
    </fieldset>
  </>;
}
