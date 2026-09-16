import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { stripImageMetadataFromDist } from "../scripts/optimize-images.mjs";

test("deployment copies lose EXIF/XMP and retain orientation without modifying sources", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ogatomo-image-metadata-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist);
  const image = () => sharp({ create: { width: 64, height: 32, channels: 3, background: "red" } });
  const jpeg = await image().jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const png = await image().png().withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">private test metadata</x:xmpmeta>').toBuffer();
  const webp = await image().webp().withMetadata({ orientation: 6 }).toBuffer();
  fs.writeFileSync(path.join(root, "source.jpg"), jpeg);
  fs.writeFileSync(path.join(dist, "photo.jpg"), jpeg);
  fs.writeFileSync(path.join(dist, "profile-ogp.png"), png);
  fs.writeFileSync(path.join(dist, "photo.webp"), webp);
  assert.ok((await sharp(jpeg).metadata()).exif);
  assert.ok((await sharp(png).metadata()).xmp);

  assert.equal(await stripImageMetadataFromDist(dist), 3);
  for (const file of ["photo.jpg", "profile-ogp.png", "photo.webp"]) {
    const metadata = await sharp(fs.readFileSync(path.join(dist, file))).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.equal(metadata.iptc, undefined);
    assert.equal(metadata.orientation, undefined);
    assert.deepEqual([metadata.width, metadata.height], file.endsWith(".png") ? [64, 32] : [32, 64]);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, "source.jpg")), jpeg);
  const cleanJpeg = fs.readFileSync(path.join(dist, "photo.jpg"));
  assert.equal(await stripImageMetadataFromDist(dist), 0);
  assert.deepEqual(fs.readFileSync(path.join(dist, "photo.jpg")), cleanJpeg);
});
