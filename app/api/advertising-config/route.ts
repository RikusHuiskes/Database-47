import {ADVERTISING_SELLER} from '../../../lib/mollie';
import {MONTHLY_PRICES} from '../../../lib/advertising';
export function GET(){return Response.json({configured:Boolean(process.env.MOLLIE_API_KEY),monthlyPrices:MONTHLY_PRICES,seller:ADVERTISING_SELLER},{headers:{'Cache-Control':'no-store'}});}
