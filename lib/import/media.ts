import { unzipSync } from 'fflate';
import type { DocumentKind, ImageRef, PropertyDocument } from '@/lib/data/types';
import { CLOUDINARY_MAX_BYTES, destroyCloudinary, isDeliverable, uploadBufferToCloudinary } from '@/lib/cloudinaryServer';
import type { ParsedProject, ParsedUnit } from './parse';

// Finds a project's photos, plans and brochures from the links in the workbook (public Google
// Drive folders and files, ZIP downloads, developer project pages, direct image links) and copies
// them into Cloudinary, so listings never depend on someone else's server.

export type AssetRole = 'cover' | 'gallery' | 'master-plan' | 'floor-plan' | 'document';

export interface Candidate {
  role: AssetRole;
  /** URL the server downloads. Empty for attached files (the browser uploads those). */
  fetchUrl: string;
  name: string;
  /** Attached file name, when the workbook refers to a file chosen on upload. */
  local?: string;
  /** Index into project.units for a unit's own floor plan. */
  unitIndex?: number;
  docKind?: DocumentKind;
  access?: 'public' | 'on-request';
  label?: string;
  /** Link kept when a document is too large to copy. */
  viewUrl?: string;
  /** Already copied (ZIP entries are uploaded while the archive is open). */
  image?: ImageRef;
}

export interface ResolveResult {
  candidates: Candidate[];
  warnings: string[];
  videoUrl?: string;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const IMAGE_EXT = /\.(jpe?g|png|webp|tiff?|heic|heif|avif|bmp|gif)$/i;
const PDF_EXT = /\.pdf$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi|webm|mkv)$/i;

/** Internal or marketing-only files that must never reach the website. */
const SKIP = /logo|\.eps$|\.ai$|\.psd$|\bqr\b|qr[-_ ]?code|brokerage|commission|ladder|\bmou\b|agreement|guideline|incentive|payout|invoice|\.ds_store|standee|hoarding|banner|flyer|mailer|creative|campaign|newspaper|\bpress\b|\bads?\b|teaser|whatsapp status|instagram|\breel|\bstory\b|social|signature|letterhead|visiting card|kannada/i;

export const MAX_GALLERY = 30;
const MAX_PLANS = 40;
const MAX_DOCS = 15;

// ---------------- Google Drive ----------------

