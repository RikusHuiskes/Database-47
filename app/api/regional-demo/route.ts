import {regionalCatalog} from '../../../lib/regional-demo';
export function GET(){const {key,brand,city,categories,updatedAt,events,sources}=regionalCatalog;return Response.json({key,brand,city,categories,updatedAt,eventCount:events.length,sources,demo:true});}
