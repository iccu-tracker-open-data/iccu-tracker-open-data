# Manual Setup

This guide describes the form, sheet, export, and environment values the app expects.

The repository does not include any live Google account URLs by default. Set your own values in `.env` or GitHub secrets:

- Form URL: `https://docs.google.com/forms/d/e/<your-form-id>/viewform`
- Sheet URL: `https://docs.google.com/spreadsheets/d/<your-sheet-id>/edit?gid=<your-export-gid>#gid=<your-export-gid>`
- Export tab gid: `<your-export-gid>`

## How the real pipeline works

1. The site links to a Google Form.
2. Responses land in a Google Sheet.
3. Moderators normalize and approve rows.
4. The public export tab is fetched as CSV during `npm run data:refresh`, `npm run build`, and `npm run generate`.
5. The build writes `data/incidents.generated.json`.
6. The page reads that JSON snapshot.

## Form specification

If you want to recreate the current form manually, use these exact labels first. The parser accepts a few legacy aliases, but these are the stable values to build against.

### Required fields

1. `Vehicle model`
Type: `Dropdown`
Options:
- `Hyundai Ioniq 5`
- `Hyundai Ioniq 6`
- `Kia EV6`
- `Other Hyundai/Kia E-GMP`

2. `Region`
Type: `Multiple choice`
Options:
- `Korea`
- `Europe`
- `North America`
- `Australia / New Zealand`
- `Middle East`
- `Other / imported`
- `Not sure`

3. `Build year`
Type: `Dropdown`
Options:
- `2021`
- `2022`
- `2023`
- `2024`
- `2025`
- `2026`
- `Not sure`

4. `Build month`
Type: `Dropdown`
Options:
- `01`
- `02`
- `03`
- `04`
- `05`
- `06`
- `07`
- `08`
- `09`
- `10`
- `11`
- `12`
- `Not sure`

5. `Kilometers at failure`
Type: `Short answer`
Validation: number greater than `0`
Help text: `Enter the odometer in km at the time of failure, for example 43000`

6. `Failure date or month`
Type: `Short answer`
Help text: `Use YYYY-MM-DD if known, otherwise MM/YYYY is enough`
Accepted examples:
- `2024-01-06`
- `01/2024`

7. `Was 41D033 (ICCU recall campaign) already installed before the failure?`
Type: `Multiple choice`
Options:
- `Yes`
- `No`
- `Not sure`

8. `Permission to publish anonymized data`
Type: `Multiple choice`
Options:
- `Yes`
- `No`

### Optional field

9. `Additional notes`
Type: `Paragraph`
Help text: `Optional: mention charging state, breaker trip, 12V symptoms, or whether this was a repeat ICCU failure. Do not include forum usernames, profile links, exact locations, weather links, or any other identifying details.`

## Form description text

Use this:

`Report an ICCU failure in less than a minute. Only anonymized data will be published. Please do not enter your full VIN, name, phone number, plate number, exact address, or other directly identifying details.`

Optional second paragraph:

`This site is not affiliated with, endorsed by, or sponsored by Hyundai Motor Group, Kia Corporation, Genesis, or any of their subsidiaries. All product names, logos, and brands are property of their respective owners and are used here for identification purposes only.`

## Sheet layout

Keep one private response tab and one public export tab.

### Private response tab

Google Forms will create the raw response columns. Add moderator columns for normalized values beside them.

### Public export tab

The public export must include these headers:

- `incident_sequence`
- `status`
- `visibility`
- `public`
- `source_type`
- `brand`
- `model`
- `region`
- `battery_kwh_nominal`
- `production_year_if_known`
- `production_month_if_known`
- `odometer_km_at_failure`
- `failure_date`
- `failure_date_precision`
- `failure_year`
- `failure_month`
- `failure_mode`
- `failure_symptoms`
- `charging_state_at_failure`
- `recall_41d033_done`
- `days_since_41d033`
- `replaced_iccu_before`
- `previous_iccu_failure_count`
- `public_comment`
- `evidence_type`

The publish rule in code is simple:

- publish rows where `public` is `1` or `true`

Anything else stays private.

## Values other users need to set

If someone else wants to build the same page with their own repo or sheet, these are the values they must set:

- `GOOGLE_FORM_URL`: their public Google Form link
- `GOOGLE_SHEET_URL`: their moderated sheet link
- `GOOGLE_SHEET_GID`: the gid of their public export tab
- `GH_REPO_URL`: their repo URL
- `SITE_URL`: their final public site URL
- `NUXT_APP_BASE_URL`: `/` or `/<repo-name>/`

Optional:

- `GOOGLE_SHEET_CSV_URL`: direct CSV export URL if they do not want automatic derivation
- `SOCIAL_IMAGE_URL`: preview image path or absolute URL
- `ICCU_SOURCE_CSV`: local CSV file for offline testing

## Known parser aliases

The normalizer still accepts a few legacy or alternate column names:

- `Miles at failure (or skip to kilometers question)` and similar variants
- `Public notes`
- `Additional notes`
- `Additional notes (optional, public)`
- `Vehicle model`
- `Region / Market`
- `Approximately failure date or month`
- `ICCU issue for the ... time:`
- `Was 41D033 (ICCU recall campaign) already installed before the failure?`
- `Public`
- `Build month` with month names, including the current sheet typo `Feburary`

That backward compatibility helps with older sheets, but new setups should use the main labels above.
