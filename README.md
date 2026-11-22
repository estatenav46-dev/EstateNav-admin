# EstateNav Admin

Admin console for estatenav.in: Bengaluru property listings, partners, regions and areas, enquiries and site settings. Next.js 14 (App Router), Firestore through the Firebase Admin SDK, images and PDFs on Cloudinary. Runs on port 3001.

```bash
npm install
npm run dev     # http://localhost:3001
```

Environment variables are listed in `.env.example` (admin login, Firebase Admin, Cloudinary, website URL and the shared revalidation secret).

## Listing a property, step by step

**Properties → Post new property** opens one form in 12 steps. The left rail shows each step, its errors and a listing-quality score. The save bar stays at the bottom.

1. **Region, area & partner.** Pick the Bengaluru region (North, East, South-East, South, West, Central). Then pick an area in that region, or click **New area** to add one already assigned to that region. Add the locality, the full address and the map pin (paste a Google Maps link and the coordinates fill in). Choose the partner from the 16-partner list.
2. **Basics.** Project name and phase (the web address is generated from it and checked for clashes), tagline, segment, property type, sale or rent, and the description. Blank lines start paragraphs; `**bold**` and `- lists` work. Also: highlights, buyer types, and the new-launch and featured flags.
3. **Project facts.** Land in acres, units, towers, floors, open space %, clubhouse size and details, facings and launch date. Empty fields are not shown on the website.
4. **Unit types & pricing.** Add each configuration (1–5 BHK, villa, plot, office) with carpet and super built-up area, price range, bathrooms, availability and a note. **More unit details** adds the unit type (studio, row house, villa…), balcony, terrace, UDS, rate, all-inclusive price, car parks, facing, tower and number of units. Upload each unit's **floor plan** right on its row. The price summary fills itself from the units. Tick **Price on request** to hide prices on the website; the starting price is still used for budget filters. An optional running offer shows as a badge.
5. **Charges & payment plan.** Every line of the cost sheet beyond the basic price (corpus, maintenance, BESCOM/BWSSB, floor rise, PLC, GST…) with amount and basis (₹ fixed, per sq.ft, %, monthly, at actuals), and the payment schedule stage by stage. Shown on the website as “Price breakdown” and “Payment plan”.
6. **Possession & RERA.** Status, target date, RERA completion date and label; the K-RERA number and verify link; Khata, plan authority (BBMP/GBA, BDA, BMRDA, BIAAPA, Anekal, Hoskote, Nelamangala…), title check, occupancy certificate; partner banks.
7. **Amenities & specifications.** Grouped amenity chips plus your own. Specification rows (structure, flooring, kitchen…): **Add standard rows** fills in the usual categories.
8. **Connectivity.** Nearby metro, IT parks, schools, hospitals, malls and airport, each with km and minutes. Optional measured drive times to office hubs.
9. **Photos & media.** Gallery (drag to reorder, pick the cover), master plan image, walkthrough video and virtual tour links.
10. **Documents.** Brochure, floor-plan set, master plan, price sheet, payment plan, RERA certificate. Each is either an uploaded file (PDF or image, up to 10 MB), a link copied into Cloudinary, or an external link for bigger files. **Public** files download from the project page. **On request** files open the enquiry form, and their links never reach the browser.
11. **More details.** Any extra label and value, grouped, for anything without its own field.
12. **Search & sharing.** Google title and description, with a preview. Left blank, they are written automatically.

**Save draft** keeps the listing hidden. **Publish** needs at least one photo. Every save refreshes the website within a minute.

## Partners

Only these partners can be chosen for listings: Abhee, Mana, Sobha, Bren, SNN Raj, Prestige, Puravankara, Sattva, Sumadhura, Vaswani, Total Environment, Godrej, Mantri, Brigade, Shriram and Century. The list is in `lib/partners.ts`.

A partner's database record is created the first time a listing uses it. **Partners → Set up profile** adds the about text, website, logo and track record. A track-record fact appears on the website only when it has a source and a date.

## Bulk import

**Properties → Bulk upload.** Built for filling the sheet with an AI tool from the developer's brochure, cost sheet and floor-plan book.

1. **Template** downloads an empty workbook (no sample rows). **Projects** has one row per project, or per phase when phases have their own K-RERA number. The other sheets link back with `project_key` and hold one row per item, so nothing is squeezed into a cell:
   - **Units**: one row per BHK *and* per size (Studio, 1–5 BHK, 2.5/3.5 BHK, duplex, penthouse, row house, villa, each plot size), with carpet, super built-up, balcony, terrace, UDS, rate, price, all-inclusive price, car parks, facing, tower, unit count and floor plan.
   - **Charges**, **Payment_Plan**, **Nearby**, **Specifications**, **Documents**, **More_Details**.
   - **Guide** explains every column; **Lists** has the current partners, areas and allowed values (also used by the dropdowns).
2. **Copy AI prompt** copies the instructions (also in `docs/AI-IMPORT-PROMPT.md`). Paste it into ChatGPT, Claude or Gemini with the template and the developer's files; it returns the filled workbook.
3. **Photos fill themselves:** put a public Google Drive folder (“Anyone with the link”), a ZIP link or the developer's project page in `media_folder_link`. Photos, master plan, floor plans (matched to units by BHK and size), brochures and cost sheets are found, sorted and copied into Cloudinary; cost sheets are marked “on request”; logos, creatives, brokerage and agreement files are skipped. Large Drive renders (TIFF, 8K) are resized by Google first. You can also attach images or a whole folder on upload: write file names in `cover_image`, `gallery_images`, `master_plan_image`, `floor_plan_image`, or use a sub-folder named after each `project_key`. Pages that load their gallery with scripts (e.g. Prestige channel-partner pages) give only a few photos; use Drive or attached files for those.
4. **Upload Excel → Read workbook** shows every project, its units and counts, the partner and area it matched, and any errors before anything is saved. Projects outside Bengaluru, unknown partners and unknown areas without a region are skipped. **Import** then saves each project (two at a time) with live progress.

Rules: money in full rupees (the importer also understands “1.5 Cr”, “85 L”, “1,03,35,000”), areas in sq.ft, dates as YYYY-MM, lists separated by `|`. A new area name with a region creates the area. Re-uploading a `project_key` updates that listing: filled cells overwrite, empty cells keep what is there, and a child sheet with rows for the project replaces that list. Existing listings keep their photos unless **Re-import photos** is ticked. Listings are saved as drafts unless the sheet says `published` and they have a photo.

## Where things live

| Path | What |
| --- | --- |
| `components/properties/PropertyEditor.tsx`, `components/properties/editor/*` | The listing form and its 12 steps |
| `lib/data/schemas.ts` | Data model; keep identical to `EstateNav/lib/data/schemas.ts` |
| `lib/listingMeta.ts` | Labels and amenity groups shared with the website |
| `lib/partners.ts` | The partner list |
| `lib/media.ts`, `app/api/cloudinary-sign` | Signed Cloudinary uploads (images, PDFs as raw files, remote links) |
| `lib/import/spec.ts` | The import workbook's sheets and columns (template, guide, parser and AI prompt all read it) |
| `lib/import/parse.ts`, `values.ts` | Reading the workbook and the many ways brochures write prices, areas and dates |
| `lib/import/media.ts` | Drive folders, ZIPs, project pages and links → photos, plans and documents in Cloudinary |
| `lib/import/build.ts`, `lookup.ts` | Turning a parsed project into a listing; matching partners and areas |
| `app/api/properties/import/*`, `…/template` | Import steps (read → media → copy → save → finish), template and AI prompt |
| `app/actions/*` | Server actions; each one refreshes the website cache |
