const fs = require('fs/promises');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'db.json');

async function readDb() {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Database file doesn't exist, create it with initial schema
      const initialDb = { 
        therapists: [
          { "id": "user-001", "username": "admin", "password": "adminpassword", "role": "admin", "name": "Admin User" },
          { "id": "user-002", "username": "jdoe", "password": "password123", "role": "therapist", "name": "Jane Doe" }
        ],
        clients: [], 
        sessions: [] 
      };
      await writeDb(initialDb);
      return initialDb;
    }
    console.error('Error reading database:', error);
    throw error;
  }
}

async function writeDb(data) {
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database:', error);
    throw error;
  }
}

module.exports = { readDb, writeDb };
