# ClinicianTracker

A lightweight Airtable-connected Instagram follower CRM for tracking clinician leads.

## What It Does

- Loads follower records from Airtable
- Adds new Instagram followers with Quick Add
- Tracks date, status, audience, potential offer, and notes
- Filters follower records by status, audience, offer, handle, or note
- Updates and deletes Airtable records from the app

The app is Netlify-ready. The frontend calls a Netlify function, and the function writes to Airtable so your Airtable base stays the source of truth.

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
- Functions directory: `netlify/functions`

Add this Netlify environment variable:

```text
AIRTABLE_TOKEN=your_airtable_personal_access_token
```

The app defaults to this Airtable base and table:

```text
AIRTABLE_BASE_ID=appGsqyZtEuxBZNzF
AIRTABLE_TABLE_ID=tblCIg4SCFqTAghyI
```

Default Airtable fields:

```text
IG Name
Date
Status
Audience
Potential Offer
Notes
```

## Important Instagram Boundary

Instagram does not provide a normal public API that gives every new follower identity in real time. This app does not scrape Instagram; it tracks the followers you add into Airtable.
