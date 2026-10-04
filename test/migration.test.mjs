import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackup,importSql,verifyImport } from '../scripts/migrate-links.mjs';
const backup={version:1,complete:true,namespace:'test',exported_at:'2026-10-03T00:00:00Z',records:Array.from({length:17},(_,i)=>({key:`Old.${i}`,expiration:null,metadata:{a:i},value:JSON.stringify({permalink:`Old.${i}`,title:`Title ' ${i}`,url:`https://example.com/${i}?a=b`,click:i})}))};
test('all 17 records preserve IDs, URLs, titles and counts, without new ID restrictions',()=>{
  const rows=normalizeBackup(backup); assert.equal(rows.length,17);
  assert.equal(verifyImport(backup,rows.map(r=>({...r,enabled:1,deleted_at:null}))),17);
  assert.equal(importSql(backup),importSql(backup)); assert.match(importSql(backup),/ON CONFLICT\(slug\) DO NOTHING/); assert.match(importSql(backup),/Title '' 0/);
  assert.throws(()=>verifyImport(backup,rows.map(r=>({...r,title:'edited',enabled:1}))),/mismatch/);
});
test('unknown, partial, duplicate, malformed and invalid data fail without silent correction',()=>{
  assert.throws(()=>normalizeBackup({...backup,complete:false}));
  assert.throws(()=>normalizeBackup({...backup,records:backup.records.slice(1)}));
  for(const patch of [{click:'1'},{title:null},{permalink:'different'},{url:'javascript:alert(1)'},{futureField:true}]) {
    const records=structuredClone(backup.records); records[0].value=JSON.stringify({...JSON.parse(records[0].value),...patch}); assert.throws(()=>normalizeBackup({...backup,records}));
  }
});
