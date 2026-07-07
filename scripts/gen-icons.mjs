// One-off icon generator: renders BatchFlow icons with a dark-theme (#0f172a)
// outer background instead of white padding, so installed home-screen icons and
// maskable/splash surfaces stay consistent with the app's dark theme.
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const DARK = '#0f172a'   // slate-900, app dark background
const BLUE = '#4f46e5'   // indigo-600, brand mark

// The BatchFlow logo drawn in a 512x512 space, scaled/translated into a canvas.
const logo = (scale, ox, oy) => `
  <g transform="translate(${ox},${oy}) scale(${scale})">
    <rect width="512" height="512" rx="112" fill="${BLUE}"/>
    <rect x="64" y="136" width="240" height="48" rx="24" fill="#ffffff"/>
    <rect x="64" y="232" width="240" height="48" rx="24" fill="#ffffff"/>
    <rect x="64" y="328" width="240" height="48" rx="24" fill="#ffffff"/>
    <polyline points="352,136 448,256 352,376" fill="none" stroke="#ffffff"
      stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`

// bgRx: corner radius of the dark canvas (0 = full square). scale: logo fraction.
const canvas = (scale, bgRx = 0) => {
  const box = 512 * scale
  const off = (512 - box) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
    <rect width="512" height="512" rx="${bgRx}" fill="${DARK}"/>
    ${logo(scale, off, off)}
  </svg>`
}

// Full-square dark bg for launcher/apple/pwa icons (OS applies its own masking).
const standard = canvas(0.80, 0)
// Maskable: smaller logo so the OS safe-zone mask never clips the mark.
const maskable = canvas(0.62, 0)

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

const targets = [
  ['pwa-64x64.png', standard, 64],
  ['pwa-192x192.png', standard, 192],
  ['pwa-512x512.png', standard, 512],
  ['maskable-icon-512x512.png', maskable, 512],
  ['apple-touch-icon-180x180.png', standard, 180],
]

for (const [name, svg, size] of targets) {
  const buf = await png(svg, size)
  writeFileSync(join(PUBLIC, name), buf)
  console.log('wrote', name, size)
}

// favicon.ico: embed a 48x48 PNG (modern browsers read PNG-compressed ICO).
const favSvg = canvas(0.80, 112) // rounded dark card for the browser tab
const favPng = await png(favSvg, 48)
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0)                 // reserved
header.writeUInt16LE(1, 2)                 // type: icon
header.writeUInt16LE(1, 4)                 // image count
header.writeUInt8(48, 6)                   // width
header.writeUInt8(48, 7)                   // height
header.writeUInt8(0, 8)                    // palette
header.writeUInt8(0, 9)                    // reserved
header.writeUInt16LE(1, 10)                // color planes
header.writeUInt16LE(32, 12)               // bits per pixel
header.writeUInt32LE(favPng.length, 14)    // image size
header.writeUInt32LE(22, 18)               // offset
writeFileSync(join(PUBLIC, 'favicon.ico'), Buffer.concat([header, favPng]))
console.log('wrote favicon.ico 48')
