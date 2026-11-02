import {cookies} from 'next/headers';
import type {Metadata} from 'next';
import {LOCALE_COOKIE,localeFrom,createTranslator} from '../../lib/i18n';
import en from './messages/en.json';
import fr from './messages/fr.json';
export async function localizeMetadata(metadata:Metadata):Promise<Metadata>{const locale=localeFrom((await cookies()).get(LOCALE_COOKIE)?.value),t=createTranslator(locale,locale==='en'?en:locale==='fr'?fr:{});return {...metadata,title:typeof metadata.title==='string'?t(metadata.title):metadata.title,description:metadata.description?t(metadata.description):metadata.description};}
