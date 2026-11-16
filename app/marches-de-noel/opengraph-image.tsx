import {ImageResponse} from 'next/og';
export const runtime='edge';
export const alt='Marchés de Noël autour de Duras — Côte de Duras';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function ChristmasSocialImage(){return new ImageResponse(<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',background:'linear-gradient(120deg,#15392d,#345d42)',padding:'65px 85px',color:'#fff5de',border:'16px solid #d3b678'}}><div style={{display:'flex',fontSize:27,letterSpacing:5,color:'#e3c58c'}}>CÔTE DE DURAS · NOËL 2026</div><div style={{display:'flex',fontSize:88,lineHeight:1.1,marginTop:35,fontWeight:700}}>Les marchés de Noël</div><div style={{display:'flex',fontSize:60,marginTop:10}}>autour de Duras</div><div style={{display:'flex',fontSize:28,marginTop:40,color:'#e3c58c'}}>Vos sorties dans un rayon de 50 km</div><div style={{display:'flex',fontSize:23,marginTop:30}}>cotededuras.com/marches-de-noel</div></div>,size);}
