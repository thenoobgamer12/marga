const { readDb, writeDb } = require('./database');
const xlsx = require('xlsx');

/**
 * Converts an Excel serial number date to a JavaScript Date object.
 * @param {number} excelDate - The Excel serial number for the date.
 * @returns {Date} The corresponding JavaScript Date object.
 */
function convertExcelDate(excelDate) {
    if (typeof excelDate === 'string') {
        return new Date(excelDate);
    }
    // Excel's epoch starts on 1900-01-01, but incorrectly thinks 1900 was a leap year.
    // JavaScript's epoch is 1970-01-01.
    // The subtraction of 2 accounts for the leap year bug and the fact that Excel's day 1 is 1-indexed.
    return new Date(Date.UTC(0, 0, excelDate - 1));
}


/**
 * Processes an imported Excel file, maps the data to the database schema, and adds new clients.
 *
 * @param {Buffer} fileBuffer - The buffer containing the Excel file data.
 * @param {object} user - The user performing the import. Should have `id` and `role` properties.
 * @returns {object} An object containing the status and a summary message.
 */
async function processImport(fileBuffer, user) {
    if (!fileBuffer) {
        return { success: false, message: 'No file buffer provided.' };
    }

    // --- 1. Define Mappings ---

    // Explicitly maps Excel headers to database keys.
    const headerMapping = {
        'Case ID': 'id',
        'Client Name': 'name',
        'Age': 'age',
        'Gender': 'gender',
        'Contact No.': 'phone',
        'Address City': 'city',
        'Case Type': 'caseType',
        'Date Opened': 'createdAt',
        'Status': 'status',
        'Case History Document': 'docLink',
        'Session Summary Document': 'sessionSummaryDocLink'
    };

    const db = await readDb();

    // Dynamically create a map from therapist names in the DB to their IDs.
    const therapistNameToIdMap = db.therapists.reduce((acc, therapist) => {
        acc[therapist.name] = therapist.id;
        return acc;
    }, {});


    // --- 2. Process Excel Data ---

    let rows;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Using cellDates: true helps, but we'll add robust parsing.
        rows = xlsx.utils.sheet_to_json(sheet, { raw: false, cellDates: true });
    } catch (error) {
        console.error('Error parsing Excel file:', error);
        return { success: false, message: 'Failed to parse the Excel file. It may be corrupt or in an unsupported format.' };
    }

    if (!rows || rows.length === 0) {
        return { success: false, message: 'The Excel file is empty or could not be read.' };
    }


    // --- 3. Map, Validate, and Prepare Data for Import ---

    const existingClientIds = new Set(db.clients.map(c => c.id));
    const newClients = [];
    let clientsAdded = 0;
    let clientsSkipped = 0;

    for (const row of rows) {
        // Map excel row to a client object based on headerMapping
        const mappedClient = {};
        for (const excelHeader in headerMapping) {
            if (row[excelHeader] !== undefined) {
                const dbKey = headerMapping[excelHeader];
                mappedClient[dbKey] = row[excelHeader];
            }
        }

        // --- 4. Handle Special Logic (Therapists, Dates, Duplicates) ---

        // Ensure there's an ID to check against
        if (!mappedClient.id) {
            console.warn('Skipping row due to missing "Case ID":', row);
            clientsSkipped++;
            continue;
        }

        // Skip duplicates
        if (existingClientIds.has(mappedClient.id)) {
            clientsSkipped++;
            continue;
        }

        // Handle therapist assignment
        if (user.role === 'admin') {
            const counselorName = row['Counselor'];
            mappedClient.therapistId = therapistNameToIdMap[counselorName] || null;
        } else {
            // For non-admins, assign the client to the user who is importing.
            mappedClient.therapistId = user.id;
        }
        
        // Handle date conversion
        if (mappedClient.createdAt) {
            // xlsx with cellDates might return a Date object or a string.
            const dateValue = mappedClient.createdAt;
            if (dateValue instanceof Date && !isNaN(dateValue)) {
                mappedClient.createdAt = dateValue.toISOString();
            } else {
                try {
                    // Fallback for string dates
                    mappedClient.createdAt = new Date(dateValue).toISOString();
                } catch(e) {
                    // If parsing fails, use current date
                    mappedClient.createdAt = new Date().toISOString();
                }
            }
        } else {
            mappedClient.createdAt = new Date().toISOString();
        }

        // Add timestamps
        mappedClient.updatedAt = new Date().toISOString();

        newClients.push(mappedClient);
        clientsAdded++;
    }

    // --- 5. Update Database ---

    if (newClients.length > 0) {
        db.clients.push(...newClients);
        await writeDb(db);
    }

    return {
        success: true,
        message: `Import complete. Clients: ${clientsAdded} added, ${clientsSkipped} skipped as duplicates or invalid.`
    };
}

module.exports = { processImport };