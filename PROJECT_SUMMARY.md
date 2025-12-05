# Project Summary: Marga Mindwellness Console

This document provides a summary of the development of the Marga Mindwellness Console application, detailing its current state, features, and technical architecture.

## 1. Project Goal

The primary goal is to create a web-based "command console" (now evolving into a dual CLI/GUI interface) for staff of a mental health organization. This tool allows them to:
- Manage client profiles (create, view, edit).
- Assign and list therapy sessions, with overlap detection.
- Add internal "insight" notes about clients.
- Attach and open document links (URLs to cloud-based docs).
- Import client and session data from Excel files.
- Export all data to an Excel file.
- Operate with role-based access control (therapists see only their data, admin sees all data).

## 2. Evolution of the Tech Stack

### Initial Stack (Abandoned)
-   **Frontend/Backend:** Next.js (App Router, TypeScript)
-   **Styling:** React + Tailwind CSS
-   **Database:** Prisma + SQLite

**Reason for Pivot:** The initial Next.js + Prisma stack proved problematic due to environment-specific build issues, module resolution errors, and complex configuration for a relatively simple application.

### Current Stack (Implemented)
-   **Backend:** Node.js with Express.js
-   **Frontend:** Vanilla HTML, CSS, and JavaScript
-   **Database:** Local JSON file (`data/db.json`) for simplicity and ease of setup.
-   **Excel Integration:** `xlsx` library for client-side parsing and server-side generation of Excel files.

## 3. Current Features Implemented

The application currently features:

-   **Authentication System:**
    -   A dedicated login page (`public/login.html`) as the application's entry point.
    -   Hardcoded user credentials (username/password) with assigned roles (`therapist` or `admin`).
    -   User data (ID, username, name, role) stored in browser `localStorage` upon successful login.
    -   Logout functionality that clears the user session.
-   **Role-Based Access Control (RBAC):**
    -   **Therapists:** Can only view, create, edit, and manage clients and sessions explicitly assigned to their `therapistId`.
    -   **Admins:** Have full access to all client and session data across all therapists.
-   **CLI Interface (Console):**
    -   Accessible at `/console.html`.
    -   A chat-like interface for typing commands and receiving responses.
    -   **Commands Implemented:**
        -   `help`: Shows available commands.
        -   `create_user <clientId> [name]`: Creates a new client, assigned to the logged-in therapist (or no therapist if admin).
        -   `list_users`: Lists clients assigned to the user.
        -   `show_user <clientId>`: Displays detailed info for a client.
        -   `open_user <clientId>`: Sets client context for subsequent commands.
        -   `set_info [clientId] <field> <value>`: Updates client information. If clientId is omitted, uses the current client context.
        -   `set_doc <url>`: Attaches a case history document URL.
        -   `set_summary_doc <url>`: Attaches a session summary document URL.
        -   `open_doc`: Opens the client's case history document link.
        -   `add_note <text>`: Appends a note to the client.
        -   `add_session <clientId> <YYYY-MM-DD> <HH:MM> <durationInMinutes> [type]`: Adds a session, including overlap detection.
        -   `list_sessions <clientId>`: Lists client-specific sessions.
        -   `available_slots <YYYY-MM-DD> <startHH:MM> <endHH:MM> <slotDurationMinutes>`: Shows free slots across all clients.
-   **GUI Interface (Clients Dashboard & Schedule):**
    -   Accessible at `/gui.html`.
    -   **Clients View:** Displays a list of clients, with basic details (Case ID, Name, Status, Counselor). Designed to be minimalist and clean.
        -   **Search:** A search bar to filter clients by name or ID.
        -   **Add New Client:** A modal to add a new client.
        -   **Client Details:** A modal to view client details.
        -   **Edit Client:** Functionality to edit client information directly from the details modal.
    -   **Schedule View:** Displays a daily view of sessions, showing client names and session times.
        -   **Add New Session:** A modal to add a new session.
    -   **Navigation:** Allows switching between "Clients" and "Schedule" views.
    -   **Switch to CLI:** A link to switch back to the CLI interface.
    -   **Logout:** A button to log out of the application.
-   **Excel Data Import/Export:**
    - A web-based file upload mechanism (`public/console.js` + `/api/import`) for importing data.
    -   Parses `.xlsx` files client-side using SheetJS.
    -   Reads data from the first sheet (for clients) and second sheet (for sessions), dynamically adapting to sheet names.
    -   Transforms Excel column headers (e.g., "Client ID") to camelCase (e.g., "clientId") for database compatibility.
    -   Adds new clients/sessions to `db.json`, skipping duplicates.
    -   Assigns imported clients to the importing therapist (if not admin).
    - An `/api/export` endpoint to download the entire database as an Excel file.

