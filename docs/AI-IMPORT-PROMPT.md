# AI prompt for the property import

Copy everything below the line into ChatGPT, Claude or Gemini. Attach the import template (Admin → Properties → Bulk upload → Template) and the developer's files (brochure, cost sheet / price list, floor-plan book, RERA certificate). The admin's **Copy AI prompt** button copies the same text.

---

You are filling in the EstateNav property import workbook (attached .xlsx template) from the developer files I attached (brochures, cost sheets / price lists, floor-plan books, master plans, FAQs, RERA certificates, project notes, spreadsheets). EstateNav lists new-launch and under-construction projects in Bengaluru, India.

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
### Sheet "Projects"
One row per project. If a project has phases with different K-RERA numbers, prices or possession dates, give each phase its own row and its own project_key.
  - project_key (required): Short unique ID in lowercase with hyphens. Links this project to its rows on every other sheet and becomes the web address. Re-importing the same key updates the listing.
  - project_name (required): Project name as the developer markets it, without the phase.
  - phase: Phase, tower group or edition, when the row is one phase of a bigger project.
  - partner (required): Developer name or partner ID from the Lists sheet. Only listed partners are accepted.
  - city (required): Must be Bengaluru. Rows for any other city are skipped. Devanahalli, Hoskote, Nelamangala, Bidadi, Anekal, Sarjapur and Attibele count as Bengaluru.
  - region [north | east | south-east | south | west | central]: Bengaluru region. Required when the area is new (the area is then created in this region).
  - area (required): Area (micro-market) name or ID from the Lists sheet, e.g. Whitefield, Sarjapur Road, North Bengaluru. A new name together with a region creates the area.
  - locality (required): Locality or landmark shown on cards.
  - address: Full site address as printed on the brochure or RERA certificate.
  - pincode: 6-digit PIN code.
  - google_maps_link: Google Maps link to the site. Coordinates are read from it when latitude/longitude are blank.
  - latitude: Decimal latitude (Bengaluru is about 12.7 to 13.4).
  - longitude: Decimal longitude (Bengaluru is about 77.3 to 77.9).
  - property_type [apartment | villa | row-house | villament | penthouse | independent-house | plot | office | retail]: Main type of the project. Mixed projects use the main type; each unit row has its own unit_kind.
  - segment [residential | plot | commercial]: Leave blank to derive it from property_type (plot → plot, office/retail → commercial, else residential).
  - transaction [sale | rent]: sale (default) or rent.
  - listing_status [draft | published]: draft keeps it hidden for review (default). published shows it on the website; it needs at least one photo.
  - new_launch [yes | no]: yes for a new launch or pre-launch.
  - featured [yes | no]: yes to feature on the home page.
  - buyer_types: Who it suits, separated by |. Any of: first-home, upgrading, nri, senior, investor.
  - tagline: One line under the name, about 60–110 characters.
  - description: Full description in your own words from the brochure. Separate paragraphs with a blank line. 120–300 words. No phone numbers or broker details.
  - highlights: Key selling points, one per line or separated by |. Up to 12.
  - land_acres: Land area in acres (number only).
  - total_units: Total units in this project or phase.
  - towers: Number of towers or blocks.
  - floors: Floor count as written, e.g. 2B + G + 48.
  - open_space_pct: Open space in % (number only).
  - clubhouse_sqft: Clubhouse size in sq.ft (number only).
  - clubhouse_details: Anything else about the clubhouse, e.g. levels or a second kids’ clubhouse.
  - facing_options: Facings available.
  - launch_date: Launch month, YYYY-MM or YYYY-MM-DD.
  - price_on_request [yes | no]: yes hides every price on the website (prices are still used for budget filters).
  - starting_price: Lowest price in ₹. Only needed when the Units sheet has no prices. Full rupees (15000000), or 1.5 Cr / 85 L.
  - max_price: Highest price in ₹. Only needed when the Units sheet has no prices.
  - avg_rate_per_sqft: Base rate in ₹ per sq.ft (on super built-up, or on plot area for plots).
  - price_includes: What the quoted prices include or exclude, printed beside the price.
  - rent_per_month: Monthly rent in ₹, for rental listings only.
  - offer_text: A running offer shown as a badge, only if the source states it.
  - offer_valid_until: Last day of the offer, YYYY-MM-DD.
  - payment_plan_type: e.g. Construction linked, Time linked, 20:80, Down payment.
  - booking_amount_pct: Booking amount as % of agreement value.
  - possession_status [ready | under-construction | pre-launch]: ready (RTMI / ready to move), under-construction or pre-launch.
  - possession_date: Developer’s possession month, YYYY-MM.
  - possession_label: Optional label; written from the date if blank (e.g. Jun 2031).
  - rera_number: K-RERA project registration number exactly as printed (e.g. PRM/KA/RERA/1251/446/PR/060924/007008).
  - rera_completion_date: Completion date on the RERA registration, when shown.
  - rera_verified [yes | no]: yes only after checking the number on rera.karnataka.gov.in.
  - khata [A | B | E]: Khata type, only if stated.
  - plan_authority [BBMP | GBA | BDA | BMRDA | BIAAPA | APA | HPA | NPA | KIADB | DTCP | Panchayat | Other]: Authority that sanctioned the plan, only if stated. BBMP/GBA city, BDA, BMRDA, BIAAPA (airport area), APA (Anekal), HPA (Hoskote), NPA (Nelamangala), KIADB, DTCP, Panchayat, Other.
  - title_check [clear | pending]: Title status, only if stated.
  - oc_status [received | applied | not-yet]: Occupancy certificate, for ready or nearly ready projects.
  - approval_notes: Other approvals or legal notes (BWSSB, BESCOM, fire NOC, environment clearance…).
  - bank_approvals: Banks that have approved the project, separated by |.
  - amenities: Every amenity, one per line or separated by |. Use short names (Swimming pool, Gym, Co-working space…). Do not use commas as separators.
  - media_folder_link: Fills the photos, floor plans, master plan and brochures automatically. Accepts a public Google Drive folder (anyone with the link), a ZIP download link, or the developer’s project page. Images are copied to EstateNav.
  - cover_image: Main photo (best exterior render). An image URL, a Google Drive file link, or the file name of an image attached on upload.
  - gallery_images: More photos, separated by | (URLs, Drive links or attached file names). Combined with the folder above.
  - master_plan_image: Master plan or site layout image (URL, Drive link or file name).
  - video_url: Walkthrough video link (YouTube or Drive).
  - virtual_tour_url: 360° / virtual tour link.
  - seo_title: Google title, under 60 characters. Written automatically if blank.
  - seo_description: Google description, 140–160 characters. Written automatically if blank.

