// Renders every app icon from the two SVG masters in public/brand.
//   npm run icons
// Outputs are committed; re-run only when the logo changes.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const full = readFileSync("public/brand/aio-mark.svg", "utf8");
const simple = readFileSync("public/brand/aio-mark-simple.svg", "utf8");

const sized = (svg, size) => Buffer.from(svg.replace("<svg ", `<svg width="${size}" height="${size}" `));
const render = (svg, size) => sharp(sized(svg, size)).png().toBuffer();

async function onBackground(svg, canvas, markSize, background) {
  const mark = await render(svg, markSize);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

// ICO container holding PNG images (supported by every current browser).
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, o);
    directory.writeUInt8(size >= 256 ? 0 : size, o + 1);
    directory.writeUInt16LE(1, o + 4);
    directory.writeUInt16LE(32, o + 6);
    directory.writeUInt32LE(data.length, o + 8);
    directory.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

mkdirSync("public/icons", { recursive: true });

// Favicons: the simple mark stays legible at tab size.
copyFileSync("public/brand/aio-mark-simple.svg", "src/app/icon.svg");
const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await render(simple, size) })));
writeFileSync("src/app/favicon.ico", toIco(icoImages));

// iOS home screen: opaque background (iOS fills transparency with black).
writeFileSync("src/app/apple-icon.png", await onBackground(full, 180, 132, WHITE));

// PWA: transparent "any" icons and a maskable one inside the 80% safe zone.
writeFileSync("public/icons/icon-192.png", await render(full, 192));
writeFileSync("public/icons/icon-512.png", await render(full, 512));
writeFileSync("public/icons/icon-maskable-512.png", await onBackground(full, 512, 300, WHITE));

// Link preview (Zalo, Messenger, ...).
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F3F6F8"/>
  <text x="470" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="150" font-weight="700" fill="#17212B" letter-spacing="-3">AIO</text>
  <text x="474" y="378" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#4B5A69">Thu chi, khoản nợ và dạy gia sư</text>
  <text x="474" y="430" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#4B5A69">trong một ứng dụng.</text>
</svg>`);
const ogMark = await render(full, 300);
writeFileSync(
  "src/app/opengraph-image.png",
  await sharp(og)
    .composite([{ input: ogMark, left: 120, top: 165 }])
    .png()
    .toBuffer(),
);

// Large preview for visual review only (not referenced by the app).
mkdirSync(".preview", { recursive: true });
writeFileSync(".preview/mark-1024.png", await onBackground(full, 1024, 900, WHITE));
writeFileSync(".preview/mark-simple-64.png", await onBackground(simple, 64, 64, WHITE));

console.log("icons written");
