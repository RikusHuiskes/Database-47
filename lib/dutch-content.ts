import catalogue from './translations/content-nl.json';
import reviewed from './translations/reviewed-public-nl.json';
/** Reviewed Dutch copy takes precedence over the generated content catalogue. */
export const dutchPublicTranslations:Record<string,string>={...catalogue,...reviewed};