### Sheet "Units"
One row per unit type or size: each BHK (1, 1.5, 2, 2.5, 3, 3.5, 4, 5 BHK), studio, duplex, penthouse, row house, villa, plot size or office. A project with two 3 BHK sizes gets two 3 BHK rows. Copy every size from the cost sheet or floor-plan book; do not merge them into one range.
  - project_key (required): project_key from the Projects sheet.
  - unit_kind [apartment | studio | duplex | penthouse | villa | row-house | villament | independent-house | plot | office | retail]: apartment (default), studio, duplex, penthouse, villa, row-house, villament, independent-house, plot, office or retail.
  - bhk: Bedrooms as a number: 1, 1.5, 2, 2.5, 3, 3.5, 4, 5. Blank for studios, plots and offices.
  - unit_label: Optional name; written automatically if blank (e.g. "2.5 BHK", "4 BHK Row house", "30 × 40 plot"). Add the developer’s type name if any, e.g. "3 BHK + Study" or "Type A".
  - carpet_sqft_min: RERA carpet area in sq.ft. For plots, the plot area. One size → fill min only.
  - carpet_sqft_max: Largest carpet area when this row covers a small range.
  - super_builtup_sqft_min: Super built-up / saleable area in sq.ft.
  - super_builtup_sqft_max: Largest super built-up area for a range.
  - balcony_sqft: Balcony area in sq.ft.
  - terrace_garden_sqft: Private terrace or garden area in sq.ft (row houses, penthouses).
  - uds_sqft: Undivided share of land in sq.ft, when stated.
  - plot_dimensions: Plot or villa dimensions, e.g. 30 × 40 ft.
  - bathrooms: Number of bathrooms.
  - car_parks: Car parks included with the unit.
  - facing: Facing of this unit type, if stated.
  - tower_block: Tower, block, wing or series, if the size belongs to one.
  - units_count: How many units of this type, if stated.
  - rate_per_sqft: Base rate in ₹ per sq.ft for this unit.
  - price_min: Price in ₹ as quoted (basic or agreement value). Full rupees, or 1.5 Cr / 85 L.
  - price_max: Highest price for this row when it is a range.
  - all_inclusive_price_min: All-inclusive total from the cost sheet (basic + charges + GST, before registration).
  - all_inclusive_price_max: Highest all-inclusive total for a range.
  - availability [available | limited | sold-out]: available (default), limited or sold-out.
  - floor_plan_image: Floor plan image for this unit (URL, Drive file link or attached file name).
  - notes: Short note, e.g. "with study", "duplex", "corner units".