export function driveId(url: string): { id: string; folder: boolean } | null {
  let m = url.match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders|embeddedfolderview\?id=)\/?([\w-]{10,})/);
  if (m) return { id: m[1], folder: true };
  m = url.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/);
  if (m) return { id: m[1], folder: true };
  m = url.match(/(?:drive|docs)\.google\.com\/(?:file\/d|document\/d|presentation\/d)\/([\w-]{10,})/);
  if (m) return { id: m[1], folder: false };
  m = url.match(/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/(?:open|uc|download|thumbnail)\?(?:[^#]*&)?id=([\w-]{10,})/);
  if (m) return { id: m[1], folder: false };
  return null;
}

/** A web-sized JPEG of any public Drive image (also converts TIFF and large renders). */
export const driveImageUrl = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w2400`;
const driveDownloadUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

type DriveFile = { id: string; name: string; path: string };

async function listDriveFolder(id: string): Promise<{ ok: boolean; title: string; files: DriveFile[]; folders: { id: string; name: string }[] }> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
  const html = await res.text();
  const title = decode(html.match(/<title>([^<]*)/)?.[1] ?? '').trim();
  const files: DriveFile[] = [];
  const folders: { id: string; name: string }[] = [];
  const re = /<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?flip-entry-title">([^<]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const name = decode(m[3]).trim();
    if (decode(m[2]).includes('/folders/')) folders.push({ id: m[1], name });
    else files.push({ id: m[1], name, path: '' });
  }
  return { ok: Boolean(title) && res.ok, title, files, folders };
}

/** Walks a public Drive folder (depth ≤ 4, ≤ 40 folders). */
async function crawlDrive(rootId: string, warnings: string[]): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  const queue: { id: string; path: string; depth: number }[] = [{ id: rootId, path: '', depth: 0 }];
  let visited = 0;
  while (queue.length && visited < 40) {
    const batch = queue.splice(0, 4);
    const results = await Promise.all(batch.map(async (f) => ({ f, listing: await listDriveFolder(f.id).catch(() => null) })));
    for (const { f, listing } of results) {
      visited += 1;
      if (!listing || !listing.ok) {
        warnings.push(f.depth === 0 ? 'The Google Drive folder is not public. Share it as “Anyone with the link can view”, or attach the files instead.' : `A sub-folder in Drive could not be opened (${f.path || f.id}).`);
        continue;
      }
      for (const file of listing.files) out.push({ ...file, path: f.path });
      if (f.depth < 4) for (const sub of listing.folders) if (!SKIP.test(sub.name)) queue.push({ id: sub.id, path: `${f.path}/${sub.name}`, depth: f.depth + 1 });
    }
  }
  if (queue.length) warnings.push('The Drive folder has many sub-folders; only the first 40 were read.');
  return out;
}

// ---------------- Classification ----------------

function imageRole(text: string): AssetRole {
  if (/master\s*-?plan|site\s*plan|layout\s*plan|master\s*layout|masterplan|projectlayout/i.test(text)) return 'master-plan';
  if (/floor|unit\s*-?plans?|typical|\bbhk\b|\d\s*bhk|cluster plan|\bplans?\b|carpet/i.test(text)) return 'floor-plan';
  return 'gallery';
}

function docKind(text: string): DocumentKind {
  if (/brochure|e-?book|catalog|binder|handout|showcase|magazine/i.test(text)) return 'brochure';
  if (/floor|unit plan|plan book|planbook/i.test(text)) return 'floor-plans';
  if (/master|site plan|layout/i.test(text)) return 'master-plan';
  if (/cost|price|rate card|box price/i.test(text)) return 'price-sheet';
  if (/payment/i.test(text)) return 'payment-plan';
  if (/spec/i.test(text)) return 'specifications';
  if (/rera/i.test(text)) return 'rera-certificate';
  if (/approval|sanction|noc|\boc\b|\bcc\b/i.test(text)) return 'approval';
  return 'other';
}

/** Higher scores make better cover and gallery photos. */
function photoScore(text: string): number {
  let score = 0;
  if (/elevation|aerial|areal|tower|facade|fa[cç]ade|entrance|gate|exterior|night|day view|render/i.test(text)) score += 3;
  if (/club|pool|amenit|landscape|garden|lobby|court|gym|view|3d/i.test(text)) score += 2;
  if (/interior|living|bedroom|kitchen|balcony|show ?flat|sample flat/i.test(text)) score += 1;
  if (/whatsapp|img[_-]?\d|dsc[_-]?\d|screenshot|location|map|progress|construction|site photo/i.test(text)) score -= 2;
  return score;
}

const prettyName = (name: string) =>
  name
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/\(\s*\d+k?\s*\)|\b\d{1,2}[a-z]{3}\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|^\d+\.\s*/gi, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** Alt text from a file name, e.g. "VASANTA COVE TOWER VIEW -1(8K)" → "Tower view". */
export function altFrom(name: string, title: string, fallback: string): string {
  let text = prettyName(name)
    .replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(/whatsapp image.*|img[_ -]?\d+|dsc[_ -]?\d+|^\W+|\W+$/gi, '')
    .replace(/\s*-\s*\d+$/, '')
    .trim();
  if (text.length < 3 || /^\d+$/.test(text)) return fallback;
  text = text.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `${title} – ${text}`.slice(0, 140);
}

// ---------------- Pages and ZIPs ----------------

const JUNK = /logo|icon|sprite|favicon|avatar|placeholder|loader|spinner|pixel|tracking|bat\.bing|facebook|google-analytics|doubleclick|gravatar|emoji|badge|flag|arrow|\.svg|\.gif|data:image|whatsapp|youtube|play-?button|cpphotos|rera-?logo|qr/i;

async function scrapePage(url: string, warnings: string[], images = true): Promise<Candidate[]> {
  assertPublicUrl(url);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`the page answered ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('html')) throw new Error('the link is not a web page, Drive folder or ZIP');
  const html = (await res.text()).slice(0, 4_000_000);
  const abs = (u: string) => {
    try {
      return new URL(decode(u.trim()), url).toString();
    } catch {
      return '';
    }
  };
  const imageUrls = new Map<string, string>();
  const docs = new Map<string, string>();
  const add = (raw: string, context = '') => {
    const u = abs(raw);
    if (!u || JUNK.test(u)) return;
    const path = u.split('?')[0];
    if (IMAGE_EXT.test(path)) imageUrls.set(u, context);
    else if (PDF_EXT.test(path)) docs.set(u, context);
  };
  for (const m of Array.from(html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/gi))) add(m[1], 'cover');
  for (const m of Array.from(html.matchAll(/<img\b[^>]*>/gi))) {
    const tag = m[0];
    const alt = tag.match(/\balt=["']([^"']*)/i)?.[1] ?? '';
    const srcset = tag.match(/\b(?:data-)?srcset=["']([^"']+)/i)?.[1];
    if (srcset) {
      const largest = srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]).pop();
      if (largest) add(largest, alt);
    }
    const src = tag.match(/\b(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)/i)?.[1];
    if (src) add(src, alt);
  }
  for (const m of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi))) add(m[1], m[2].replace(/<[^>]+>/g, ' ').trim());
  for (const m of Array.from(html.matchAll(/url\(["']?([^"')]+\.(?:jpe?g|png|webp))["']?\)/gi))) add(m[1]);
  // Links embedded in page data (JSON in scripts), e.g. galleries that load after the page.
  for (const m of Array.from(html.matchAll(/https?:\\?\/\\?\/[^"'\s<>()\\]+?\.(?:jpe?g|png|webp|pdf)(?:\?[^"'\s<>()\\]*)?(?=["'\s<>()\\]|$)/gi))) add(m[0].replace(/\\\//g, '/'));

  const out: Candidate[] = [];
  for (const [u, context] of images ? Array.from(imageUrls) : []) {
    const text = `${u} ${context}`;
    const role = context === 'cover' ? 'gallery' : imageRole(text);
    out.push({ role, fetchUrl: u, name: decodeURIComponent(u.split('/').pop()?.split('?')[0] ?? 'image') + (context && context !== 'cover' ? ` ${context}` : '') });
  }
  for (const [u, context] of Array.from(docs)) {
    const text = `${u} ${context}`;
    if (SKIP.test(text)) continue;
    const kind = docKind(text);
    out.push({ role: 'document', fetchUrl: u, viewUrl: u, name: decodeURIComponent(u.split('/').pop()?.split('?')[0] ?? 'document.pdf'), docKind: kind, access: kind === 'price-sheet' ? 'on-request' : 'public' });
  }
  const host = new URL(url).hostname;
  if (!out.length) warnings.push(`No photos or PDFs were found on ${host}.`);
  else if (out.filter((c) => c.role !== 'document').length < 4)
    warnings.push(`Only ${out.filter((c) => c.role !== 'document').length} photo(s) were found on ${host}; the page probably loads its gallery with scripts. Use a Google Drive folder, image links or attached files for the full set.`);
  return out;
}

/** The importer only fetches public internet addresses (never the server's own network). */
export function assertPublicUrl(raw: string): URL {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error('only http(s) links are supported');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host === '::1' ||
    /^f[cd][0-9a-f]{2}:/.test(host)
  ) {
    throw new Error('private network addresses are not allowed');
  }
  return url;
}

