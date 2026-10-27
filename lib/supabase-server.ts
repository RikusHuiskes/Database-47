import {createClient} from "@supabase/supabase-js";

/** Secret API keys are not JWTs. Storage rejects them if sent as Bearer
 * tokens; keep the API key header and retain real JWT authorization. */
export function serviceFetch(key:string,baseUrl:string,fetcher:typeof fetch=fetch):typeof fetch {
  return async(input,init)=>{
    const headers=new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));
    const target=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
    if(key.startsWith("sb_secret_") && target.origin===new URL(baseUrl).origin && headers.get("authorization")===`Bearer ${key}`) headers.delete("authorization");
    return fetcher(input,{...init,headers});
  };
}
export function createServiceClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key=(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:serviceFetch(key,url)}});
}
