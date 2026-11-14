import test from 'node:test';
import assert from 'node:assert/strict';
import {hasActiveAdvertising} from './event-presentation.ts';
test('Acquisition button is hidden for every active paid placement and reserved advertiser, and returns after expiry',()=>{
 const now=new Date('2026-11-14T12:00:00Z'),base={id:'listing',start_at:'',promotion_status:'active'};
 for(const placement of ['highlight','category','homepage']){
  const ad={...base,advertising_placements:[{placement,starts_at:'2026-11-01',ends_at:'2026-12-01'}]};
  assert.equal(hasActiveAdvertising(ad,now),true);
  assert.equal(hasActiveAdvertising(ad,new Date('2026-12-01')),false);
  assert.equal(hasActiveAdvertising({...ad,promotion_status:'ended'},now),false);
 }
 assert.equal(hasActiveAdvertising({...base,reserved_homepage:true},now),true);
 assert.equal(hasActiveAdvertising({...base,reserved_category_id:'category'},now),true);
 assert.equal(hasActiveAdvertising({...base,promotion_type:'highlight',promotion_start_at:'2026-11-01',promotion_end_at:'2026-12-01'},now),true);
 assert.equal(hasActiveAdvertising({...base,promotion_status:'requested',advertising_placements:[]},now),false);
});