async function download(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; type: string }> {
  assertPublicUrl(url);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length && length > maxBytes) throw new Error(`file is ${(length / 1048576).toFixed(0)} MB`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('empty download');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`file is larger than ${(maxBytes / 1048576).toFixed(0)} MB`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { bytes, type: res.headers.get('content-type') ?? '' };
}

/** Opens a ZIP of images (e.g. a developer's "collaterals" pack) and uploads the photos. */
async function unpackZip(url: string, propertyId: string, title: string, warnings: string[]): Promise<Candidate[]> {
  const { bytes } = await download(url, 80 * 1024 * 1024);
  const entries = unzipSync(bytes, { filter: (f) => IMAGE_EXT.test(f.name) && !/__macosx|\/\./i.test(f.name) && !SKIP.test(f.name) && f.originalSize <= 25 * 1024 * 1024 });
  const names = Object.keys(entries).sort((a, b) => photoScore(b) - photoScore(a));
  const out: Candidate[] = [];
  let skipped = 0;
  for (let i = 0; i < names.length && out.length < MAX_GALLERY; i += 4) {
    const slice = names.slice(i, i + 4);
    const uploaded = await Promise.all(
      slice.map(async (name) => {
        const data = entries[name];
        if (data.byteLength > CLOUDINARY_MAX_BYTES) {
          skipped += 1;
          return null;
        }
        const role = imageRole(name);
        try {
          const up = await uploadBufferToCloudinary(data, name.split('/').pop() ?? 'image.jpg', `properties/${propertyId}/${role === 'gallery' ? 'gallery' : 'plans'}`);
          const image: ImageRef = { id: up.publicId, storagePath: up.publicId, url: up.url, alt: altFrom(name.split('/').pop() ?? '', title, `${title} photo`), width: up.width, height: up.height, blurDataURL: '', order: 0 };
          return { role, fetchUrl: '', name, image } as Candidate;
        } catch {
          skipped += 1;
          return null;
        }
      }),
    );
    out.push(...uploaded.filter((c): c is Candidate => Boolean(c)));
  }
  if (skipped) warnings.push(`${skipped} image(s) in the ZIP were over 10 MB or could not be uploaded; attach smaller copies if needed.`);
  if (!names.length) warnings.push('The ZIP has no JPG/PNG/WEBP photos.');
  return out;
}

