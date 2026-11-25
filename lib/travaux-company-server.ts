import { companySizes, legalForms, type CompanyDetails } from './travaux-company';
import { travauxCategories } from './travaux';
import { field, TravauxError } from './travaux-server';

export function readCompanyDetails(body: Record<string, unknown>): CompanyDetails {
  const postcode = typeof body.postcode === 'string' ? body.postcode.trim() : '';
  const siret = typeof body.siret === 'string' ? body.siret.replace(/\s/g, '') : '';
  const { legalForm, size } = body;
  const specialties = Array.isArray(body.specialties) ? [...new Set(body.specialties)] : [];
  if (!/^\d{5}$/.test(postcode) || !/^\d{14}$/.test(siret)
    || !legalForms.some(form => form === legalForm) || !companySizes.some(band => band === size)
    || !specialties.length || specialties.some(key => typeof key !== 'string' || !Object.hasOwn(travauxCategories, key))) {
    throw new TravauxError('Vérifiez le code postal, le SIRET, la forme juridique, l’effectif et les spécialités.');
  }
  return {
    representative: field(body.representative, 'nom', 120),
    address: field(body.address, 'adresse', 160),
    complement: field(body.complement, 'adresse', 80, 0),
    postcode, city: field(body.city, 'ville', 100), siret,
    legalForm: String(legalForm), size: String(size), specialties: specialties as string[],
    certifications: field(body.certifications, 'certifications', 400, 0),
  };
}

export function projectAddress(body: Record<string, unknown>, commune: { name: string; postcode: string }) {
  const address = field(body.address, 'adresse', 160);
  const complement = field(body.complement, 'adresse', 80, 0);
  return [address, complement, commune.postcode + ' ' + commune.name].filter(Boolean).join(', ');
}
