document.addEventListener('DOMContentLoaded', () => {
    const learnerNameInput = document.getElementById('learnerName');
    const learnerIdInput = document.getElementById('learnerId');
    const nameSuggestionsDiv = document.getElementById('nameSuggestions');
    const moduleTitleSelect = document.getElementById('moduleTitle'); // Changed ID to moduleTitle
    const attendanceDateInput = document.getElementById('attendanceDate'); // Keeping this to record when the signature was made
    const sessionSignersContainer = document.getElementById('sessionSigners').querySelector('.row'); // Parent for session blocks
    const statusMessageDiv = document.getElementById('statusMessage');

    // Signature Modal Elements
    const signatureModal = document.getElementById('signatureModal');
    const signatureCanvas = document.getElementById('signatureCanvas');
    const clearSignatureBtn = document.getElementById('clearSignature');
    const saveSignatureBtn = document.getElementById('saveSignature');
    let signaturePad = new SignaturePad(signatureCanvas);
    let currentSessionNumToSign = null; // To track which session is being signed

    // IMPORTANT CHANGE: Initialize the Bootstrap modal instance ONCE here
    const bsModalInstance = new bootstrap.Modal(signatureModal);

    signatureModal.addEventListener('shown.bs.modal', () => {
        // Resize canvas when modal opens to ensure correct drawing area
        const parent = signatureCanvas.parentElement;
        signatureCanvas.width = parent.clientWidth;
        signatureCanvas.height = 200; // Fixed height for consistency, adjust as needed
        signaturePad.clear(); // Clear previous drawing
        signaturePad.on(); // Enable drawing
    });

    signatureModal.addEventListener('hidden.bs.modal', () => {
        signaturePad.off(); // Disable drawing when modal is hidden
        signaturePad.clear(); // IMPORTANT: Clear the pad when modal closes
    });

    // Course data (now only by module title)
    // This can be fetched from backend if dynamic
    const courseModules = [
        '1 Why we should manage workplace health and safety ',
        '2 How health and safety management systems work and what they look like',
        '3 Managing risk - understanding people and process',
        '4 Health and safety monitoring and measuring ',
        '5 Physical and psychological health',
        '6 Musculoskeletal health ',
        '7 Chemical and biological agents',
        '8 General  workplace issues',
        '9 Work equipment ',
        '10 Fire'
    ];

    // Populate Module Title dropdown
    function populateModuleTitles() {
        moduleTitleSelect.innerHTML = '<option value="">-- Select Module --</option>';
        courseModules.forEach((item) => {
            const option = document.createElement('option');
            option.value = item; // Use the full module title as value
            option.textContent = item;
            moduleTitleSelect.appendChild(option);
        });
    }
    populateModuleTitles();

    // --- Signature Pad Modal Logic ---
    function openSignatureModal(sessionNum) {
        currentSessionNumToSign = sessionNum;
        bsModalInstance.show(); // IMPORTANT CHANGE: Use the initialized Bootstrap modal instance to show
    }

    clearSignatureBtn.addEventListener('click', () => {
        signaturePad.clear();
    });

    saveSignatureBtn.addEventListener('click', async () => {
        if (signaturePad.isEmpty()) {
            displayStatus('Please provide a signature before saving.', 'warning');
            return;
        }

        const learnerName = learnerNameInput.value.trim();
        const learnerId = learnerIdInput.value;
        const attendanceDate = attendanceDateInput.value; // Date of signing
        const moduleTitle = moduleTitleSelect.value; // Get selected module title

        // Basic validation before sending signature
        if (!learnerName || !attendanceDate || !moduleTitle) {
            displayStatus('Please fill in Learner Name, Date, and Module Title before signing.', 'danger');
            bsModalInstance.hide(); // Hide modal if validation fails
            return;
        }

        const signatureData = signaturePad.toDataURL('image/png'); // Base64 image

        displayStatus(`Signing for Session ${currentSessionNumToSign}...`, 'info');

        try {
            const response = await fetch('https://traininghealthandsafety.com:3000/api/sign-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    learnerName,
                    learnerId,
                    attendanceDate,
                    moduleTitle, // moduleDay removed
                    sessionNum: currentSessionNumToSign,
                    signatureData
                })
            });

            if (response.ok) {
                const result = await response.json();
                displayStatus(result.message || `Session ${currentSessionNumToSign} signed successfully!`, 'success');
                bsModalInstance.hide(); // Hide modal on success
                // After successful sign, re-fetch attendance to update UI
                // IMPORTANT: Update learnerIdInput if a new learner was created on the backend
                if (result.learnerId && learnerIdInput.value === 'NEW') {
                    learnerIdInput.value = result.learnerId;
                }
                fetchAttendanceForLearnerModule(); // Call the updated fetch function
            } else {
                const errorData = await response.json();
                displayStatus(`Failed to sign session: ${errorData.message || response.statusText}`, 'danger');
            }
        } catch (error) {
            console.error('Error signing session:', error);
            displayStatus('An error occurred while signing. Check console for details.', 'danger');
        } finally {
            currentSessionNumToSign = null;
        }
    });

    // --- Autocomplete Logic ---
    let currentFocus = -1; // Global variable for active autocomplete item

    learnerNameInput.addEventListener('input', async function() {
        const query = this.value.trim();
        closeAllLists(); // Close any existing lists

        if (!query || query.length < 2) {
            learnerIdInput.value = 'NEW'; // Reset to NEW if input is cleared or too short
            // Also clear attendance status when learner name is cleared
            renderSessionSigners({});
            return;
        }

        try {
            const response = await fetch(`https://traininghealthandsafety.com:3000/api/learners/search?query=${query}`);
            if (!response.ok) throw new Error('Failed to fetch learners');
            const learners = await response.json();

            nameSuggestionsDiv.innerHTML = ''; // Clear existing suggestions
            if (learners.length === 0) {
                nameSuggestionsDiv.style.display = 'none';
                return;
            }

            learners.forEach(learner => {
                const btn = document.createElement("button");
                btn.setAttribute("type", "button");
                btn.classList.add("list-group-item", "list-group-item-action");
                btn.innerHTML = `<strong>${learner.learner_name.substr(0, query.length)}</strong>${learner.learner_name.substr(query.length)}`;
                btn.innerHTML += `<input type='hidden' value='${learner.learner_name}' data-learner-id='${learner.learner_id}'>`;

                btn.addEventListener("click", function() {
                    learnerNameInput.value = this.getElementsByTagName("input")[0].value;
                    learnerIdInput.value = this.getElementsByTagName("input")[0].dataset.learnerId;
                    closeAllLists();
                    // After selecting a learner, try to fetch their current module's attendance
                    fetchAttendanceForLearnerModule(); // Call the updated fetch function
                });
                nameSuggestionsDiv.appendChild(btn);
            });
            nameSuggestionsDiv.style.display = 'block'; // Show the suggestions container
        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            nameSuggestionsDiv.innerHTML = '';
            nameSuggestionsDiv.style.display = 'none';
        }
    });

    learnerNameInput.addEventListener('keydown', function(e) {
        let x = nameSuggestionsDiv.getElementsByTagName("button");
        if (x.length === 0) return;

        if (e.keyCode == 40) { // Down arrow
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) { // Up arrow
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) { // Enter key
            e.preventDefault();
            if (currentFocus > -1 && x[currentFocus]) {
                x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != learnerNameInput) {
                x[i].innerHTML = ''; // Clear content
                x[i].style.display = 'none'; // Hide
            }
        }
        currentFocus = -1;
    }
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });

    // --- Dynamic Session Signer Blocks & Status Update (UNCHANGED LOGIC) ---
    function renderSessionSigners(currentSignatures = {}) {
        sessionSignersContainer.innerHTML = ''; // Clear previous
        for (let i = 1; i <= 4; i++) {
            const signatureKey = `signature${i}`;
            const isSignedKey = `is_signed${i}`;
            
            // Determine signed status using the new is_signedX flag
            const isSigned = currentSignatures[isSignedKey] === 1;
            const signatureData = currentSignatures[signatureKey];

            const colDiv = document.createElement('div');
            colDiv.classList.add('col-12', 'col-md-6', 'col-lg-3'); // Responsive columns

            const sessionBlock = document.createElement('div');
            sessionBlock.classList.add('session-signer-block', 'p-3', 'shadow-sm', 'h-100');
            
            let isDisabled = false;
            if (i > 1) { // For sessions after the first one
                const prevIsSignedKey = `is_signed${i-1}`;
                if (currentSignatures[prevIsSignedKey] !== 1) { // If previous session is NOT signed
                    isDisabled = true;
                }
            }

            if (isSigned) {
                sessionBlock.classList.add('signed');
            } else if (isDisabled) {
                sessionBlock.classList.add('disabled-session');
            }

            sessionBlock.innerHTML = `
                <h5>Session ${i}</h5>
                ${isSigned ? 
                    `<img src="${signatureData}" class="signature-display-thumb" alt="Signature ${i}">
                     <span class="text-success-status mt-2">Signed!</span>`
                    : `<button type="button" class="btn btn-primary btn-sign-session mt-2" data-session-num="${i}" ${isDisabled ? 'disabled' : ''}>Sign Now</button>`
                }
            `;
            colDiv.appendChild(sessionBlock);
            sessionSignersContainer.appendChild(colDiv);
        }

        // Attach click listeners to new sign buttons
        sessionSignersContainer.querySelectorAll('.btn-sign-session').forEach(button => {
            button.addEventListener('click', (event) => {
                const sessionNum = event.target.dataset.sessionNum;
                openSignatureModal(parseInt(sessionNum));
            });
        });
    }

    // Function to fetch attendance status for selected learner/module (MODIFIED)
    async function fetchAttendanceForLearnerModule() { // Renamed function
        const learnerId = learnerIdInput.value;
        const moduleTitle = moduleTitleSelect.value; // Fetch by module title

        // Basic validation for form fields before fetching
        const learnerName = learnerNameInput.value.trim();
        let isValid = true;
        if (!learnerName) {
            learnerNameInput.classList.add('is-invalid');
            isValid = false;
        } else {
            learnerNameInput.classList.remove('is-invalid');
        }
        if (!moduleTitle) {
            moduleTitleSelect.classList.add('is-invalid');
            isValid = false;
        } else {
            moduleTitleSelect.classList.remove('is-invalid');
        }
        // attendanceDate is no longer part of the lookup, so it doesn't need validation here
        // if (!attendanceDateInput.value) { /* ... */ }


        if (!isValid || learnerId === 'NEW') {
            // If validation fails or it's a new learner, clear or reset session blocks.
            // A 'NEW' learner cannot have existing signatures for this day yet.
            renderSessionSigners({});
            return;
        }

        displayStatus('Fetching existing signatures for module...', 'info');

        try {
            // Changed API endpoint and parameters
            const response = await fetch(`https://traininghealthandsafety.com:3000/api/attendance/learner-module?learnerId=${learnerId}&moduleTitle=${encodeURIComponent(moduleTitle)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.record_id) {
                    renderSessionSigners(data);
                    displayStatus('Existing signatures loaded.', 'success');
                } else {
                    renderSessionSigners({}); // No record found, enable session 1
                    displayStatus('No existing signatures found for this module for this learner.', 'secondary');
                }
            } else {
                console.error('Failed to fetch existing attendance:', response.statusText);
                renderSessionSigners({}); // Reset on error
                displayStatus('Error fetching existing signatures.', 'danger');
            }
        } catch (error) {
            console.error('Error fetching existing attendance:', error);
            renderSessionSigners({}); // Reset on network error
            displayStatus('Network error fetching existing signatures.', 'danger');
        }
    }

    // Event listeners for changes in primary fields to trigger attendance status fetch
    learnerNameInput.addEventListener('change', () => {
        if (learnerIdInput.value !== 'NEW' || learnerNameInput.value.trim() === '') {
            fetchAttendanceForLearnerModule(); // Call updated function
        }
    });
    // attendanceDateInput no longer triggers fetch for unique lookup
    moduleTitleSelect.addEventListener('change', fetchAttendanceForLearnerModule); // Call updated function


    // Helper function to display status messages
    function displayStatus(message, type) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `mt-4 alert alert-${type}`;
        statusMessageDiv.style.display = 'block';
        setTimeout(() => {
            statusMessageDiv.style.display = 'none';
        }, 5000); // Hide after 5 seconds
    }

    // Initial load logic: If form fields are pre-filled (e.g., browser autocomplete on refresh),
    // attempt to fetch existing attendance. Otherwise, render empty session blocks.
    // Check for moduleTitle instead of moduleDay
    if (learnerNameInput.value && moduleTitleSelect.value && learnerIdInput.value !== 'NEW') {
        fetchAttendanceForLearnerModule(); // Call updated function
    } else {
        renderSessionSigners({});
    }
});
