import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";

const BG = { r: 0xFA, g: 0xF6, b: 0xF0, alpha: 1 };
const SRC = "public/icon-192.png";

async function bake(size, outPath) {
  const inner = Math.round(size * 0.75);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const out = await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();

  writeFileSync(outPath, out);
  console.log("wrote", outPath, out.length);
}

await bake(192, "public/icon-192.png");
await bake(512, "public/icon-512.png");
