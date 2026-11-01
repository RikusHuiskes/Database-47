export function GET(){return Response.json({status:'ok',region:'duras',radiusKm:50,mode:'test',releaseReady:false,build:process.env.VERCEL_GIT_COMMIT_SHA||'local'});}
