const { readDb, writeDb } = require('./database');
const { randomUUID } = require('crypto');

// In-memory store for each user's context. In a real app, this would be in a database or Redis.
const userContexts = {};

// --- Helper Functions ---

function getContext(user) {
    if (!userContexts[user.id]) {
        userContexts[user.id] = { clientId: null };
    }
    return userContexts[user.id];
}

function parseCommand(commandString) {
    const parts = [];
    let inQuote = false;
    let currentPart = '';
    for (let i = 0; i < commandString.length; i++) {
        const char = commandString[i];
        if (char === '"') {
            inQuote = !inQuote;
            if (!inQuote && currentPart !== '') { parts.push(currentPart); currentPart = ''; }
            continue;
        }
        if (char === ' ' && !inQuote) {
            if (currentPart !== '') { parts.push(currentPart); currentPart = ''; }
            continue;
        }
        currentPart += char;
    }
    if (currentPart !== '') { parts.push(currentPart); }
    return { commandName: parts[0] || '', args: parts.slice(1) };
}


// --- Command Handlers (Now Role-Aware) ---

async function handleHelp() {
  const message = `
Available Commands:
  help                                  - Show this help message.
  create_user <clientId> [name]         - Create a new client.
  list_users                            - List all clients.
  show_user <clientId>                  - Show detailed info for a client.
  open_user <clientId>                  - Set the current client context for subsequent commands.
  set_info [clientId] <field> <value>   - Set info for a client. If clientId is omitted, uses the current client context.
                                          Valid fields: name, email, phone, age, gender, city, status, caseType.
  set_doc <url>                         - Attach a Case History DOCX URL to current client.
  set_summary_doc <url>                 - Attach a Session Summary DOCX URL to current client.
  open_doc                              - Open the Case History docLink for current client.
  add_note <text>                       - Append a note to current client.
  add_session <clientId> <YYYY-MM-DD> <HH:MM> <durationInMinutes> [type] - Add a session.
  list_sessions <clientId>              - List all sessions for a client.
  available_slots <YYYY-MM-DD> <startHH:MM> <endHH:MM> <slotDurationMinutes> - Show free slots.
`;
  return { success: true, message: message.trim() };
}

async function handleCreateUser(args, user) {
    if (args.length < 1 || args.length > 2) {
        return { success: false, message: 'Usage: create_user <clientId> [name]', isError: true };
    }
    const [clientId, name] = args;
    const db = await readDb();
    if (db.clients.find(c => c.id === clientId)) {
        return { success: false, message: `Client with ID '${clientId}' already exists.`, isError: true };
    }
    
    const newClient = {
        id: clientId,
        name: name || null,
        therapistId: user.role === 'admin' ? null : user.id,
        age: null,
        gender: null,
        city: null,
        caseType: null,
        status: 'Open',
        docLink: null,
        sessionSummaryDocLink: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: null,
    };
    db.clients.push(newClient);
    await writeDb(db);
    return { success: true, message: `Client '${name || clientId}' created.` };
}

async function handleListUsers(args, user) {
    const db = await readDb();
    let clientsToList = db.clients;

    if (user.role !== 'admin') {
        clientsToList = db.clients.filter(c => c.therapistId === user.id);
    }
    
    if (clientsToList.length === 0) {
        return { success: true, message: 'No clients found.' };
    }
    const header = 'ID           Name                 Status\n-----------------------------------------';
    const clientList = clientsToList
        .map(c => `${c.id.padEnd(12)} ${ (c.name || '(No Name)').padEnd(20)} ${c.status || 'N/A'}`)
        .join('\n');
    return { success: true, message: `${header}\n${clientList}` };
}

