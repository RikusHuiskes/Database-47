import test from 'node:test';
import assert from 'node:assert/strict';
import {managementFragment,matchingManagementLink,managementDestination,canResumeAdvertisement,advertisementPaymentLabel} from './management-navigation.ts';
const id='4ae2d2b9-623d-4c90-9517-9d4da5d9fcc6',other='3aeaa474-3b28-4eaf-a04a-cb66cf934ad1';
const fragment=id+':'+ 'a'.repeat(43),different=other+':'+ 'b'.repeat(43);
test('Existing management links from another preview remain usable',()=>{
 assert.equal(managementFragment('https://previous-preview.invalid/mijn-vermelding#'+fragment).fragment,fragment);
 assert.equal(managementFragment('not-a-management-link'),null);
});

test('Public details and legacy upgrade URLs resolve to the same hub without credentials',()=>{
 const normal=managementDestination(new URLSearchParams({eventId:id,title:'My listing'}));
 assert.equal(normal.target.id,id);assert.equal(normal.section,'edit');
 assert.equal(managementDestination(new URLSearchParams({upgrade:'1',eventId:id})).section,'advertise');
 assert.equal(managementDestination(new URLSearchParams({onderdeel:'betalingen'})).section,'payments');
 assert.equal(managementDestination(new URLSearchParams({serviceId:'osm-123',city:'Duras'})).target.serviceId,'osm-123');
 assert.equal(managementDestination(new URLSearchParams({eventId:'bad-id'})).target,null);
 assert.equal(managementDestination(new URLSearchParams({serviceId:'osm-123'})).target,null);
 assert.equal(matchingManagementLink(id,[{fragment:different}],different),null);
});

test('Only unpaid orders with a remaining advertising period can be resumed',()=>{
 const now=new Date('2026-11-06T12:00:00Z'),ends_on='2026-12-06';
 for(const payment_status of ['requested','open','expired','failed','canceled'])assert.equal(canResumeAdvertisement({payment_status,ends_on},now),true);
 for(const payment_status of ['paid','refunded','pending','unknown'])assert.equal(canResumeAdvertisement({payment_status,ends_on},now),false);
 assert.equal(canResumeAdvertisement({payment_status:'expired',ends_on:'2026-11-06'},now),false);
 assert.equal(canResumeAdvertisement({payment_status:'requested',ends_on:'invalid'},now),false);
 assert.equal(advertisementPaymentLabel('paid'),'Betaald');
 assert.equal(advertisementPaymentLabel('anything'),'Status wordt gecontroleerd');
});
test('An upgrade only reuses saved credentials for the selected listing',()=>{
 assert.equal(matchingManagementLink(id,[{fragment}],different).id,id);
 assert.equal(matchingManagementLink(id,[{fragment:different}],different),null);
 assert.equal(matchingManagementLink(id,null,fragment).id,id);
 assert.equal(matchingManagementLink(id,[null,{},'invalid'],null),null);
});
