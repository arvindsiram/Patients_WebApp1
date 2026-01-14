# Setup Guide for Patient Flow Dashboard Features

This guide explains how to set up the new features that have been implemented.

## Features Implemented

1. **Account Registration with Spreadsheet Creation**
   - When a user registers, a new Google Spreadsheet is created for them
   - Email, password, and spreadsheet ID are stored in the Users_Appointments sheet

2. **Login Authentication**
   - Login checks the Users_Appointments sheet for email and password
   - On successful login, the user's allocated spreadsheet URL is loaded

3. **Appointment Synchronization**
   - When the main Appointment sheet updates, appointments are automatically synced to user-specific sheets
   - Appointments are matched by email address
   - Duplicate checking prevents adding the same appointment twice

4. **User-Specific Appointment Display**
   - AppointmentsList page displays appointments from the user's allocated spreadsheet

## Required Environment Variables

Add these to your `.env` file:

```env
VITE_GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key
VITE_USERS_SHEET_ID=1xftkSFbQbdMl4XIevPPJdYB0vqW7JJtL6HHh9CxkTPI
VITE_MAIN_APPOINTMENT_SHEET_ID=1CsN2iqFZAXStQA-xqBO_OIEFeAGlMO2rTy_g_W0rNXU
VITE_APPS_SCRIPT_URL=your_google_apps_script_web_app_url
```

## Setting Up Google Apps Script for Spreadsheet Creation

Since creating Google Spreadsheets requires OAuth2 authentication, you need to set up a Google Apps Script web app:

1. Go to https://script.google.com
2. Create a new project
3. Copy the code from `google-apps-script-example.js` into the script editor
4. Deploy as a web app:
   - Click "Deploy" > "New deployment"
   - Choose type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone" (or "Anyone with Google account" for more security)
   - Click "Deploy"
5. Copy the Web app URL and set it as `VITE_APPS_SCRIPT_URL` in your `.env` file

## Spreadsheet Structure

### Users_Appointments Sheet
Columns:
- A: email
- B: password
- C: spreadsheet_id

### Main Appointment Sheet
Columns:
- A: Patient Name
- B: Email
- C: Phone Number
- D: Patient Symptom Report URL
- E: (empty)
- F: date
- G: time
- H: status

### User-Specific Appointment Sheets
Same structure as Main Appointment Sheet, automatically populated when appointments are synced.

## How It Works

1. **Registration Flow:**
   - User enters email and password
   - System creates a new Google Spreadsheet via Google Apps Script
   - Spreadsheet is initialized with headers
   - User record is added to Users_Appointments sheet with email, password, and spreadsheet ID

2. **Login Flow:**
   - User enters email and password
   - System checks Users_Appointments sheet for matching credentials
   - On success, loads the user's spreadsheet URL

3. **Appointment Sync Flow:**
   - System periodically checks the main Appointment sheet (every 60 seconds by default)
   - For each appointment, finds the matching user by email
   - Adds the appointment to the user's spreadsheet (if not already present)
   - Duplicate checking prevents adding the same appointment twice

4. **Display Flow:**
   - AppointmentsList page uses the user's spreadsheet URL to fetch and display appointments
   - Appointments can be updated (status changes) directly in the user's spreadsheet

## Notes

- The sync runs automatically every 60 seconds when the AppointmentsList page is open
- Duplicate checking compares appointments by patient name, email, date, and time
- Spreadsheet creation requires the Google Apps Script to be properly configured
- Make sure your Google Sheets API key has access to read/write the spreadsheets