## 4. Current Data Model

The data is stored in `data/db.json` and follows this structure:

### `therapists` Array
-   `id` (string, unique ID for the therapist)
-   `username` (string)
-   `password` (string, plaintext for demo purposes)
-   `role` (string: "admin" or "therapist")
-   `name` (string)

### `clients` Array
-   `id` (string, e.g., "C-1001", unique key)
-   `name` (string)
-   `therapistId` (string, FK to `therapists.id`, `null` if unassigned or imported by admin without `therapistId` field)
-   `age` (number/string, optional)
-   `gender` (string, optional)
-   `city` (string, optional)
-   `caseType` (string, optional)
-   `status` (string, e.g., "Open", "Closed")
-   `email` (string, optional)
-   `phone` (string, optional)
-   `createdAt` (ISO DateTime string)
-   `updatedAt` (ISO DateTime string)
-   `notes` (text, optional general notes)
-   `docLink` (string, optional URL for case history)
-   `sessionSummaryDocLink` (string, optional URL for session summary)

### `sessions` Array
-   `id` (string, auto-generated UUID)
-   `clientId` (string, FK to `clients.id`)
-   `startTime` (ISO DateTime string)
-   `endTime` (ISO DateTime string)
-   `type` (string, e.g., "individual", "group")
-   `location` (string, optional)
-   `comment` (string, optional)

## 5. Running the Application

1.  **Install Dependencies:**
    Open your terminal in the project root and run:
    ```bash
    npm install
    ```
    This will install `express`, `xlsx`, and `nodemon`.

2.  **Start the Server:**
    In the same terminal, run:
    ```bash
    npm start
    ```
    Alternatively, for development with automatic server restarts:
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:3000`.

3.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:3000`.

## 6. Login Credentials

Use these credentials to log in:

-   **Admin User:**
    -   Username: `admin`
    -   Password: `adminpassword`
-   **Therapist User (Jane Doe):**
    -   Username: `jdoe`
    -   Password: `password123`

## 7. Current File Structure Overview

```
.
├── data/
│   └── db.json                 # Stores all application data (clients, sessions, therapists)
├── public/
│   ├── console.html            # The CLI interface page
│   ├── gui.html                # The GUI interface page (Clients list, Schedule)
│   ├── login.html              # The login page
│   ├── logo.jpg                # Application logo
│   ├── login.css               # Styles for the login page
│   ├── style.css               # Styles for the CLI page
│   ├── gui.css                 # Styles for the GUI page
│   ├── login.js                # Script for login logic
│   ├── console.js              # Script for CLI logic
│   └── gui.js                  # Script for GUI logic
├── commandProcessor.js         # Core logic for processing CLI commands
├── database.js                 # Abstraction for reading/writing to db.json
├── importProcessor.js          # Logic for processing Excel data imports
├── server.js                   # Main Express server application, defines API routes
├── package.json                # Project dependencies and scripts
└── README.md                   # Basic project README (provides runtime instructions)
└── PROJECT_SUMMARY.md          # This detailed summary file
```

## 8. Development Updates

- **GUI Enhancements:**
    - Implemented modals for adding new clients and sessions, improving user workflow.
    - Added a search bar to the clients view for easy filtering by name or ID.
    - Enabled direct editing of client information from the client details modal.
- **Command Flexibility & API:**
    - The `set_info` command in the CLI now supports both contextual (via `open_user`) and direct client ID specification.
    - Created an `/api/export` endpoint to handle database exports, removing the `export_db` command from the CLI.
- **UI & Styling:**
    - Updated the application's font to 'Inter' for a more modern look and feel.
    - Refined the styling of the login, console, and GUI pages for better consistency and visual appeal.
    - Added a border to the main application body for better visual separation.
    - Replaced the sidebar's `h2` title with a styled `div` for the logo.
- **Project Maintenance:**
    - Removed unnecessary files and directories (`.next`, `next-env.d.ts`, etc.) to clean up the project structure.
    - Renamed `public/script.js` to `public/console.js` to better reflect its purpose.
    - Added `nodemon` as a dev dependency and a `dev` script to `package.json` for improved development workflow.
- **Security:**
    - Investigated a high-severity vulnerability in the `xlsx` package. Due to the lack of a direct patch and the context of this being a demo application, the risk has been accepted for now.