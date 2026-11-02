import {localizeMetadata} from '../i18n/server';

import {T, A} from '../i18n/Language';
import type { Metadata } from "next";

const sourceMetadata: Metadata = { title: "Contactgegevens | Côte de Duras" };
export async function generateMetadata(){return localizeMetadata(sourceMetadata);}


export default function ContactPage() {
  return <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <a href="/"><T>{"← Terug naar Côte de Duras"}</T></a>
    <h1><T>{"Contactgegevens"}</T></h1>
    <h2><T>{"Côte de Duras"}</T></h2>
    <p><T>{"Voor vragen over de website, evenementen, advertenties of het doorgeven van een correctie kunt u contact met ons opnemen."}</T></p>
    <dl>
      <dt><T>{"E-mail"}</T></dt>
      <dd><a href="mailto:Info@cotededuras.com"><T>{"Info@cotededuras.com"}</T></a></dd>
      <dt><T>{"Telefoon"}</T></dt>
      <dd><a href="tel:+33769726794"><T>{"+33 7 69 72 67 94"}</T></a></dd>
      <dt><T>{"SIRET-nummer"}</T></dt>
      <dd><T>{"93451899400025"}</T></dd>
    </dl>
    <p><a href="/disclaimer"><T>{"Disclaimer"}</T></a></p>
  </main>;
}