// ---------------- Unit floor-plan matching ----------------

/** Links floor-plan files to unit rows by BHK, size and kind found in the file name. */
function matchUnit(name: string, units: ParsedUnit[], taken: Set<number>): number | undefined {
  const text = name.toLowerCase();
  const bhk = Number(text.match(/(\d(?:\.5)?)\s*-?\s*bhk/)?.[1] ?? NaN);
  const sizes = Array.from(text.matchAll(/\b(\d{3,4})\b/g)).map((m) => Number(m[1])).filter((n) => n >= 250 && n <= 9999);
  let best: { index: number; score: number } | null = null;
  units.forEach((u, index) => {
    if (taken.has(index) || u.floorPlan) return;
    let score = 0;
    if (!Number.isNaN(bhk) && u.bhk === bhk) score += 2;
    if (!Number.isNaN(bhk) && u.bhk != null && u.bhk !== bhk) score -= 3;
    const unitSizes = [u.carpetMin, u.carpetMax, u.superMin, u.superMax].filter((n): n is number => n != null);
    if (sizes.some((s) => unitSizes.some((us) => Math.abs(us - s) / us <= 0.015))) score += 3;
    if (u.kind !== 'apartment' && text.includes(u.kind.replace('-', ' '))) score += 2;
    if (u.kind === 'studio' && /studio/.test(text)) score += 2;
    if (score >= 3 && (!best || score > best.score)) best = { index, score };
  });
  return (best as { index: number; score: number } | null)?.index;
}

// ---------------- Main: resolve a project's media ----------------

