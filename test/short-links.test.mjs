import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/[[path]].js";
import { reservedRoutes, checkCollisions } from "../scripts/reserved-routes.mjs";

function fixture({ status=404, link={ id: "stable", url: "https://example.com/a?x=1" }, dbError=false, analyticsError=false }={}) {
  const calls=[];
  const env={ ASSETS: { fetch: async () => { calls.push("static"); return new Response("asset", { status }); } }, DB: { prepare: () => ({ bind: slug => ({ first: async () => { calls.push(slug); if(dbError) throw Error(); return link; } }) }) }, LINK_ANALYTICS: { writeDataPoint: point => { calls.push(point); if(analyticsError) throw Error(); } } };
  return { calls, run: (path, method="GET") => onRequest({ request: new Request(`https://ogtm.dev${path}`, { method }), env }) };
}
test("static responses take priority even over conflicting links", async () => {
  for(const path of ["/index", "/index.html", "/index.ja", "/images/header.jpg", "/favicon.ico"]) {
    const f=fixture({status:200}); assert.equal((await f.run(path)).status,200); assert.deepEqual(f.calls,["static"]);
  }
  assert.equal((await fixture({status:301}).run("/index.html")).status,301);
});
test("302 GET, HEAD without analytics, analytics failure, DB failure, inactive and deep paths",async()=>{
  const f=fixture(); const r=await f.run("/Ab_C-d"); assert.equal(r.status,302); assert.equal(r.headers.get("cache-control"),"no-store"); assert.deepEqual(f.calls[2],{indexes:["stable"],doubles:[1]});
  const head=fixture(); assert.equal((await head.run("/x","HEAD")).status,302); assert.equal(head.calls.length,2);
  assert.equal((await fixture({analyticsError:true}).run("/x")).status,302);
  assert.equal((await fixture({dbError:true}).run("/x")).status,503);
  assert.equal((await fixture({link:null}).run("/x")).status,404);
  const deep=fixture(); assert.equal((await deep.run("/missing/deep")).status,404); assert.equal(deep.calls.length,1);
  assert.equal((await fixture().run("/x","POST")).status,404);
  assert.equal((await fixture().run("/a%2Fb")).status,404);
});
test("generated reservations cover clean URLs, directories and deleted IDs",()=>{
  const routes=reservedRoutes(["index.html","index.ja.html","works.en.html","help/index.html","favicon.ico","images/a.png"]);
  for(const p of ["/index","/index.html","/index.ja","/help","/images","/favicon.ico","/api"]) assert.ok(routes.paths.includes(p),p);
  assert.throws(()=>checkCollisions(routes,[{slug:"index",deleted_at:"yesterday"}]),/conflicts/);
  checkCollisions(routes,[{slug:"Abc"}]);
});