async function handleShowUser(args, user) {
    if (args.length !== 1) return { success: false, message: 'Usage: show_user <clientId>', isError: true };
    const clientId = args[0];
    const db = await readDb();
    const client = db.clients.find(c => c.id === clientId);

    if (!client) return { success: false, message: `Client with ID '${clientId}' not found.`, isError: true };
    if (user.role !== 'admin' && client.therapistId !== user.id) {
        return { success: false, message: 'Access denied. You can only view your own clients.', isError: true };
    }
    
    const clientSessions = db.sessions.filter(s => s.clientId === clientId).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    let clientInfo = `Client ID:    ${client.id}\n`;
    clientInfo +=    `Name:         ${client.name || '(Not set)'}\n`;
    clientInfo +=    `Age:          ${client.age || '(Not set)'}\n`;
    clientInfo +=    `Gender:       ${client.gender || '(Not set)'}\n`;
    clientInfo +=    `City:         ${client.city || '(Not set)'}\n`;
    clientInfo +=    `Status:       ${client.status || '(Not set)'}\n`;
    clientInfo +=    `Case Type:    ${client.caseType || '(Not set)'}\n`;
    clientInfo +=    `Email:        ${client.email || '(Not set)'}\n`;
    clientInfo +=    `Phone:        ${client.phone || '(Not set)'}\n`;
    clientInfo +=    `Case History: ${client.docLink || '(Not set)'}\n`;
    clientInfo +=    `Session Doc:  ${client.sessionSummaryDocLink || '(Not set)'}\n`;
    clientInfo +=    `Notes:        \n${client.notes || '(No notes)'}\n`;
    clientInfo +=    `Created At:   ${new Date(client.createdAt).toLocaleString()}\n`;
    clientInfo +=    `Updated At:   ${new Date(client.updatedAt).toLocaleString()}\n`;

    if (clientSessions.length > 0) {
        clientInfo += '\nSessions:\n';
        clientSessions.forEach(session => {
            clientInfo += `  - ${new Date(session.startTime).toLocaleString()} to ${new Date(session.endTime).toLocaleTimeString()} (${session.type || 'N/A'})\n`;
        });
    } else {
        clientInfo += '\nNo sessions booked.\n';
    }

    return { success: true, message: clientInfo };
}


async function handleOpenUser(args, user) {
    if (args.length !== 1) return { success: false, message: 'Usage: open_user <clientId>', isError: true };
    const clientId = args[0];
    const db = await readDb();
    const client = db.clients.find(c => c.id === clientId);
    
    if (!client) return { success: false, message: `Client with ID '${clientId}' not found.`, isError: true };
    if (user.role !== 'admin' && client.therapistId !== user.id) {
        return { success: false, message: 'Access denied. You can only open your own clients.', isError: true };
    }

    const context = getContext(user);
    context.clientId = clientId;
    return { success: true, message: `Client context set to: '${client.name || client.id}'.` };
}

async function handleSetInfo(args, user) {
    const context = getContext(user);
    let { clientId } = context;
    let field;
    let value;

    if (clientId) {
        // Context is set, expect: set_info <field> <value>
        if (args.length < 2) return { success: false, message: 'Usage (with context): set_info <field> <value>', isError: true };
        field = args[0];
        value = args.slice(1).join(' ');
    } else {
        // Context is not set, expect: set_info <clientId> <field> <value>
        if (args.length < 3) return { success: false, message: 'Usage (no context): set_info <clientId> <field> <value>', isError: true };
        clientId = args[0];
        field = args[1];
        value = args.slice(2).join(' ');
    }
    
    const db = await readDb();
    const clientIndex = db.clients.findIndex(c => c.id === clientId);

    if (clientIndex === -1) return { success: false, message: `Client with ID '${clientId}' not found.`, isError: true };

    // Security Check: Ensure therapist can only edit their own client
    if (user.role !== 'admin' && db.clients[clientIndex].therapistId !== user.id) {
        return { success: false, message: 'Access denied. You can only set info for your own clients.', isError: true };
    }

    const validFields = ['name', 'email', 'phone', 'age', 'gender', 'city', 'status', 'caseType'];
    if (!validFields.includes(field.toLowerCase())) {
        return { success: false, message: `Invalid field: '${field}'. Valid fields are: ${validFields.join(', ')}.`, isError: true };
    }

    db.clients[clientIndex][field.toLowerCase()] = value;
    db.clients[clientIndex].updatedAt = new Date().toISOString();
    await writeDb(db);
    return { success: true, message: `Client '${clientId}' ${field} updated.` };
}

