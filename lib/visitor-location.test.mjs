import test from 'node:test';
import assert from 'node:assert/strict';
import {visitorLocationDecision,shouldUseTownFallback} from './visitor-location.ts';
test('Only usable positions inside the covered region replace the selected town',()=>{
 assert.deepEqual(visitorLocationDecision({latitude:44.6764,longitude:0.1837,accuracy:50}).location,{latitude:44.6764,longitude:0.1837});
 assert.equal(visitorLocationDecision({latitude:52.1,longitude:5.1,accuracy:50}).reason,'outside');
 assert.equal(visitorLocationDecision({latitude:48.86,longitude:2.35}).reason,'outside');
 assert.equal(visitorLocationDecision({latitude:44.67,longitude:0.18,accuracy:100000}).reason,'inaccurate');
 assert.equal(visitorLocationDecision({latitude:NaN,longitude:0}).reason,'invalid');
 assert.equal(visitorLocationDecision({latitude:95,longitude:0}).reason,'invalid');
 assert(visitorLocationDecision({latitude:44.67,longitude:0.18},[]).location);
});
test('A successful location search with zero ordinary results falls back even when an ad is available',()=>{
 assert.equal(shouldUseTownFallback(true,0),true);
 assert.equal(shouldUseTownFallback(true,5),false);
 assert.equal(shouldUseTownFallback(false,0),false);
});
