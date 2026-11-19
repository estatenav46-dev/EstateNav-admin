# EstateNav Admin

Admin console for estatenav.in: Bengaluru property listings, partners, regions and areas, enquiries and site settings. Next.js 14 (App Router), Firestore through the Firebase Admin SDK, images and PDFs on Cloudinary. Runs on port 3001.

```bash
npm install
npm run dev     # http://localhost:3001
```

Environment variables are listed in `.env.example` (admin login, Firebase Admin, Cloudinary, website URL and the shared revalidation secret).

## Listing a property, step by step

**Properties → Post new property** opens one form in 11 steps. The left rail shows each step, its errors and a listing-quality score. The save bar stays at the bottom.

1. **Region, area & partner.** Pick the Bengaluru region (North, East, South-East, South, West, Central). Then pick an area in that region, or click **New area** to add one already assigned to that region. Add the locality, the full address and the map pin (paste a Google Maps link and the coordinates fill in). Choose the partner from the 16-partner list.
2. **Basics.** Project name (the web address is generated from it and checked for clashes), tagline, segment, property type, sale or rent, and the description. Blank lines start paragraphs; `**bold**` and `- lists` work. Also: highlights, buyer types, and the new-launch and featured flags.
3. **Project facts.** Land in acres, units, towers, floors, open space %, clubhouse size and launch date. Empty fields are not shown on the website.
4. **Unit types & pricing.** Add each configuration (1–5 BHK, villa, plot, office) with carpet and super built-up area, price range, bathrooms, availability and a note. Upload each unit's **floor plan** right on its row. The price summary fills itself from the units. Tick **Price on request** to hide prices on the website; the starting price is still used for budget filters. An optional running offer shows as a badge.
5. **Possession & RERA.** Status, target date, RERA completion date and label; the K-RERA number and verify link; Khata, plan authority, title check; partner banks.
6. **Amenities & specifications.** Grouped amenity chips plus your own. Specification rows (structure, flooring, kitchen…): **Add standard rows** fills in the usual categories.
7. **Connectivity.** Nearby metro, IT parks, schools, hospitals, malls and airport, each with km and minutes. Optional measured drive times to office hubs.
8. **Photos & media.** Gallery (drag to reorder, pick the cover), master plan image, walkthrough video and virtual tour links.
9. **Documents.** Brochure, floor-plan set, master plan, price sheet, payment plan, RERA certificate. Each is either an uploaded file (PDF or image, up to 10 MB), a link copied into Cloudinary, or an external link for bigger files. **Public** files download from the project page. **On request** files open the enquiry form, and their links never reach the browser.
10. **More details.** Any extra label and value, grouped (maintenance, corpus fund, floor rise, payment plan, car parking…).
11. **Search & sharing.** Google title and description, with a preview. Left blank, they are written automatically.

**Save draft** keeps the listing hidden. **Publish** needs at least one photo. Every save refreshes the website within a minute.

## Partners

Only these partners can be chosen for listings: Abhee, Mana, Sobha, Bren, SNN Raj, Prestige, Puravankara, Sattva, Sumadhura, Vaswani, Total Environment, Godrej, Mantri, Brigade, Shriram and Century. The list is in `lib/partners.ts`.

A partner's database record is created the first time a listing uses it. **Partners → Set up profile** adds the about text, website, logo and track record. A track-record fact appears on the website only when it has a source and a date.

## Bulk import

**Properties → Bulk property upload.** Download the template: it has a column guide and the current partner and area IDs. Fill one row per project and upload. Rows with the same web address update the existing listing. Tick **Copy image and PDF links into Cloudinary** so photos and brochures are stored in Cloudinary (up to 40 rows per upload).

## Where things live

| Path | What |
| --- | --- |
| `components/properties/PropertyEditor.tsx`, `components/properties/editor/*` | The listing form and its 11 steps |
| `lib/data/schemas.ts` | Data model; keep identical to `EstateNav/lib/data/schemas.ts` |
| `lib/listingMeta.ts` | Labels and amenity groups shared with the website |
| `lib/partners.ts` | The partner list |
| `lib/media.ts`, `app/api/cloudinary-sign` | Signed Cloudinary uploads (images, PDFs as raw files, remote links) |
| `app/api/properties/import`, `…/template` | Excel import and template |
| `app/actions/*` | Server actions; each one refreshes the website cache |
