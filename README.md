# NAWI Report Studio

Software for generating type-evaluation test reports for **Non-Automatic Weighing Instruments (NAWI)** as per **OIML R 76**.

Built for Smart India Hackathon 2026, Problem Statement **26035** (Department of Consumer Affairs, Ministry of Consumer Affairs, Food & Public Distribution).

Today these reports are prepared by hand in spreadsheets and document templates, which is slow, error-prone and inconsistent. NAWI Report Studio records the test observations, calculates the errors, checks them against the permissible limits, and produces a standard report.

## Features

| Requirement in the problem statement | What the app does |
|---|---|
| Capture instrument details and technical specifications | Form for manufacturer, model, serial number, class, Max, Min, e, d, tare, sensor, software version and declared temperature range |
| Record laboratory and environmental conditions | Laboratory, testing officer, temperature, humidity, pressure and standard-weight certificate details |
| Enter observations for the OIML R 76 tests | Weighing, eccentricity, repeatability, tare weighing and temperature-effect forms |
| Calculate permissible errors and compliance | Errors and permissible errors computed live for every reading, with pass/fail per point |
| Validate entered data | Checks on e and d, number of scale intervals n, Min, loads above Max, indications that are not multiples of d, expired weight certificates and more |
| Determine pass/fail automatically | Per-test verdict and an overall verdict, shown live while you type |
| Standardized, printable reports | Report with auto-populated laboratory and instrument details, print or save as PDF |
| Editable format | Export to Word (`.doc`) |
| Photographs and supporting documents | Photo upload with captions; documents listed in the report |
| Digital signatures (optional) | Signature pad for the testing officer and the approving officer, with a SHA-256 integrity hash on approval |
| Role-based access | Admin, Tester, Reviewer and Viewer roles |
| Repository, search and history | Searchable repository with status, result and class filters, instrument-wise test history and CSV export of the register |
| Dashboard | Counts of completed, in-process and under-review reports, reports per month, and a work list for each role |
| Future updates to OIML recommendations | Permissible errors and limits are read from an editable rule set (JSON), not hard-coded |

## Run it

No installation or build step is needed.

1. Keep `index.html`, `style.css` and `app.js` together in one folder.
2. Open `index.html` in Chrome, Edge or Firefox. In VS Code you can also right-click it and choose **Open with Live Server**.

If the repository is published with **GitHub Pages**, open the Pages link for the repository instead.

## Try it

1. Choose a role on the sign-in screen. **Tester** enters readings, **Reviewer** approves, **Admin** has full access.
2. On the dashboard, click **Start with sample readings**.
3. Edit any reading. The error, the result and the verdict bar update immediately.
4. Click **Simulate an out-of-tolerance reading** to see a non-compliant result.
5. Go to **Review and generate**, then **Sign and submit for review**.
6. Switch role to **Reviewer** and choose **Approve and sign**.
7. Open the report and use **Print or save as PDF** or **Export to Word**.

## How compliance is calculated

For each load `L`, the tester records the indication `I` and the extra load `ΔL` that makes the indication step up by one scale interval `d` (changeover-point method).

```
P  = I + ½·d − ΔL        indication before rounding
E  = P − L               error at load L
E₀ = error at zero       measured the same way, with L = 0
Ec = E − E₀              error corrected for zero
```

A point passes when `|Ec| ≤ MPE(L)`.

The permissible error depends on the accuracy class and on the load expressed in scale intervals `m = L / e`. Other tests use the same calculation:

- **Eccentricity**: the corrected error at each of five load positions must be within the permissible error for the applied load.
- **Repeatability**: three runs at each of two loads. The spread between the largest and smallest error must not exceed the permissible error for that load.
- **Tare weighing**: weighing at net loads after taring. The tare plus the net load must not exceed Max.
- **Temperature effect**: error at one load for each temperature. The no-load indication may drift by no more than `1e` per a class-dependent number of degrees, measured against the first (reference) row.

## The rule set

All limits live in one JSON object (`DEFAULT_RULES` in `app.js`) and are shown on the **Standards and rules** page. It holds:

- the permissible-error bands for classes I, II, III and IIII
- the allowed range of `n` for each class and `e`
- the minimum capacity multiples
- the temperature drift factor

An Admin can edit the JSON and apply it in the app. Forms, validation and reports recalculate at once, and each approved report records the edition it was approved under. When OIML revises a recommendation, the change is made in this data and not in the code.

> **Important:** the values in the shipped rule set were entered from the published R 76 tables as the authors understood them. Check every value against the current OIML R 76 publication before the software is used to issue real reports.

## Project structure

```
index.html   page shell
style.css    styling, including print rules for the report
app.js       rule set, calculation engine, validation, screens, report generation
```

Pure JavaScript, HTML and CSS. No framework, no server. Fonts (Public Sans and Newsreader) load from Google Fonts and fall back to system fonts when offline.

## Data and privacy

Everything is stored in the browser's local storage on the computer being used. Nothing is sent to a server. The reports, people and manufacturers pre-loaded on first start are invented sample data.

## Current limits

- Five tests are implemented. The remaining R 76 tests, such as damp heat, voltage variation, span stability and warm-up, can be added the same way: a form, a calculation and a rule entry.
- Storage is per browser, so reports are not shared between computers. A production version needs a database and server-side authentication.
- Sign-in chooses a role and does not use passwords. It shows how the permissions behave and is not real authentication.
- PDF is produced through the browser's print dialog. The Word export is an HTML-based `.doc` file, and embedded images may not appear in every version of Word.
- The digital signature is a drawn signature plus a SHA-256 hash of the recorded data. It is not a certificate-based signature.

## Suggested production roadmap

1. Move storage to a database with proper user accounts and an audit log on the server.
2. Add the remaining R 76 tests and a configuration screen for new test types.
3. Support certificate-based digital signatures.
4. Read indications directly from the instrument or a test-bench data logger.
5. Generate native PDF and `.docx` files on the server.

## Licence

Add the licence you want to use for the repository here.
