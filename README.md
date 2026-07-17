# ClinicianTracker

A lightweight Instagram follower CRM for tracking clinician leads.

## What It Does

- Paste Instagram handles or profile URLs
- Import Instagram follower export JSON files
- Detect newly added followers compared with your saved CRM
- Track relationship stage, audience type, offer potential, and notes
- Download Airtable-ready CSV files

The app is static and Netlify-ready. Data is stored locally in the browser using `localStorage`, so it does not require a backend.

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:4177
```

## Deploy To Netlify

Connect this GitHub repo in Netlify and use:

- Build command: `npm run build`
- Publish directory: `.`

## Important Instagram Boundary

Instagram does not provide a normal public API that gives every new follower identity in real time. This app supports practical, compliant workflows:

- Paste handles copied from Instagram
- Import official Instagram follower exports
- Track engaged followers and leads over time

It does not scrape Instagram.
