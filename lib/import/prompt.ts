import { ALL_SHEETS } from './spec';

/**
 * The prompt staff paste into ChatGPT, Claude or Gemini together with the template and the
 * developer's files (brochure, cost sheet, floor-plan book, price list, RERA certificate…).
 * Built from the column spec so it never drifts from the template.
 */
export function buildAiPrompt(): string {
  const sheetGuide = ALL_SHEETS.map((sheet) => {
    const cols = sheet.columns
      .map((c) => `  - ${c.key}${c.required ? ' (required)' : ''}${c.options ? ` [${c.options.join(' | ')}]` : ''}: ${c.help}`)
      .join('\n');
    return `### Sheet "${sheet.name}"\n${sheet.purpose}\n${cols}`;
  }).join('\n\n');

  return `You are filling in the EstateNav property import workbook (attached .xlsx template) from the developer files I attached (brochures, cost sheets / price lists, floor-plan books, master plans, FAQs, RERA certificates, project notes, spreadsheets). EstateNav lists new-launch and under-construction projects in Bengaluru, India.

GOAL
Return the same workbook, filled in, as a downloadable .xlsx file named "estatenav-import-<developer>-<date>.xlsx". Keep every sheet name and every header exactly as they are. Do not add, rename, reorder or delete columns. Do not add example rows. Leave the "Guide" and "Lists" sheets unchanged.

SCOPE: BENGALURU ONLY
- Include only projects located in Bengaluru / Bangalore (including Devanahalli, Hoskote, Nelamangala, Bidadi, Anekal, Sarjapur, Attibele, Yelahanka, Electronic City, Whitefield, Kanakapura Road and similar Bengaluru localities). Write city = Bengaluru.
- Skip every project in any other city or town (Mysuru, Mandya, Chennai, Hyderabad, Goa, Kochi, Mangaluru, Pune, Mumbai, NCR…). Do not mention them in the workbook.

HOW TO STRUCTURE THE DATA
1. Projects sheet: one row per project. If a project has phases with different K-RERA numbers, prices or possession dates (e.g. "Phase 1", "Phase 2"), make one row per phase, put the phase in "phase", and give each a different project_key (e.g. sattva-songbird-phase-1, sattva-songbird-phase-2).
2. project_key links rows across sheets: copy it exactly into every row of Units, Charges, Payment_Plan, Nearby, Specifications, Documents and More_Details for that project. Use lowercase words joined by hyphens: developer + project + phase.
3. Units sheet: one row per unit type AND per size. Every BHK gets its own row (Studio, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5 BHK, duplex, penthouse, row house, villa, each plot size, each office size). If the cost sheet lists three 2 BHK sizes (e.g. 878, 881 and 883 sq.ft), write three 2 BHK rows. Never merge different sizes into one range when the source lists them separately. Use unit_kind for studios, row houses, villas, plots, penthouses and duplexes; leave bhk blank for studios, plots and offices.
4. Charges sheet: copy every additional charge from the cost sheet as its own row (amenities / clubhouse, corpus fund, advance maintenance, electricity & water / BESCOM & BWSSB, generator, gas piping, legal fee, infrastructure, car park, floor rise, preferential location charges (PLC), GST rates, khata transfer…). Use amount + basis (lumpsum, per-sqft, percent, per-month, per-sqft-month, actuals, included). Put conditions in note (e.g. "per floor from 4th floor", "12 months", "corner plots").
5. Payment_Plan sheet: one row per milestone, in order, with the % of agreement value. Put the plan's name in Projects → payment_plan_type and the booking % in booking_amount_pct.
6. Nearby sheet: every place on the location map or in the connectivity section (metro, railway, airport, highway, IT parks, schools, colleges, hospitals, malls, markets, parks, landmarks) with distance in km and/or minutes when stated.
7. Specifications sheet: every specification line (structure, flooring per room, walls, doors, windows, kitchen, bathrooms, electrical, plumbing, lifts, security, power backup; infrastructure items for plots).
8. More_Details sheet: anything useful that has no column elsewhere (lifts per tower, units per floor, structure type, water source, EV charging, green certification, clubhouse amenities list by floor…). Nothing from the source should be lost.
9. Documents sheet: only if I give you links to the files. Otherwise leave it empty.

VALUE RULES
- Money: full rupees as plain numbers, no symbols or commas, e.g. 17928000 (not "1.79 Cr", not "₹1,79,28,000"). Lakh = 100000, crore = 10000000.
- price_min in Units = the quoted basic / agreement value for that unit. all_inclusive_price_min = the cost sheet's grand total including charges and GST (before stamp duty and registration). Fill both when the cost sheet shows both.
- Areas: sq.ft as plain numbers. carpet_sqft = RERA carpet area; super_builtup_sqft = super built-up / saleable area (SBA). For plots, carpet_sqft_min = plot area and plot_dimensions = "30 × 40 ft". If the source gives sq.m, convert (1 sq.m = 10.7639 sq.ft).
- Dates: YYYY-MM (e.g. 2031-06), or YYYY-MM-DD when the day is given. "RTMI" or "ready to move" → possession_status = ready.
- Percentages: number only (80, not 80%).
- Lists (highlights, amenities, bank_approvals, buyer_types): separate items with | . Never use commas as separators.
- Enumerated columns must use exactly one of the allowed values listed below (lowercase as shown).
- partner: use the developer's name as listed on the Lists sheet (e.g. "Sattva Group", "Prestige Group", "Puravankara" for Provident and Purva projects, "Sumadhura Group", "Century Real Estate", "Sobha").
- area: use an area name from the Lists sheet when one fits (e.g. "Sarjapur Road", "Whitefield", "North Bengaluru"). If none fits, write the micro-market name (e.g. "Budigere", "Thanisandra") and fill region (north, east, south-east, south, west or central).
- rera_number: copy exactly as printed (PRM/KA/RERA/…). Never invent one. Leave rera_verified blank.
- listing_status: draft.

ACCURACY
- Use only facts stated in the attached files. Do not guess, estimate or invent prices, sizes, dates, distances, RERA numbers, approvals, bank names or amenities. If a value is not in the files, leave the cell empty.
- When two files disagree, prefer the newest cost sheet or price list for prices and sizes, and the RERA certificate for the RERA number and completion date. Mention the conflict in More_Details (group "Notes").
- Write description and tagline in your own words from the brochure (120–300 words; no phone numbers, emails, broker names or "contact us").
- Do not include brokerage, commission, channel-partner terms or internal notes anywhere.

PHOTOS AND FILES
- If I give you a public Google Drive folder, ZIP or developer project-page link for a project, put it in media_folder_link. EstateNav fetches the photos, floor plans, master plan and brochures from it automatically.
- If I give you image file names that I will attach to the upload, put the best exterior render in cover_image, other photos in gallery_images (| separated), the master plan in master_plan_image, and each unit's plan in that unit's floor_plan_image.
- Never paste images into cells.

BEFORE YOU ANSWER, CHECK
- Every Units / Charges / Payment_Plan / Nearby / Specifications / More_Details row has a project_key that exists on the Projects sheet.
- Every Bengaluru project in the files has a Projects row; no non-Bengaluru project is included.
- Every unit size in the cost sheets and floor-plan books has its own Units row.
- No money cell contains Cr, L, ₹ or commas.
Then give me the .xlsx file, followed by a short list of anything you could not find or were unsure about.

COLUMN REFERENCE
${sheetGuide}`;
}