async function handleSetDoc(args, user, docType) {
    const context = getContext(user);
    const { clientId } = context;
    if (!clientId) return { success: false, message: 'No client selected.', isError: true };
    if (args.length !== 1) return { success: false, message: `Usage: set_${docType} <url>`, isError: true };
    
    const db = await readDb();
    const clientIndex = db.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return { success: false, message: 'Error: context client not found.', isError: true };

    db.clients[clientIndex][docType] = args[0];
    db.clients[clientIndex].updatedAt = new Date().toISOString();
    await writeDb(db);
    return { success: true, message: `Doc link for client '${clientId}' set.` };
}

async function handleOpenDoc(args, user) {
    const context = getContext(user);
    const { clientId } = context;
    if (!clientId) return { success: false, message: 'No client selected.', isError: true };
    
    const db = await readDb();
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return { success: false, message: 'Error: context client not found.', isError: true };

    if (client.docLink) {
        return { success: true, message: `Opening doc: ${client.docLink}`, link: client.docLink };
    } else {
        return { success: false, message: 'No docLink set for this client.', isError: true };
    }
}

async function handleAddNote(args, user) {
    const context = getContext(user);
    const { clientId } = context;
    if (!clientId) return { success: false, message: 'No client selected. Use "open_user <clientId>" first.', isError: true };
    if (args.length === 0) return { success: false, message: 'Usage: add_note <text>', isError: true };

    const noteText = args.join(' ');
    const db = await readDb();
    const clientIndex = db.clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return { success: false, message: 'Error: context client not found.', isError: true };

    const timestamp = new Date().toLocaleString();
    const newNote = `[${timestamp}] ${noteText}`;

    if (db.clients[clientIndex].notes) {
        db.clients[clientIndex].notes += `\n${newNote}`;
    } else {
        db.clients[clientIndex].notes = newNote;
    }
    db.clients[clientIndex].updatedAt = new Date().toISOString();

    await writeDb(db);
    return { success: true, message: `Note added to client '${clientId}'.` };
}

async function handleAddSession(args, user) {
    if (args.length < 4) {
        return { success: false, message: 'Usage: add_session <clientId> <YYYY-MM-DD> <HH:MM> <durationInMinutes> [type]', isError: true };
    }
    const [clientId, date, time, duration, type] = args;
    
    const db = await readDb();
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return { success: false, message: `Client with ID '${clientId}' not found.`, isError: true };

    if (user.role !== 'admin' && client.therapistId !== user.id) {
        return { success: false, message: 'Access denied. You can only add sessions for your own clients.', isError: true };
    }

    const startTime = new Date(`${date}T${time}`);
    if (isNaN(startTime)) return { success: false, message: 'Invalid date or time format.', isError: true };
    
    const durationMinutes = parseInt(duration, 10);
    if (isNaN(durationMinutes)) return { success: false, message: 'Duration must be a number.', isError: true };

    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // Check for overlaps with sessions of the same client
    const clientSessions = db.sessions.filter(s => s.clientId === clientId);
    const overlap = clientSessions.some(s => {
        const existingStart = new Date(s.startTime);
        const existingEnd = new Date(s.endTime);
        return (startTime < existingEnd && endTime > existingStart);
    });

    if (overlap) {
        return { success: false, message: `Warning: This session overlaps with an existing session for client '${clientId}'.`, isError: true };
    }

    const newSession = {
        id: randomUUID(),
        clientId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: type || 'Individual',
        location: null,
        comment: null,
    };

    db.sessions.push(newSession);
    await writeDb(db);
    return { success: true, message: `Session for '${client.name || clientId}' on ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()} added.` };
}

