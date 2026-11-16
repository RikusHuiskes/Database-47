import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {LOCALE_COOKIE,localeFrom} from '../../lib/i18n';
import {manualCopy} from './manual-copy';

export async function generateMetadata():Promise<Metadata>{
 const copy=manualCopy[localeFrom((await cookies()).get(LOCALE_COOKIE)?.value)];
 return {title:copy.title+' | Côte de Duras',description:copy.description,alternates:{canonical:'https://www.cotededuras.com/handleiding'}};
}

const legacyAnchors:Record<string,string[]>={wijzigen:['beheer-aanvragen','correctie'],advertenties:['adverteren-gemeentegids'],'voor-beheerders':['evenementen-beheer','verwijderen-beheer','importeren-beheer','aanvragen-beheer','bedrijven-beheer','mail-beheer']};

export default async function VisitorGuide(){
 const copy=manualCopy[localeFrom((await cookies()).get(LOCALE_COOKIE)?.value)];
 return <main className="region-introduction visitor-manual" id="handleiding-top">
  <nav aria-label={copy.contents}><a href="/">{copy.home}</a><a href="/#local-discovery">{copy.discover}</a></nav>
  <p className="section-kicker">{copy.kicker}</p><h1>{copy.title}</h1>
  <p className="intro-lead">{copy.intro}</p>
  <p className="manual-tip">{copy.language}</p>
  <p className="manual-tip"><strong>{copy.updated}</strong></p>
  <nav className="manual-contents" aria-label={copy.contents}><h2>{copy.contents}</h2><ol>{copy.sections.map(section=><li key={section.id}><a href={'#'+section.id}>{section.title.replace(/^\d+\. /,'')}</a></li>)}</ol></nav>
  {copy.sections.map(section=><section id={section.id} key={section.id}>
   {legacyAnchors[section.id]?.map(id=><span id={id} key={id} aria-hidden="true"/>)}
   <h2>{section.title}</h2>
   {section.intro&&<p>{section.intro}</p>}
   {section.steps&&<ol>{section.steps.map(step=><li key={step}>{step}</li>)}</ol>}
   {section.subsections?.map(sub=><div key={sub.title}><h3>{sub.title}</h3><ul>{sub.items.map(item=><li key={item}>{item}</li>)}</ul></div>)}
   {section.notes?.map(note=><p key={note}>{note}</p>)}
   {section.links&&<p>{section.links.map(link=><a className="manual-action" key={link.href} href={link.href}>{link.label}</a>)}</p>}
  </section>)}
  <nav className="manual-bottom-nav" aria-label={copy.contents}><a href="#handleiding-top">{copy.top}</a><a href="/#local-discovery">{copy.discover}</a></nav>
 </main>;
}
