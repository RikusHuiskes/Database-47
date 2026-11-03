import { A, T } from '../i18n/Language';

type AdvertisementVariant = 'rail' | 'highlight' | 'municipal';
type AdvertisementPlacement = 'homepage' | 'category' | 'highlight' | 'municipal';

const placementLabels: Record<AdvertisementPlacement, string> = {
  homepage: 'Homepagepartner',
  category: 'Categoriepartner',
  highlight: 'Uitgelichte advertentie',
  municipal: 'Gemeentegids',
};

export default function CoteDeDurasAdvertisement({
  placement,
  variant,
  categoryName,
}: {
  placement: AdvertisementPlacement;
  variant: AdvertisementVariant;
  categoryName?: string;
}) {
  return (
    <article className={`cote-preview-ad cote-preview-ad--${variant}`} aria-label="Côte de Duras">
      <div className="cote-preview-ad-logo"><A><img src="/cote-de-duras-logo.webp" alt="" loading="lazy" /></A></div>
      <div className="cote-preview-ad-copy">
        <p className="cote-preview-ad-label">
          <T>{'Advertentie'}</T>{' · '}<T>{'Voorbeeld'}</T>{' · '}<T>{placementLabels[placement]}</T>
          {categoryName && <>{' · '}<T>{categoryName}</T></>}
        </p>
        <h3><T preserve>{'CÔTE DE DURAS'}</T></h3>
        <p><T>{'Leven, beleven en ontdekken in het zuidwesten'}</T></p>
        <a className="cote-preview-ad-cta" href="/de-streek-beleven"><T>{'Ontdek →'}</T></a>
      </div>
    </article>
  );
}
