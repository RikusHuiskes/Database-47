import {ImageResponse} from 'next/og';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  const photo = await readFile(path.join(process.cwd(), 'public/lot-et-garonne-hero.png'));
  return new ImageResponse(
    <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',background:'#21483d',color:'#fffdf5'}}>
      <img src={`data:image/png;base64,${photo.toString('base64')}`} width={1200} height={370} style={{objectFit:'cover'}} alt=""/>
      <div style={{display:'flex',flexDirection:'column',padding:'28px 48px',gap:12}}>
        <div style={{display:'flex',fontSize:62,fontWeight:700}}>Côte de Duras</div>
        <div style={{display:'flex',fontSize:30}}>Agenda · Guide local · Découvertes</div>
        <div style={{display:'flex',fontSize:25,color:'#dfd4b8'}}>Duras + 50 km  ·  cotededuras.com</div>
      </div>
    </div>,
    {width:1200,height:630,headers:{'Cache-Control':'public, max-age=31536000, immutable'}},
  );
}
