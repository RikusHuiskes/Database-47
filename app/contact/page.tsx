import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contactgegevens | Côte de Duras" };

export default function ContactPage() {
  return <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", lineHeight: 1.8 }}>
    <a href="/">← Terug naar Côte de Duras</a>
    <h1>Contactgegevens</h1>
    <h2>Côte de Duras</h2>
    <p>Voor vragen over de website, evenementen, advertenties of het doorgeven van een correctie kunt u contact met ons opnemen.</p>
    <dl>
      <dt>E-mail</dt>
      <dd><a href="mailto:Info@cotededuras.com">Info@cotededuras.com</a></dd>
      <dt>Telefoon</dt>
      <dd><a href="tel:+33769726794">+33 7 69 72 67 94</a></dd>
      <dt>SIRET-nummer</dt>
      <dd>93451899400025</dd>
    </dl>
    <p><a href="/disclaimer">Disclaimer</a></p>
  </main>;
}
