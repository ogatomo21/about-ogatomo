import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function normalizeBackup(backup,expected=17) {
  if(backup.version!==1 || !backup.complete || !Array.isArray(backup.records) || backup.records.length!==expected) throw Error('Incomplete backup or unexpected record count');
  const seen=new Set();
  return backup.records.map(record=>{
    if(typeof record.key!=='string' || seen.has(record.key) || !record.key || /[\/?#\u0000-\u001f\u007f]/.test(record.key)) throw Error('Unknown or duplicate legacy key');
    seen.add(record.key);
    let value; try { value=JSON.parse(record.value); } catch { throw Error(`Invalid JSON: ${record.key}`); }
    if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['permalink','url','title','click'].includes(key))) throw Error(`Unknown legacy format: ${record.key}`);
    if(value.permalink!==record.key || typeof value.url!=='string' || typeof value.title!=='string' || !Number.isSafeInteger(value.click) || value.click<0) throw Error(`Invalid legacy data: ${record.key}`);
    let url; try { url=new URL(value.url); } catch { throw Error(`Invalid URL: ${record.key}`); }
    if(!['http:','https:'].includes(url.protocol) || /[\u0000-\u001f\u007f]/.test(value.url)) throw Error(`Unsafe URL: ${record.key}`);
    const fingerprint=createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const id=`legacy-${createHash('sha256').update(`${backup.namespace}:${record.key}`).digest('hex').slice(0,32)}`;
    return { id,slug:record.key,url:value.url,title:value.title,legacy_clicks:value.click,import_fingerprint:fingerprint };
  });
}
const sqlLiteral=value=>`'${String(value).replaceAll("'","''")}'`;
export function importSql(backup,expected=17) {
  const rows=normalizeBackup(backup,expected);
  const time=sqlLiteral(backup.exported_at);
  if(!Number.isFinite(Date.parse(backup.exported_at))) throw Error('Invalid backup timestamp');
  return rows.map(row=>`INSERT INTO links (id,slug,url,title,legacy_clicks,created_at,updated_at,import_fingerprint) VALUES (${[row.id,row.slug,row.url,row.title].map(sqlLiteral).join(',')},${row.legacy_clicks},${time},${time},${sqlLiteral(row.import_fingerprint)}) ON CONFLICT(slug) DO NOTHING;`).join('\n')+'\n';
}
export function verifyImport(backup,rows,expected=17) {
  const source=normalizeBackup(backup,expected), target=new Map(rows.map(row=>[row.slug,row]));
  const issues=[];
  for(const row of source) {
    const actual=target.get(row.slug);
    if(!actual || ['id','slug','url','title','legacy_clicks','import_fingerprint'].some(key=>actual[key]!==row[key]) || actual.enabled!==1 || actual.deleted_at) issues.push(row.slug);
  }
  if(issues.length) throw Error(`Migration mismatch (no data was corrected): ${issues.join(', ')}`);
  return source.length;
}
async function exportKv(output,namespace) {
  const {CF_ACCOUNT_ID,CF_KV_READ_TOKEN}=process.env;
  if(!CF_ACCOUNT_ID || !CF_KV_READ_TOKEN || !namespace) throw Error('CF_ACCOUNT_ID, CF_KV_READ_TOKEN and namespace required');
  const base=`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${namespace}`;
  const headers={Authorization:`Bearer ${CF_KV_READ_TOKEN}`};
  const records=[]; let cursor=''; const cursors=new Set();
  do {
    const response=await fetch(`${base}/keys?limit=1000&cursor=${encodeURIComponent(cursor)}`,{headers});
    const body=await response.json();
    if(!response.ok || !body.success) throw Error('KV key export failed');
    for(const key of body.result) {
      const value=await fetch(`${base}/values/${encodeURIComponent(key.name)}`,{headers});
      if(!value.ok) throw Error(`KV value export failed: ${key.name}`);
      records.push({key:key.name,expiration:key.expiration??null,metadata:key.metadata??null,value:await value.text()});
    }
    cursor=body.result_info?.cursor||'';
    if(cursor && cursors.has(cursor)) throw Error('Repeated KV cursor');
    cursors.add(cursor);
  } while(cursor);
  const backup={version:1,namespace,exported_at:new Date().toISOString(),complete:true,records};
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(backup,null,2),{flag:'wx',mode:0o600});
  console.log(`Backed up ${records.length} records; writes must be frozen for final consistency`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [command,input,output,expected]=process.argv.slice(2);
  if(command==='export') await exportKv(input,output);
  else if(command==='sql') {
    const backup=JSON.parse(fs.readFileSync(input,'utf8'));
    fs.writeFileSync(output,importSql(backup,Number(expected||17)),{flag:'wx',mode:0o600});
    console.log('Validated migration SQL written; existing rows will never be overwritten');
  } else if(command==='verify') {
    const backup=JSON.parse(fs.readFileSync(input,'utf8'));
    const result=JSON.parse(fs.readFileSync(output,'utf8'));
    const rows=Array.isArray(result)&&result[0]?.results ? result.flatMap(r=>r.results):result;
    console.log(`Verified ${verifyImport(backup,rows,Number(expected||17))} legacy records`);
  } else throw Error('Usage: export BACKUP NAMESPACE | sql BACKUP OUTPUT.sql [COUNT] | verify BACKUP D1-ROWS.json [COUNT]');
}
