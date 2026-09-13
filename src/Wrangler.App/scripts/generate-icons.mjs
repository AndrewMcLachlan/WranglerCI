import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Regenerates the PWA raster icons from the SVG logo. Run with `npm run icons`
 * after changing the logo; the output is committed.
 *
 * Rasters exist because SVG is not enough: iOS ignores an SVG apple-touch-icon
 * and substitutes a screenshot of the page, and Android's launcher wants a
 * maskable PNG it can crop to whatever shape the device uses.
 */

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const iconsDir = join(publicDir, "icons");

/** Matches the manifest's background_color, so the icon is never transparent where a platform won't allow it. */
const BACKGROUND = "#06060a";

/**
 * Android crops a maskable icon to an arbitrary shape and guarantees only the
 * centre 80% survives, so the artwork is inset to sit inside that safe zone.
 */
const MASKABLE_SAFE_ZONE = 0.8;

const render = async (svg, size, { inset = 1, background = BACKGROUND } = {}) => {
    const artwork = Math.round(size * inset);
    const padding = Math.round((size - artwork) / 2);

    return sharp(svg)
        .resize(artwork, artwork, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({
            top: padding,
            bottom: size - artwork - padding,
            left: padding,
            right: size - artwork - padding,
            background,
        })
        .flatten({ background })
        .png()
        .toBuffer();
};

const icons = [
    { file: "icon-192.png", size: 192, options: {} },
    { file: "icon-512.png", size: 512, options: {} },
    { file: "icon-maskable-512.png", size: 512, options: { inset: MASKABLE_SAFE_ZONE } },
    // iOS applies its own rounded-rect mask and never a transparent background.
    { file: "apple-touch-icon.png", size: 180, options: { inset: 0.86 } },
];

const svg = await readFile(join(publicDir, "logo-white.svg"));

await mkdir(iconsDir, { recursive: true });

for (const { file, size, options } of icons) {
    await writeFile(join(iconsDir, file), await render(svg, size, options));
    console.log(`${file} (${size}x${size})`);
}
