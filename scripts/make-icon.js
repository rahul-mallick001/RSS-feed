const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico").default;

const outDir = path.join(__dirname, "..", "build");
const svg = fs.readFileSync(path.join(outDir, "icon.svg"));
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

(async () => {
  for (const size of sizes) {
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `icon-${size}.png`));
  }

  // electron-builder wants build/icon.png (512) and build/icon.ico (multi-size)
  fs.copyFileSync(path.join(outDir, "icon-512.png"), path.join(outDir, "icon.png"));

  const ico = await pngToIco(
    [16, 24, 32, 48, 64, 128, 256].map((s) => path.join(outDir, `icon-${s}.png`))
  );
  fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
  console.log("wrote build/icon.png and build/icon.ico");
})();