async function handleListSessions(args, user) {
    if (args.length !== 1) return { success: false, message: 'Usage: list_sessions <clientId>', isError: true };
    const clientId = args[0];

    const db = await readDb();
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return { success: false, message: `Client with ID '${clientId}' not found.`, isError: true };

    if (user.role !== 'admin' && client.therapistId !== user.id) {
        return { success: false, message: 'Access denied. You can only list sessions for your own clients.', isError: true };
    }

    const sessions = db.sessions.filter(s => s.clientId === clientId).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (sessions.length === 0) {
        return { success: true, message: `No sessions found for client '${clientId}'.` };
    }

    const sessionList = sessions.map(s => {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        const duration = (end - start) / 60000;
        return `- ${start.toLocaleString()} (${duration} mins) - ${s.type || 'N/A'}`;
    }).join('\n');

    return { success: true, message: `Sessions for ${client.name || clientId}:\n${sessionList}` };
}

async function handleAvailableSlots(args, user) {
    if (args.length !== 4) {
        return { success: false, message: 'Usage: available_slots <YYYY-MM-DD> <startHH:MM> <endHH:MM> <slotDurationMinutes>', isError: true };
    }
    const [date, startTime, endTime, slotDuration] = args;

    const db = await readDb();
    const startOfDay = new Date(`${date}T${startTime}`);
    const endOfDay = new Date(`${date}T${endTime}`);
    const slotMinutes = parseInt(slotDuration, 10);
    
    if (isNaN(startOfDay) || isNaN(endOfDay) || isNaN(slotMinutes)) {
        return { success: false, message: 'Invalid date, time, or duration format.', isError: true };
    }

    // Get all sessions for the given day, regardless of therapist
    const daySessions = db.sessions.filter(s => {
        const sessionDate = new Date(s.startTime);
        return sessionDate.toISOString().startsWith(date);
    });

    const availableSlots = [];
    let currentSlotStart = new Date(startOfDay);

    while (currentSlotStart.getTime() + slotMinutes * 60000 <= endOfDay.getTime()) {
        const currentSlotEnd = new Date(currentSlotStart.getTime() + slotMinutes * 60000);

        const isOverlapping = daySessions.some(session => {
            const sessionStart = new Date(session.startTime);
            const sessionEnd = new Date(session.endTime);
            // Check if the proposed slot overlaps with an existing session
            return currentSlotStart < sessionEnd && currentSlotEnd > sessionStart;
        });

        if (!isOverlapping) {
            availableSlots.push(currentSlotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        currentSlotStart = currentSlotEnd;
    }

    if (availableSlots.length === 0) {
        return { success: true, message: 'No available slots found in the given range.' };
    }

    return { success: true, message: `Available slots for ${date}:\n- ${availableSlots.join('\n- ')}` };
}

// --- Main processCommand function ---
async function processCommand(commandString, user) {
  const { commandName, args } = parseCommand(commandString);
  try {
    switch (commandName.toLowerCase()) {
      case 'help': return await handleHelp();
      case 'create_user': return await handleCreateUser(args, user);
      case 'list_users': return await handleListUsers(args, user);
      case 'show_user': return await handleShowUser(args, user);
      case 'open_user': return await handleOpenUser(args, user);
      case 'set_info': return await handleSetInfo(args, user);
      case 'set_doc': return await handleSetDoc(args, user, 'docLink');
      case 'set_summary_doc': return await handleSetDoc(args, user, 'sessionSummaryDocLink');
      case 'open_doc': return await handleOpenDoc(args, user);
      case 'add_note': return await handleAddNote(args, user);
      case 'add_session': return await handleAddSession(args, user);
      case 'list_sessions': return await handleListSessions(args, user);
      case 'available_slots': return await handleAvailableSlots(args, user);
      default:
        return { success: false, message: `Unknown command: "${commandName}".`, isError: true };
    }
  } catch (error) {
    console.error(`Error processing command "${commandName}":`, error);
    return { success: false, message: 'An unexpected error occurred.', isError: true };
  }
}

module.exports = { processCommand };