### Sheet "Charges"
Every line of the cost sheet beyond the basic price: amenities/clubhouse, corpus fund, maintenance, BESCOM/BWSSB or electricity & water, generator, gas piping, legal fee, car park, floor rise, preferential location (PLC), GST, infrastructure, registration notes. One row per charge.
  - project_key (required): project_key from the Projects sheet.
  - charge (required): Name of the charge as printed.
  - amount: Number only, in ₹ (or the % for a percent charge). Blank for "at actuals" or "as applicable".
  - basis [lumpsum | per-sqft | percent | per-month | per-sqft-month | actuals | included]: lumpsum (fixed ₹), per-sqft (₹ per sq.ft), percent (%), per-month (₹/month), per-sqft-month (₹ per sq.ft per month), actuals (at actuals), included (included in price).
  - payable_when: When it is paid.
  - note: Conditions, e.g. "per floor from the 4th floor", "corner plots 10%", "12 months in advance".

### Sheet "Payment_Plan"
The payment schedule, one row per stage in order, as a % of the agreement value.
  - project_key (required): project_key from the Projects sheet.
  - stage (required): The milestone.
  - percent: Percentage of the agreement value (number only).
  - note: Optional note, e.g. "within 30 days of booking".

### Sheet "Nearby"
Places near the project, as stated on the location map or brochure. One row per place.
  - project_key (required): project_key from the Projects sheet.
  - category (required) [metro | railway | airport | bus | highway | it-park | school | college | hospital | mall | market | park | landmark]: One of: metro, railway, airport, bus, highway, it-park, school, college, hospital, mall, market, park, landmark.
  - place_name (required): Name of the place.
  - distance_km: Distance in km (number only).
  - travel_mins: Drive time in minutes (number only).

### Sheet "Specifications"
Construction and finish specifications, one row per item (structure, flooring by room, kitchen, bathrooms, doors, windows, electrical, painting, lifts, security, infrastructure for plots).
  - project_key (required): project_key from the Projects sheet.
  - category (required): What it is about.
  - detail (required): The specification as written.

### Sheet "Documents"
Brochures, floor-plan books, price sheets and certificates. One row per file. Files from media_folder_link are added automatically; list here only extra ones.
  - project_key (required): project_key from the Projects sheet.
  - document_type (required) [brochure | floor-plans | master-plan | price-sheet | payment-plan | specifications | rera-certificate | approval | other]: One of: brochure, floor-plans, master-plan, price-sheet, payment-plan, specifications, rera-certificate, approval, other.
  - label: Name shown on the website; written automatically if blank.
  - file (required): File link (PDF URL or Google Drive file link) or the name of a PDF attached on upload.
  - access [public | on-request]: public = visitors download directly. on-request = visitors enquire first (default for price sheets).

### Sheet "More_Details"
Anything useful that has no column elsewhere, so nothing from the brochure is lost (structure type, lifts per tower, units per floor, water source, power backup, EV charging, pet policy, green certification…). One row per fact.
  - project_key (required): project_key from the Projects sheet.
  - group: Heading to group facts under (default "More details").
  - label (required): The fact’s name.
  - value (required): The fact’s value.