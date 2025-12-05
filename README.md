# Marga Mindwellness Console

This is a web-based application designed for staff of a mental health organization to manage client profiles and therapy sessions. It provides a dual-interface system: a command-line style console for quick actions and a graphical user interface (GUI) for a more visual workflow.

## Project Goal
To provide a simple, reliable, and functional web application for managing client data and therapy sessions, including scheduling, note-taking, and data import/export.

## Tech Stack
-   **Backend:** Node.js with Express.js
-   **Frontend:** Vanilla HTML, CSS, and JavaScript
-   **Database:** Local JSON file (`data/db.json`)
-   **Excel Integration:** `xlsx` library for data import and export.

## Features

-   **Dual Interface:** Choose between a CLI-style console and a user-friendly GUI.
-   **Authentication:** A secure login system with role-based access control (Admin vs. Therapist).
-   **Client Management:** Create, view, search, and edit client profiles.
-   **Session Scheduling:** Add and list therapy sessions with automatic overlap detection.
-   **Data Import/Export:** Easily import from and export to Excel files.
-   **Client Context:** Set a client context in the CLI to perform multiple actions without re-typing the client ID.
-   **Document Linking:** Attach URLs for case histories and session summaries.

## Supported Commands (CLI Interface)

1.  `help`
    *   Show all available commands and examples.

2.  `create_user <clientId> [name]`
    *   Creates a new client.

3.  `open_user <clientId>`
    *   Set the "current client" context for subsequent commands.

4.  `set_info [clientId] <field> <value>`
    *   Updates information for a client. If `clientId` is omitted, it uses the current context.
    *   Valid fields: `name`, `email`, `phone`, `age`, `gender`, `city`, `status`, `caseType`.

5.  `set_doc <url>` / `set_summary_doc <url>`
    *   Attach document URLs to the current client.

6.  `open_doc`
    *   Provides a clickable link to the client's case history document.

7.  `add_note <text>`
    *   Append a note to the current client.

8.  `list_users`
    *   Show a list of all clients assigned to you.

9.  `show_user <clientId>`
    *   Show detailed information for a specific client.

10. `add_session <clientId> <YYYY-MM-DD> <HH:MM> <durationInMinutes> [type]`
    *   Add a therapy session, with overlap detection.

11. `list_sessions <clientId>`
    *   List all sessions for a client.

12. `available_slots <YYYY-MM-DD> <startHH:MM> <endHH:MM> <slotDurationMinutes>`
    *   Find available time slots within a given range.

## Running the Application

1.  **Install Dependencies:**
    Open your terminal in the project root and run:
    ```bash
    npm install
    ```
    This will install `express` and `xlsx`.

2.  **Start the Server:**
    In the same terminal, run:
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`.

3.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:3000`. You will be directed to the login page.

## Login Credentials

-   **Admin User:**
    -   Username: `admin`
    -   Password: `adminpassword`
-   **Therapist User (Jane Doe):**
    -   Username: `jdoe`
    -   Password: `password123`

## File Structure Overview

```
.
├── data/
│   └── db.json                 # Stores all application data
├── public/
│   ├── console.html            # The CLI interface page
│   ├── gui.html                # The GUI interface page
│   ├── login.html              # The login page
│   ├── *.css                   # Stylesheets for all pages
│   └── *.js                    # Client-side logic for login, console, and GUI pages
├── commandProcessor.js         # Core logic for parsing and handling CLI commands
├── database.js                 # Abstraction for reading/writing to the database file
├── importProcessor.js          # Logic for processing Excel data imports
├── server.js                   # Main Express server application
├── package.json                # Project dependencies and scripts
└── README.md                   # This file
```
