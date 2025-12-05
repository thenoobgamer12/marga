const express = require('express');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const { processCommand } = require('./commandProcessor');
const { processImport } = require('./importProcessor');
const { readDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware & Setup ---
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Setup multer for file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- HTML Page Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// --- API Endpoints ---

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required.' });
        }

        const db = await readDb();
        const user = db.therapists.find(t => t.username === username && t.password === password);

        if (user) {
            // Create a user object to send to the client, omitting the password.
            const userToSend = {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
            };
            res.json({ success: true, user: userToSend });
        } else {
            res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});

// Command Processor
app.post('/api/command', async (req, res) => {
  try {
    const { command, user } = req.body;
    if (!command || !user || !user.id) {
        return res.status(400).json({ success: false, message: 'Command and user auth are required.' });
    }
    const result = await processCommand(command, user);
    res.json(result);
  } catch (error) {
    console.error('Server Error in /api/command:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Data Import - now handles file uploads
app.post('/api/import', upload.single('importFile'), async (req, res) => {
    try {
        // User data is now sent as a string in a multipart form
        const user = JSON.parse(req.body.user);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // Pass the file buffer to the import processor
        const result = await processImport(req.file.buffer, user);
        res.json(result);
    } catch (error) {
        console.error('Server Error in /api/import:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred while importing.' });
    }
});

// GUI - Get all clients
app.get('/api/clients', async (req, res) => {
    try {
        const userId = req.headers.authorization?.split(' ')[1];
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const db = await readDb();
        const user = db.therapists.find(t => t.id === userId);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        if (user.role === 'admin') {
            res.json(db.clients);
        } else {
            const userClients = db.clients.filter(c => c.therapistId === user.id);
            res.json(userClients);
        }
    } catch (error) {
        console.error('Error in /api/clients:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

// GUI - Get a single client
app.get('/api/clients/:id', async (req, res) => {
    try {
        const userId = req.headers.authorization?.split(' ')[1];
        const { id: clientId } = req.params;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const db = await readDb();
        const user = db.therapists.find(t => t.id === userId);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const client = db.clients.find(c => c.id === clientId);
        if (!client) return res.status(404).json({ message: 'Client not found' });

        if (user.role !== 'admin' && client.therapistId !== user.id) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        res.json(client);
    } catch (error) {
        console.error(`Error in /api/clients/${req.params.id}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

// GUI - Get sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const userId = req.headers.authorization?.split(' ')[1];
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const db = await readDb();
        const user = db.therapists.find(t => t.id === userId);
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        let userSessions;
        if (user.role === 'admin') {
            userSessions = db.sessions;
        } else {
            const userClientIds = new Set(db.clients.filter(c => c.therapistId === user.id).map(c => c.id));
            userSessions = db.sessions.filter(s => userClientIds.has(s.clientId));
        }

        const enrichedSessions = userSessions.map(session => {
            const client = db.clients.find(c => c.id === session.clientId);
            return { ...session, clientName: client ? client.name : 'Unknown Client' };
        });
        res.json(enrichedSessions);
    } catch (error) {
        console.error('Error in /api/sessions:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

app.get('/api/export', async (req, res) => {
    try {
        const db = await readDb();
        const clientsSheet = xlsx.utils.json_to_sheet(db.clients);
        const sessionsSheet = xlsx.utils.json_to_sheet(db.sessions);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, clientsSheet, 'Clients');
        xlsx.utils.book_append_sheet(workbook, sessionsSheet, 'Sessions');
        
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="marga_export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Error in /api/export:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});