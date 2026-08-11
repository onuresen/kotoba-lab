// aozora.js — import a plain-text file, especially Aozora Bunko downloads.
// Aozora .txt files are historically Shift-JIS and carry ruby + annotation
// markup and a metadata header/colophon. This decodes the bytes and strips that
// markup so the reader sees clean prose. Fully client-side (TextDecoder) — no
// upload, no network.

// Decode an ArrayBuffer: prefer UTF-8, fall back to Shift-JIS (the Aozora norm).
export function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf); // last resort, lossy
    }
  }
}

// Strip Aozora markup + metadata framing.
export function cleanAozora(text) {
  let t = text.replace(/\r\n?/g, '\n');

  // ruby: 漢字《かんじ》 → 漢字 ; the ｜ base-start delimiter → gone
  t = t.replace(/《[^》]*》/g, '').replace(/｜/g, '');
  // editor annotations: ［＃…］ (full-width) and [#…] (half-width)
  t = t.replace(/［＃[^］]*］/g, '').replace(/\[#[^\]]*\]/g, '');
  // gaiji fallbacks like ※［＃…］ leave a stray ※ sometimes
  t = t.replace(/※(?=\s|$)/g, '');

  const lines = t.split('\n');
  const out = [];
  let ruleCount = 0;   // Aozora's header explanation sits between the 1st and 2nd rule lines
  let hitColophon = false;
  for (const line of lines) {
    const s = line.trim();
    if (/^[-─―—=＝]{5,}$/.test(s)) { ruleCount++; continue; } // horizontal-rule frames
    if (/^底本[：:]/.test(s) || /^底本の親本/.test(s)) hitColophon = true; // bibliographic colophon
    if (hitColophon) continue;      // drop everything from the colophon on
    if (ruleCount === 1) continue;  // inside the top header-explanation block
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Read a File object → cleaned text (Promise).
export function readAozoraFile(file) {
  return file.arrayBuffer().then((buf) => cleanAozora(decodeBuffer(buf)));
}
