'use client';
import {useLanguage} from '../i18n/Language';
import {quickPeriodRange,type QuickPeriod} from '../../lib/event-period';
import styles from './quick-date-filters.module.css';
const labels={fr:['Aujourd’hui','Cette semaine','Ce week-end','Toutes les dates'],nl:['Vandaag','Deze week','Dit weekend','Alle datums'],en:['Today','This week','This weekend','All dates']};
export default function QuickDateFilters({start,end,onChange}:{start:string;end:string;onChange:(start:string,end:string)=>void}) {
 const {locale}=useLanguage(),words=labels[locale];
 return <div className={styles.filters} role="group" aria-label={locale==='fr'?'Choisir une période':locale==='nl'?'Kies een periode':'Choose a period'}>
 {(['today','week','weekend'] as QuickPeriod[]).map((period,index)=>{const range=quickPeriodRange(period);return <button key={period} type="button" aria-pressed={start===range.start&&end===range.end} onClick={()=>onChange(range.start,range.end)}>{words[index]}</button>;})}
 <button type="button" aria-pressed={!start&&!end} onClick={()=>onChange('','')}>{words[3]}</button>
 </div>;
}