export async function resolveMedia(project: ParsedProject, propertyId: string, title: string, options: { images: boolean } = { images: true }): Promise<ResolveResult> {
  const warnings: string[] = [];
  const candidates: Candidate[] = [];
  let videoUrl: string | undefined;
  const f = project.fields;

  const fromRef = (ref: string, role: AssetRole, extra: Partial<Candidate> = {}): Candidate | null => {
    const value = ref.trim();
    if (!value || (role !== 'document' && !options.images)) return null;
    if (!/^https?:\/\//i.test(value)) return { role, fetchUrl: '', local: value, name: value, ...extra };
    const drive = driveId(value);
    if (drive?.folder) {
      warnings.push(`A Drive folder link was given where one file is expected (${role}); use media_folder_link for folders.`);
      return null;
    }
    if (drive) {
      return role === 'document'
        ? { role, fetchUrl: driveDownloadUrl(drive.id), viewUrl: driveViewUrl(drive.id), name: extra.label || 'document.pdf', ...extra }
        : { role, fetchUrl: driveImageUrl(drive.id), name: extra.name || `${role}.jpg`, ...extra };
    }
    return { role, fetchUrl: value, viewUrl: role === 'document' ? value : undefined, name: decodeURIComponent(value.split('/').pop()?.split('?')[0] || role), ...extra };
  };

  // 1. Explicit cells.
  if (f.cover) candidates.push(...[fromRef(f.cover, 'cover')].filter((c): c is Candidate => Boolean(c)));
  for (const g of f.gallery ?? []) {
    const c = fromRef(g, 'gallery');
    if (c) candidates.push(c);
  }
  if (f.masterPlan) {
    const c = fromRef(f.masterPlan, 'master-plan');
    if (c) candidates.push(c);
  }
  (project.units ?? []).forEach((u, unitIndex) => {
    if (!u.floorPlan) return;
    const c = fromRef(u.floorPlan, 'floor-plan', { unitIndex, name: u.floorPlan.split('/').pop() || `${u.label || 'unit'} plan` });
    if (c) candidates.push(c);
  });
  for (const d of project.documents ?? []) {
    const c = fromRef(d.file, 'document', { docKind: d.kind, access: d.access, label: d.label, name: d.label || d.file.split('/').pop() || 'document' });
    if (c) candidates.push(c);
  }

  // 2. The media folder / ZIP / page.
  if (f.mediaFolder) {
    const link = f.mediaFolder;
    const drive = driveId(link);
    try {
      if (drive?.folder) {
        const files = await crawlDrive(drive.id, warnings);
        let skipped = 0;
        for (const file of files) {
          const text = `${file.path}/${file.name}`;
          if (SKIP.test(text)) {
            skipped += 1;
            continue;
          }
          if (IMAGE_EXT.test(file.name)) {
            if (options.images) candidates.push({ role: imageRole(text), fetchUrl: driveImageUrl(file.id), name: file.name });
          } else if (PDF_EXT.test(file.name)) {
            const kind = docKind(text);
            candidates.push({ role: 'document', fetchUrl: driveDownloadUrl(file.id), viewUrl: driveViewUrl(file.id), name: file.name, docKind: kind, access: kind === 'price-sheet' ? 'on-request' : 'public' });
          } else if (VIDEO_EXT.test(file.name) && !videoUrl && /walk|lifestyle|amenit|project|film|tour/i.test(text) && !/location/i.test(text)) videoUrl = driveViewUrl(file.id);
        }
        if (skipped) warnings.push(`${skipped} file(s) in Drive were left out (logos, creatives, brokerage or agreement files).`);
        if (!files.length) warnings.push('The Drive folder is empty or not shared publicly.');
      } else if (drive) {
        const c = fromRef(link, 'gallery');
        if (c) candidates.push(c);
      } else if (/\.zip(\?|$)/i.test(link)) {
        if (options.images) candidates.push(...(await unpackZip(link, propertyId, title, warnings)));
      } else if (IMAGE_EXT.test(link.split('?')[0])) {
        if (options.images) candidates.push({ role: 'gallery', fetchUrl: link, name: link.split('/').pop() ?? 'photo' });
      } else {
        candidates.push(...(await scrapePage(link, warnings, options.images)));
      }
    } catch (error) {
      warnings.push(`media_folder_link could not be read: ${error instanceof Error ? error.message : 'unknown error'}.`);
    }
  }

  // 3. Tidy up: dedupe, order photos, link plans to units, cap counts.
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const k = c.image?.url || c.fetchUrl || `local:${c.local}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const units = project.units ?? [];
  const taken = new Set(unique.filter((c) => c.unitIndex != null).map((c) => c.unitIndex!));
  for (const c of unique) {
    if (c.role === 'floor-plan' && c.unitIndex == null && units.length) {
      const index = matchUnit(c.name, units, taken);
      if (index != null) {
        c.unitIndex = index;
        taken.add(index);
      }
    }
  }
  const gallery = unique.filter((c) => c.role === 'gallery').sort((a, b) => photoScore(b.name) - photoScore(a.name));
  const covers = unique.filter((c) => c.role === 'cover');
  const masters = unique.filter((c) => c.role === 'master-plan');
  const plans = unique.filter((c) => c.role === 'floor-plan');
  const docs = unique.filter((c) => c.role === 'document');
  // Prefer explicit documents (they come first) and one file per kind from folders, except "other".
  // Up to three files of each kind (e.g. one cost sheet per tower or unit type), explicit rows always.
  const keptDocs: Candidate[] = [];
  const kinds = new Map<string, number>();
  for (const d of docs) {
    const explicit = Boolean(project.documents?.some((pd) => pd.file === d.local || d.fetchUrl.includes(pd.file) || pd.file.includes(d.fetchUrl)));
    const count = kinds.get(d.docKind ?? 'other') ?? 0;
    if (!explicit && count >= 3) continue;
    kinds.set(d.docKind ?? 'other', count + 1);
    keptDocs.push(d);
  }
  if (gallery.length > MAX_GALLERY) warnings.push(`${gallery.length} photos found; the best ${MAX_GALLERY} are used.`);
  if (plans.length > MAX_PLANS) warnings.push(`${plans.length} floor plans found; the first ${MAX_PLANS} are used.`);
  if (keptDocs.length > MAX_DOCS) warnings.push(`${keptDocs.length} documents found; the first ${MAX_DOCS} are used.`);
  if (options.images && !covers.length && !gallery.length) warnings.push('No photos found for this project. Add media_folder_link, cover_image or attach images; it stays a draft until it has a photo.');

  return {
    candidates: [...covers.slice(0, 1), ...gallery.slice(0, MAX_GALLERY - Math.min(1, covers.length)), ...masters.slice(0, 1), ...plans.slice(0, MAX_PLANS), ...keptDocs.slice(0, MAX_DOCS)],
    warnings,
    videoUrl,
  };
}

// ---------------- One image from a link (partner logos) ----------------

/**
 * Copies one image (direct link or Google Drive file) into Cloudinary. Drive files are fetched in
 * their original format first so transparent PNG and SVG logos stay transparent.
 */
export async function copyImageFromLink(link: string, folder: string, alt: string): Promise<ImageRef> {
  const drive = driveId(link);
  if (drive?.folder) throw new Error('a Drive folder was given; link the logo file itself');
  const tries = drive ? [driveDownloadUrl(drive.id), driveImageUrl(drive.id)] : [link];
  let lastError = 'could not be downloaded';
  for (const url of tries) {
    try {
      const { bytes, type } = await download(url, 30 * 1024 * 1024);
      if (!type.startsWith('image/') && !IMAGE_EXT.test(url.split('?')[0]) && !/\.svg(\?|$)/i.test(url)) {
        lastError = 'the link is not an image (is it shared publicly?)';
        continue;
      }
      if (bytes.byteLength > CLOUDINARY_MAX_BYTES) {
        lastError = 'the image is larger than 10 MB';
        continue;
      }
      const ext = type.includes('svg') ? 'svg' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      const up = await uploadBufferToCloudinary(bytes, `logo.${ext}`, folder);
      return { id: up.publicId, storagePath: up.publicId, url: up.url, alt, width: up.width, height: up.height, blurDataURL: '', order: 0 };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

// ---------------- Copying one candidate ----------------

export type Copied = ({ kind: 'image'; image: ImageRef } | { kind: 'document'; document: PropertyDocument }) & { note?: string };

export const PDF_BLOCKED_NOTE =
  'Cloudinary refused to deliver the PDF, so the original link is kept. To host PDFs on EstateNav, turn on “Allow delivery of PDF and ZIP files” in Cloudinary → Settings → Security.';

const DOC_LABEL: Record<DocumentKind, string> = {
  brochure: 'Brochure',
  'floor-plans': 'Floor plans',
  'master-plan': 'Master plan',
  'price-sheet': 'Price sheet',
  'payment-plan': 'Payment plan',
  specifications: 'Specifications',
  'rera-certificate': 'RERA certificate',
  approval: 'Approval',
  other: 'Document',
};

export async function copyCandidate(c: Candidate, propertyId: string, title: string, order: number): Promise<Copied> {
  if (c.image) return { kind: 'image', image: { ...c.image, order } };
  if (!c.fetchUrl) throw new Error(`${c.name}: attached files are uploaded by the browser`);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  if (c.role === 'document') {
    const kind = c.docKind ?? 'other';
    const label = (c.label || `${title} ${DOC_LABEL[kind].toLowerCase()}`).slice(0, 120);
    const access = c.access ?? (kind === 'price-sheet' ? 'on-request' : 'public');
    try {
      const { bytes, type } = await download(c.fetchUrl, CLOUDINARY_MAX_BYTES);
      const isPdf = type.includes('pdf') || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
      const isImage = type.startsWith('image/');
      if (!isPdf && !isImage) throw new Error('not a PDF or image (is the file shared publicly?)');
      const filename = /\.(pdf|jpe?g|png|webp)$/i.test(c.name) ? c.name : `${label}.${isPdf ? 'pdf' : 'jpg'}`;
      const up = await uploadBufferToCloudinary(bytes, filename, `properties/${propertyId}/documents`, isPdf ? 'raw' : 'image');
      // Some Cloudinary accounts block PDF delivery: keep the source link instead of a dead one.
      if (!(await isDeliverable(up.url))) {
        await destroyCloudinary(up.publicId, isPdf ? 'raw' : 'image');
        if (c.viewUrl) return { kind: 'document', note: `${c.name}: ${PDF_BLOCKED_NOTE}`, document: { id: `doc-${id}`, kind, label, url: c.viewUrl, storagePath: '', format: 'link', sizeBytes: null, access } };
        throw new Error(PDF_BLOCKED_NOTE);
      }
      return { kind: 'document', document: { id: `doc-${id}`, kind, label, url: up.url, storagePath: up.publicId, format: isPdf ? 'pdf' : 'image', sizeBytes: up.bytes, access } };
    } catch (error) {
      // Too big or not copyable: keep a link (on-request links never reach the browser).
      if (c.viewUrl) return { kind: 'document', document: { id: `doc-${id}`, kind, label, url: c.viewUrl, storagePath: '', format: 'link', sizeBytes: null, access } };
      throw new Error(`${c.name}: ${error instanceof Error ? error.message : 'could not be copied'}`);
    }
  }

  const { bytes, type } = await download(c.fetchUrl, 30 * 1024 * 1024);
  if (!type.startsWith('image/') && !IMAGE_EXT.test(c.name)) throw new Error(`${c.name}: not an image (is it shared publicly?)`);
  if (bytes.byteLength > CLOUDINARY_MAX_BYTES) throw new Error(`${c.name}: larger than 10 MB; put it in Google Drive (resized automatically) or attach a smaller copy`);
  const folder = c.role === 'gallery' || c.role === 'cover' ? 'gallery' : 'plans';
  const up = await uploadBufferToCloudinary(bytes, /\.[a-z]{3,4}$/i.test(c.name) ? c.name : `${c.name}.jpg`, `properties/${propertyId}/${folder}`);
  const fallback = c.role === 'floor-plan' ? `${title} floor plan` : c.role === 'master-plan' ? `${title} master plan` : `${title} photo ${order + 1}`;
  return { kind: 'image', image: { id: up.publicId, storagePath: up.publicId, url: up.url, alt: altFrom(c.name, title, fallback), width: up.width, height: up.height, blurDataURL: '', order } };
}
