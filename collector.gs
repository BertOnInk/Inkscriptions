// ====================================================================
// CONFIGURATION (MUST BE EDITED)
// ====================================================================
// ⚠️ REPLACE THIS ID with the ID copied from your Google Sheet URL (Step 1.2)
const SPREADSHEET_ID = "1lo_BYKgIVHPmbrcmxkiDNF0w_3iU92t90Uakz5Lmmt0"; 
const SHEET_NAME = "PublicInscriptions"; // Must match the name you created in Step 1.1
// ====================================================================


// --- FUNCTION 1: COLLECTOR ENDPOINT (Receives POST from DApp) ---
// This handles the user selecting "Public" after a successful mint.
function doPost(e) {
  // Ensure the request has content and is JSON type
  if (!e.postData || e.postData.type !== 'application/json') {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid content type or missing data" }))
                       .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    // 1. Parse the JSON body from the DApp
    const data = JSON.parse(e.postData.contents);
    
    // 2. Extract the required values (matching your Sheet headers)
    const hash = data.hash;
    const block = data.block;
    const timestamp = new Date(data.timestamp); // Added comment to force deploy

    // 3. Open the sheet and append the new row
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // Append a new row with the data
    sheet.appendRow([hash, block, timestamp]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Hash logged successfully" }))
                       .setMimeType(ContentService.MimeType.JSON)
                       .setHeader('Access-Control-Allow-Origin', '*'); // Add CORS header for POST response
  } catch(error) {
    Logger.log("Error processing POST request: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                       .setMimeType(ContentService.MimeType.JSON)
                       .setHeader('Access-Control-Allow-Origin', '*');
  }
}


// --- FUNCTION 2: GALLERY API ENDPOINT (Serves GET to DApp) ---
// This handles the DApp loading the list of historical hashes. (Step 4.1)
function doGet(e) {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    
    // Get all data, including headers
    const data = sheet.getDataRange().getValues(); 
    
    // Check if there is actual data beyond the header row
    if (data.length <= 1) {
        // Only headers present or completely empty
        return ContentService.createTextOutput(JSON.stringify([]))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader('Access-Control-Allow-Origin', '*');
    }

    const headers = data[0]; // First row is headers
    const rows = data.slice(1); // Data starts from the second row
    const jsonArray = [];

    // Loop through rows and create JSON objects
    for (let i = 0; i < rows.length; i++) {
        let rowObject = {};
        for (let j = 0; j < headers.length; j++) {
            // Use the header name as the JSON key
            rowObject[headers[j].toLowerCase()] = rows[i][j]; 
        }
        jsonArray.push(rowObject);
    }

    // --- CRITICAL FIX: Correctly setting CORS/Security Headers ---
    return ContentService.createTextOutput(JSON.stringify(jsonArray))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*'); // This is the required CORS header
}