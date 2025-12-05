document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Check ---
    const user = JSON.parse(localStorage.getItem('marga-user'));
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // --- Element References ---
    const messageLog = document.getElementById('message-log');
    const commandForm = document.getElementById('command-form');
    const commandInput = document.getElementById('command-input');
    const sendButton = document.getElementById('send-button');
    const importButton = document.getElementById('import-button');
    const fileUploader = document.getElementById('file-uploader');
    const logoutButton = document.getElementById('logout-button');

    // --- Helper Functions ---
    function addMessage(text, type, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);
        if (isError) {
            messageElement.classList.add('error');
        }
        messageElement.innerHTML = text.replace(/\n/g, '<br>');
        messageLog.appendChild(messageElement);
        messageLog.scrollTop = messageLog.scrollHeight;
    }

    function setFormDisabled(disabled) {
        commandInput.disabled = disabled;
        sendButton.disabled = disabled;
        importButton.disabled = disabled;
    }

    // --- Event Handlers ---

    // Handle command form submission
    commandForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const command = commandInput.value.trim();
        if (!command) return;

        addMessage(command, 'command');
        commandInput.value = '';
        setFormDisabled(true);

        try {
            const res = await fetch('/api/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, user }), // Send user with command
            });

            if (!res.ok) {
                throw new Error(`Server responded with status: ${res.status}`);
            }

            const result = await res.json();
            let responseText = result.message;
            if (result.link && result.success) {
                responseText = `${result.message} <a href="${result.link}" target="_blank" rel="noopener noreferrer">Open Link</a>`;
            }
            addMessage(responseText, 'response', result.isError);

        } catch (error) {
            addMessage(`Client Error: ${error.message}`, 'response', true);
        } finally {
            setFormDisabled(false);
            commandInput.focus();
        }
    });

    // Handle import button click
    importButton.addEventListener('click', () => {
        fileUploader.click();
    });

    // Handle file selection for import
    fileUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        addMessage(`Reading file: ${file.name}...`, 'response');
        setFormDisabled(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Read clients from the first sheet
                const clientSheetName = workbook.SheetNames[0];
                const clientSheet = workbook.Sheets[clientSheetName];
                const clients = XLSX.utils.sheet_to_json(clientSheet);

                // Read sessions from the second sheet (if it exists)
                let sessions = [];
                if (workbook.SheetNames.length > 1) {
                    const sessionSheetName = workbook.SheetNames[1];
                    const sessionSheet = workbook.Sheets[sessionSheetName];
                    sessions = XLSX.utils.sheet_to_json(sessionSheet);
                }
                
                const res = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user, clients, sessions }),
                });

                if (!res.ok) throw new Error(`Server responded with status: ${res.status}`);

                const result = await res.json();
                addMessage(result.message, 'response', !result.success);

            } catch (error) {
                addMessage(`Import Error: ${error.message}`, 'response', true);
            } finally {
                setFormDisabled(false);
                fileUploader.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // Handle logout
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('marga-user');
        window.location.href = '/login.html';
    });


    // --- Initial Setup ---
    const welcomeUser = user.name || user.username;
    addMessage(`Welcome, ${welcomeUser}! Type "help" to see available commands or import an Excel file.`, 'response');
    commandInput.focus();
});