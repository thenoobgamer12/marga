const { readDb, writeDb } = require('./database');
const { randomUUID } = require('crypto');

/**
 * Transforms an object's keys from "Title Case" or "snake_case" to "camelCase".
 * Example: "Client ID" -> "clientId"
 * @param {object} obj - The object to transform.
 * @returns {object} A new object with camelCase keys.
 */
function transformKeys(obj) {
    const newObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = key.trim()
                .replace(/_(\w)/g, (_, c) => c.toUpperCase())
                .replace(/\s+(\w)/g, (_, c) => c.toUpperCase())
                .replace(/^\w/, c => c.toLowerCase());
            newObj[newKey] = obj[key];
        }
    }
    return newObj;
}


/**
 * Processes and imports client and session data from a JSON object into the database.
 * Skips duplicates based on ID.
 * @param {object} importData - The data to import, containing `clients` and `sessions` arrays.
 * @returns {object} - An object with success status and a summary message.
 */
async function processImport(importData, user) {
    if (!importData || !Array.isArray(importData.clients)) {
        return { success: false, message: 'Invalid import data format. Expected an object with a "clients" array.' };
    }

    const transformedClients = importData.clients.map(transformKeys);
    const transformedSessions = importData.sessions ? importData.sessions.map(transformKeys) : [];

    const db = await readDb();
    const existingClientIds = new Set(db.clients.map(c => c.id));
    const existingSessionIds = new Set(db.sessions.map(s => s.id));

    let clientsAdded = 0;
    let sessionsAdded = 0;
    let clientsSkipped = 0;
    let sessionsSkipped = 0;

    // Import new clients
    for (const client of transformedClients) {
        if (!client.id || existingClientIds.has(client.id)) {
            clientsSkipped++;
            continue;
        }

        const newClient = {
            id: client.id,
            name: client.name || null,
            email: client.email || null,
            phone: client.phone || null,
            createdAt: client.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: client.notes || null,
            docLink: client.docLink || null,
            // Assign therapistId based on user role
            therapistId: user.role === 'admin' ? (client.therapistId || null) : user.id,
        };
        db.clients.push(newClient);
        clientsAdded++;
    }

    // Import new sessions
    if (transformedSessions) {
        for (const session of transformedSessions) {
            // A session must have an ID or we can generate one. Let's assume we generate if missing.
            if (!session.id) {
                session.id = randomUUID();
            }

            if (existingSessionIds.has(session.id)) {
                sessionsSkipped++;
                continue;
            }
            
            // Check if the client for the session exists
            if (!existingClientIds.has(session.clientId)) {
                console.warn(`Skipping session for non-existent client: ${session.clientId}`);
                sessionsSkipped++;
                continue;
            }

            const newSession = {
                id: session.id,
                clientId: session.clientId,
                startTime: session.startTime || new Date().toISOString(),
                endTime: session.endTime || new Date().toISOString(),
                type: session.type || 'Individual',
                location: session.location || null,
                comment: session.comment || null,
            };
            db.sessions.push(newSession);
            sessionsAdded++;
        }
    }

    await writeDb(db);
    return {
        success: true,
        message: `Import complete. Clients: ${clientsAdded} added, ${clientsSkipped} skipped. Sessions: ${sessionsAdded} added, ${sessionsSkipped} skipped.`
    };
}

module.exports = { processImport };
