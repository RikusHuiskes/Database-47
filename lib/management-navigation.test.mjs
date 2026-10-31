import test from 'node:test';
import assert from 'node:assert/strict';
import {managementFragment,matchingManagementLink} from './management-navigation.ts';
const id='4ae2d2b9-623d-4c90-9517-9d4da5d9fcc6',other='3aeaa474-3b28-4eaf-a04a-cb66cf934ad1';
const fragment=id+':'+ 'a'.repeat(43),different=other+':'+ 'b'.repeat(43);
test('Existing management links from another preview remain usable',()=>{
 assert.equal(managementFragment('https://previous-preview.invalid/mijn-vermelding#'+fragment).fragment,fragment);
 assert.equal(managementFragment('not-a-management-link'),null);
});
test('An upgrade only reuses saved credentials for the selected listing',()=>{
 assert.equal(matchingManagementLink(id,[{fragment}],different).id,id);
 assert.equal(matchingManagementLink(id,[{fragment:different}],different),null);
 assert.equal(matchingManagementLink(id,null,fragment).id,id);
 assert.equal(matchingManagementLink(id,[null,{},'invalid'],null),null);
});
