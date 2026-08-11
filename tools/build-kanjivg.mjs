// Build the offline KanjiVG subset used by Kotoba Lab.
//
// The release URL and archive digest are deliberately pinned. Runtime code
// never touches the network; this script is only for regenerating the
// committed data/kanjivg.json artifact.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const RELEASE = 'r20250816';
export const ARCHIVE_URL = 'https://github.com/KanjiVG/kanjivg/releases/download/r20250816/kanjivg-20250816-main.zip';
export const ARCHIVE_SHA256 = '69a2944ec1183086fdee5ba9c1f48bc306b867480a95b2f337f3203bf50689a3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'data', 'kanjivg.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'kanjivg.manifest.json');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  const opts = { check: false, source: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') opts.check = true;
    else if (argv[i] === '--source') opts.source = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return opts;
}

async function loadArchive(source) {
  const bytes = source
    ? await readFile(path.resolve(source))
    : Buffer.from(await fetch(ARCHIVE_URL).then((response) => {
      if (!response.ok) throw new Error(`KanjiVG download failed: HTTP ${response.status}`);
      return response.arrayBuffer();
    }));
  const digest = sha256(bytes);
  if (digest !== ARCHIVE_SHA256) {
    throw new Error(`KanjiVG archive checksum mismatch: expected ${ARCHIVE_SHA256}, got ${digest}`);
  }
  return bytes;
}

// Minimal ZIP reader for the official release archive. Supporting store and
// deflate keeps the generator dependency-free on Windows, macOS, and Linux.
function unzip(buffer) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP: end-of-central-directory record not found.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');

    if (name.endsWith('.svg')) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid ZIP entry: ${name}`);
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(start, start + compressedSize);
      const contents = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
      if (!contents) throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
      entries.set(name.replaceAll('\\', '/'), contents.toString('utf8'));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function xmlDecode(value) {
  return value
    .replaceAll('&quot;', '"').replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function attribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`));
  return match ? xmlDecode(match[1]) : null;
}

function compactPath(d) {
  return d
    .replace(/-?\d+(?:\.\d+)?/g, (raw) => {
      const rounded = Math.round(Number(raw) * 10) / 10;
      return Object.is(rounded, -0) ? '0' : String(rounded);
    })
    .replace(/,\s+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSvg(svg) {
  const start = svg.indexOf('<g id="kvg:StrokePaths_');
  const end = svg.indexOf('<g id="kvg:StrokeNumbers_');
  if (start < 0) throw new Error('SVG has no StrokePaths group.');
  const body = svg.slice(start, end < 0 ? svg.length : end);
  const paths = [];
  const roots = [];
  const stack = [];
  const tags = body.match(/<\/?g\b[^>]*>|<path\b[^>]*\/?\s*>/g) || [];

  for (const tag of tags) {
    if (tag.startsWith('</g')) {
      const node = stack.pop();
      if (node) node.count = paths.length - node.start;
      continue;
    }
    if (tag.startsWith('<g')) {
      const node = {
        element: attribute(tag, 'kvg:element'),
        position: attribute(tag, 'kvg:position'),
        original: attribute(tag, 'kvg:original'),
        start: paths.length,
        count: 0,
        children: [],
      };
      const parent = stack.at(-1);
      (parent ? parent.children : roots).push(node);
      stack.push(node);
      continue;
    }
    const d = attribute(tag, 'd');
    if (d) paths.push(compactPath(d));
  }

  const findElement = (nodes) => {
    for (const node of nodes) {
      if (node.element) return node;
      const nested = findElement(node.children);
      if (nested) return nested;
    }
    return null;
  };
  return { paths, root: findElement(roots) };
}

function makeInterner() {
  const values = [];
  const indexes = new Map();
  return {
    values,
    get(value) {
      if (value == null) return -1;
      if (!indexes.has(value)) { indexes.set(value, values.length); values.push(value); }
      return indexes.get(value);
    },
  };
}

function buildData(archive, kanjiMap) {
  const files = unzip(archive);
  const svgByHex = new Map();
  for (const [name, svg] of files) {
    const match = name.match(/\/([0-9a-f]{5})\.svg$/i);
    if (match) svgByHex.set(match[1].toLowerCase(), svg);
  }
  const elements = makeInterner();
  const positions = makeInterner();
  const output = {};
  const missing = [];

  const elementChildren = (node) => node.children.flatMap((child) => child.element
    ? [child]
    : elementChildren(child));
  const encodeNode = (node) => {
    const children = elementChildren(node).map(encodeNode);
    const encoded = [elements.get(node.element), node.start, node.count];
    const position = positions.get(node.position);
    const original = elements.get(node.original);
    if (children.length || position >= 0 || original >= 0) encoded.push(children);
    if (position >= 0 || original >= 0) encoded.push(position);
    if (original >= 0) encoded.push(original);
    return encoded;
  };

  for (const char of Object.keys(kanjiMap)) {
    const hex = char.codePointAt(0).toString(16).padStart(5, '0');
    const svg = svgByHex.get(hex);
    if (!svg) { missing.push(char); continue; }
    const parsed = parseSvg(svg);
    if (!parsed.root || !parsed.paths.length) { missing.push(char); continue; }
    output[char] = [parsed.paths, encodeNode(parsed.root)];
  }

  return {
    _meta: {
      format: 1,
      source: 'KanjiVG by Ulrich Apel (CC BY-SA 3.0)',
      release: RELEASE,
      archiveSha256: ARCHIVE_SHA256,
      requested: Object.keys(kanjiMap).length,
      covered: Object.keys(output).length,
      missing: missing.length,
      coordinatePrecision: 1,
      node: '[elementIndex, strokeStart, strokeCount, children?, positionIndex?, originalElementIndex?]',
    },
    elements: elements.values,
    positions: positions.values,
    kanji: output,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const archive = await loadArchive(opts.source);
  const dictionary = JSON.parse(await readFile(path.join(ROOT, 'data', 'kanjidic.json'), 'utf8'));
  const artifact = Buffer.from(`${JSON.stringify(buildData(archive, dictionary.kanji))}\n`);
  const manifest = Buffer.from(`${JSON.stringify({
    format: 1,
    source: { release: RELEASE, url: ARCHIVE_URL, sha256: ARCHIVE_SHA256 },
    artifact: { path: 'data/kanjivg.json', bytes: artifact.length, sha256: sha256(artifact) },
  }, null, 2)}\n`);

  if (opts.check) {
    const [currentArtifact, currentManifest] = await Promise.all([
      readFile(DATA_PATH), readFile(MANIFEST_PATH),
    ]);
    if (!currentArtifact.equals(artifact) || !currentManifest.equals(manifest)) {
      throw new Error('Generated KanjiVG data has drifted. Run npm run kanjivg:build and commit both data files.');
    }
    console.log(`KanjiVG data is current (${artifact.length.toLocaleString()} bytes).`);
    return;
  }

  await Promise.all([writeFile(DATA_PATH, artifact), writeFile(MANIFEST_PATH, manifest)]);
  console.log(`Wrote ${path.relative(ROOT, DATA_PATH)} (${artifact.length.toLocaleString()} bytes).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
