document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Check ---
    const user = JSON.parse(localStorage.getItem('marga-user'));
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // --- Element References ---
    const mainContent = document.getElementById('main-content');
    const navClients = document.getElementById('nav-clients');
    const navSchedule = document.getElementById('nav-schedule');

    // --- View Rendering Functions ---

    const renderClientsView = async (searchTerm = '') => {
        setActiveNav('clients');
        mainContent.innerHTML = '<h1>Loading clients...</h1>';
        try {
            const res = await fetch('/api/clients', {
                headers: { 'Authorization': `Bearer ${user.id}` }
            });
            if (!res.ok) throw new Error('Failed to fetch clients');
            let clients = await res.json();

            if (searchTerm) {
                clients = clients.filter(client => 
                    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    client.id.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }

            let content = `
                <div class="clients-list-header">
                    <h1>Clients</h1>
                    <div class="search-container">
                        <input type="text" id="client-search" placeholder="Search by name or ID..." value="${searchTerm}">
                    </div>
                    <button class="add-new-client-btn">Add New Client</button>
                </div>
                <table class="client-list-table">
                    <thead>
                        <tr>
                            <th>Case ID</th>
                            <th>Client Name</th>
                            <th>Status</th>
                            <th>Counselor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clients.map(client => `
                            <tr data-client-id="${client.id}">
                                <td>${client.id}</td>
                                <td>${client.name}</td>
                                <td>${client.status}</td>
                                <td>${client.therapistId || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            mainContent.innerHTML = content;

            const searchInput = document.getElementById('client-search');
            searchInput.addEventListener('input', (e) => {
                renderClientsView(e.target.value);
            });

        } catch (error) {
            mainContent.innerHTML = `<h1>Error: ${error.message}</h1>`;
        }
    };

    const renderScheduleView = async () => {
        setActiveNav('schedule');
        mainContent.innerHTML = '<h1>Loading schedule...</h1>';
        try {
            const res = await fetch('/api/sessions', {
                headers: { 'Authorization': `Bearer ${user.id}` }
            });
            if (!res.ok) throw new Error('Failed to fetch schedule');
            const sessions = await res.json();

            const sessionsByDay = sessions.reduce((acc, session) => {
                const day = new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                if (!acc[day]) {
                    acc[day] = [];
                }
                acc[day].push(session);
                return acc;
            }, {});

            let content = `
                <div class="clients-list-header">
                    <h1>Schedule</h1>
                    <button>Add New Session</button>
                </div>
            `;
            for (const day in sessionsByDay) {
                content += `<h2 class="schedule-day-header">${day}</h2>`;
                content += '<div class="schedule-day">';
                sessionsByDay[day].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
                sessionsByDay[day].forEach(session => {
                    const startTime = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    content += `
                        <div class="session-block">
                            <div class="session-time">${startTime} - ${endTime}</div>
                            <div class="session-client">${session.clientName}</div>
                            <div class="session-type">${session.type}</div>
                        </div>
                    `;
                });
                content += '</div>';
            }

            mainContent.innerHTML = content;

        } catch (error) {
            mainContent.innerHTML = `<h1>Error: ${error.message}</h1>`;
        }
    };

    const setupClientDetailsModal = () => {
        const modal = document.getElementById('client-details-modal');
        const closeModal = modal.querySelector('.close-button');
        const clientDetailsContent = document.getElementById('client-details-content');

        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });

        // Event delegation for opening modal
        mainContent.addEventListener('click', async (event) => {
            const row = event.target.closest('tr[data-client-id]');
            if (row) {
                const clientId = row.dataset.clientId;
                try {
                    const res = await fetch(`/api/clients/${clientId}`, {
                        headers: { 'Authorization': `Bearer ${user.id}` }
                    });
                    if (!res.ok) throw new Error('Failed to fetch client details');
                    const client = await res.json();

                    clientDetailsContent.innerHTML = `
                        <div class="form-actions">
                            <button class="edit-btn">Edit</button>
                        </div>
                        <h2>Client Details: ${client.name}</h2>
                        <p><strong>Case ID:</strong> ${client.id}</p>
                        <p><strong>Name:</strong> ${client.name}</p>
                        <p><strong>Age:</strong> ${client.age || 'N/A'}</p>
                        <p><strong>Gender:</strong> ${client.gender || 'N/A'}</p>
                        <p><strong>City:</strong> ${client.city || 'N/A'}</p>
                        <p><strong>Case Type:</strong> ${client.caseType || 'N/A'}</p>
                        <p><strong>Status:</strong> ${client.status || 'N/A'}</p>
                        <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
                        <p><strong>Counselor:</strong> ${client.therapistId || 'N/A'}</p>
                        <p><strong>Created At:</strong> ${new Date(client.createdAt).toLocaleString()}</p>
                        <p><strong>Updated At:</strong> ${new Date(client.updatedAt).toLocaleString()}</p>
                        <p><strong>Notes:</strong> ${client.notes || 'N/A'}</p>
                        <p><strong>Case History Doc:</strong> ${client.docLink ? `<a href="${client.docLink}" target="_blank">Open Document</a>` : 'N/A'}</p>
                        <p><strong>Session Summary Doc:</strong> ${client.sessionSummaryDocLink ? `<a href="${client.sessionSummaryDocLink}" target="_blank">Open Document</a>` : 'N/A'}</p>
                    `;

                    const editButton = clientDetailsContent.querySelector('.edit-btn');
                    editButton.addEventListener('click', () => {
                        clientDetailsContent.innerHTML = `
                            <form id="edit-client-form">
                                <h2>Edit Client: ${client.name}</h2>
                                <div class="form-group">
                                    <label for="edit-name">Name</label>
                                    <input type="text" id="edit-name" name="name" value="${client.name || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-age">Age</label>
                                    <input type="text" id="edit-age" name="age" value="${client.age || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-gender">Gender</label>
                                    <input type="text" id="edit-gender" name="gender" value="${client.gender || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-city">City</label>
                                    <input type="text" id="edit-city" name="city" value="${client.city || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-caseType">Case Type</label>
                                    <input type="text" id="edit-caseType" name="caseType" value="${client.caseType || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-status">Status</label>
                                    <input type="text" id="edit-status" name="status" value="${client.status || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-email">Email</label>
                                    <input type="email" id="edit-email" name="email" value="${client.email || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="edit-phone">Phone</label>
                                    <input type="tel" id="edit-phone" name="phone" value="${client.phone || ''}">
                                </div>
                                <div class="form-actions">
                                    <button type="submit">Save</button>
                                    <button type="button" class="cancel-btn">Cancel</button>
                                </div>
                            </form>
                        `;

                        const editForm = document.getElementById('edit-client-form');
                        const cancelButton = editForm.querySelector('.cancel-btn');
                        
                        cancelButton.addEventListener('click', () => {
                            modal.style.display = 'none';
                        });

                        editForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const formData = new FormData(editForm);
                            
                            for (const [key, value] of formData.entries()) {
                                if (value !== client[key]) {
                                    const command = `set_info ${client.id} ${key} ${value}`;
                                    try {
                                        const res = await fetch('/api/command', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${user.id}`
                                            },
                                            body: JSON.stringify({ command: command })
                                        });
                                        const result = await res.json();
                                        if (!res.ok) {
                                            throw new Error(result.response || `Failed to update ${key}`);
                                        }
                                    } catch (error) {
                                        console.error(`Error updating ${key}:`, error);
                                        alert(`Error updating ${key}: ${error.message}`);
                                    }
                                }
                            }

                            modal.style.display = 'none';
                            renderClientsView();
                        });
                    });

                    modal.style.display = 'block';
                } catch (error) {
                    console.error('Error fetching client details:', error);
                    alert(`Error fetching client details: ${error.message}`);
                }
            }
        });
    };

    const setupSessionModal = () => {
        const modal = document.getElementById('add-session-modal');
        const closeModal = modal.querySelector('.close-button');
        const cancelButton = modal.querySelector('.cancel-btn');
        const form = document.getElementById('add-session-form');
        const clientSelect = document.getElementById('session-client-id');

        // Function to open the modal
        const openModal = async () => {
            // Populate client dropdown
            try {
                const res = await fetch('/api/clients', {
                    headers: { 'Authorization': `Bearer ${user.id}` }
                });
                if (!res.ok) throw new Error('Failed to fetch clients for form');
                const clients = await res.json();
                clientSelect.innerHTML = clients.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');
            } catch (error) {
                console.error(error);
                alert(error.message);
            }
            modal.style.display = 'block';
        };

        // Function to close the modal
        const closeModalFunc = () => {
            modal.style.display = 'none';
            form.reset();
        };

        // Event listener for the "Add New Session" button
        mainContent.addEventListener('click', (event) => {
            if (event.target && event.target.textContent === 'Add New Session') {
                openModal();
            }
        });
        
        closeModal.addEventListener('click', closeModalFunc);
        cancelButton.addEventListener('click', closeModalFunc);
        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                closeModalFunc();
            }
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            const command = `add_session ${data.clientId} ${data.date} ${data.time} ${data.duration} ${data.type}`;

            try {
                const res = await fetch('/api/command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.id}`
                    },
                    body: JSON.stringify({ command: command })
                });

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.response || 'Failed to add session');
                }
                
                alert(result.response);
                closeModalFunc();
                renderScheduleView(); // Refresh the schedule view
            } catch (error) {
                console.error('Error adding session:', error);
                alert(`Error: ${error.message}`);
            }
        });
    };

    const setupClientModal = () => {
        const modal = document.getElementById('add-client-modal');
        const closeModal = modal.querySelector('.close-button');
        const cancelButton = modal.querySelector('.cancel-btn');
        const form = document.getElementById('add-client-form');

        const openModal = () => {
            modal.style.display = 'block';
        };

        const closeModalFunc = () => {
            modal.style.display = 'none';
            form.reset();
        };

        mainContent.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('add-new-client-btn')) {
                openModal();
            }
        });

        closeModal.addEventListener('click', closeModalFunc);
        cancelButton.addEventListener('click', closeModalFunc);
        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                closeModalFunc();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            const command = `create_user ${data.clientId} ${data.name}`;

            try {
                const res = await fetch('/api/command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user.id}`
                    },
                    body: JSON.stringify({ command: command })
                });

                const result = await res.json();

                if (!res.ok) {
                    throw new Error(result.response || 'Failed to add client');
                }
                
                alert(result.response);
                closeModalFunc();
                renderClientsView(); // Refresh the client list view
            } catch (error) {
                console.error('Error adding client:', error);
                alert(`Error: ${error.message}`);
            }
        });
    };

    // --- Navigation ---
    function setActiveNav(view) {
        navClients.classList.remove('active');
        navSchedule.classList.remove('active');
        if (view === 'clients') {
            navClients.classList.add('active');
        } else if (view === 'schedule') {
            navSchedule.classList.add('active');
        }
    }

    navClients.addEventListener('click', (e) => {
        e.preventDefault();
        renderClientsView();
    });

    navSchedule.addEventListener('click', (e) => {
        e.preventDefault();
        renderScheduleView();
    });

    const navLogout = document.getElementById('nav-logout');
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('marga-user');
        window.location.href = '/login.html';
    });

    // --- Initial View ---
    renderClientsView();
    setupClientDetailsModal();
    setupSessionModal();
    setupClientModal();
});
