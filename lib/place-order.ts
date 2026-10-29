export function alphabeticalPlaces<T extends {name:string}>(places:readonly T[],locale='nl') {
  const compare=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
  return [...places].sort((a,b)=>compare.compare(a.name,b.name));
}
