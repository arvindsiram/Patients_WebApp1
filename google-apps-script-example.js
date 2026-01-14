/**
 * Google Apps Script to create spreadsheets programmatically
 * 
 * Instructions:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this code
 * 4. Deploy as a web app:
 *    - Click "Deploy" > "New deployment"
 *    - Choose type: "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (or "Anyone with Google account" for more security)
 *    - Click "Deploy"
 * 5. Copy the Web app URL and set it as VITE_APPS_SCRIPT_URL in your .env file
 */

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    
    if (requestData.action === 'createSpreadsheet') {
      const email = requestData.email;
      
      // Create a new spreadsheet
      const spreadsheet = SpreadsheetApp.create(`Appointments - ${email}`);
      
      // Get the first sheet
      const sheet = spreadsheet.getActiveSheet();
      
      // Set headers
      sheet.getRange(1, 1, 1, 8).setValues([[
        'Patient Name',
        'Email',
        'Phone Number',
        'Patient Symptom Report URL',
        '',
        'date',
        'time',
        'status'
      ]]);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
      
      // Return the spreadsheet ID
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        spreadsheetId: spreadsheet.getId(),
        spreadsheetUrl: spreadsheet.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// For testing purposes
function testCreateSpreadsheet() {
  const testData = {
    action: 'createSpreadsheet',
    email: 'test@example.com'
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

