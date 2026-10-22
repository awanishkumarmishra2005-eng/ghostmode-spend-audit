# GhostMode - Recurring Charge Audit (MVP)

Finds recurring charges in a bank or card statement CSV. Everything runs in the browser.

## What it does
- Load a CSV by dropping it in, choosing a file, or pasting text
- Auto-detects headers and column names; you can change them
- Handles comma or semicolon delimiters, quoted fields, and negative or positive spending
- Groups charges by merchant and finds regular monthly, quarterly, yearly or weekly patterns
- Shows a confidence level, a price-increase flag, a "no recent charge" flag,
  and the matching transactions for every finding
- Labels likely services and gives a copy-ready cancellation request
- Exports a text report and a findings CSV

## Privacy
- No network requests and no external scripts or fonts
- Nothing is saved; close the tab and the data is gone
- The only outbound links are the account pages the user chooses to open

## Limits (read before relying on results)
- Recurring detection is rule-based. It can miss irregular billing and can flag some non-subscriptions.
- Bank CSV formats vary. Check the date format and the spending-sign setting.
- European number formats such as 1.234,56 are not supported yet.
- Account links in `services.js` are general pages and are not verified on every release.
- Not financial or legal advice.

## Run locally
Open `index.html` in a browser. Or run `python -m http.server 8000` and visit http://localhost:8000.

## Test it
1. Click "Try sample data". You should see Netflix (price up), Spotify, Adobe, and Dropbox flagged as "No recent charge".
2. Load your own export and check 3 findings against your statement by hand.
3. Try a file with semicolons and day/month dates to check the settings.

## Deploy
Vercel or GitHub Pages, with no build step.
