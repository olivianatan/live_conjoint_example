# Live Backpack Conjoint

Static classroom conjoint app with:

- plain `HTML/CSS/JS` frontend
- browser-generated pseudonymous respondent IDs
- `7` randomized backpack choice tasks
- per-task writes to Google Sheets through Apps Script
- one row per task with the randomization saved

## Files

- `index.html`: app shell and templates
- `styles.css`: visual styling
- `app.js`: study logic, browser ID generation, randomization, and saving
- `apps-script/Code.gs`: Apps Script backend for Google Sheets

## What you need to do

### 1. Create the Google Sheet

Create a new Google Sheet. Name it anything you want. The Apps Script code will
create a `Responses` tab automatically if it does not already exist.

### 2. Add the Apps Script backend

1. Open the Google Sheet.
2. Go to `Extensions -> Apps Script`.
3. Replace the default code with the contents of `apps-script/Code.gs`.
4. Save the project.

### 3. Deploy the Apps Script as a web app

1. In Apps Script, click `Deploy -> New deployment`.
2. Choose type `Web app`.
3. Set:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
4. Authorize the script when prompted.
5. Copy the web app URL.

### 4. Paste the web app URL into the frontend

In `app.js`, replace:

```js
saveEndpoint: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
```

with your deployed Apps Script web app URL.

### 5. Publish the frontend on GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, and `app.js`.
3. In the repo settings, enable `GitHub Pages`.
4. Publish from the branch/folder where the static files live.

You do not need to upload the `apps-script` folder to the site, but it is fine
to keep it in the repository for reference.

### 6. Test before class

Run through these checks:

- Complete one full session and confirm `7` rows appear in the sheet.
- Refresh midway through a session and confirm the app resumes.
- Temporarily disconnect from the network, complete a task, reconnect, and
  confirm the queued save retries.
- Open the app in two browsers and submit at roughly the same time.

## Response schema

Each row written to Sheets contains:

- `response_id`
- `respondent_id`
- `session_id`
- `study_version`
- `task_id`
- `task_index`
- `timestamp`
- `choice_ab`
- `selected_option`
- `final_choice`
- `price_a`
- `brand_a`
- `capacity_a`
- `laptop_sleeve_a`
- `style_a`
- `price_b`
- `brand_b`
- `capacity_b`
- `laptop_sleeve_b`
- `style_b`
- `profile_a_json`
- `profile_b_json`
- `chosen_profile_json`
- `seed`
- `device_type`
- `user_agent`

## Notes on IDs and persistence

- `respondent_id` is generated once with `crypto.randomUUID()` and stored in
  `localStorage`.
- If a student switches devices or clears browser storage, they will get a new
  pseudonymous ID.
- Tasks are generated once per session and stored locally so refreshes keep the
  same randomized task set.
