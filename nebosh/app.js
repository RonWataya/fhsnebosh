document.addEventListener('DOMContentLoaded', () => {
    const learnerNameInput = document.getElementById('learnerName');
    const learnerIdInput = document.getElementById('learnerId');
    const nameSuggestionsDiv = document.getElementById('nameSuggestions');
    const moduleTitleSelect = document.getElementById('moduleTitle');
    const attendanceDateInput = document.getElementById('attendanceDate');
    const sessionSignersContainer = document.getElementById('sessionSigners').querySelector('.row');
    const statusMessageDiv = document.getElementById('statusMessage');

    const signatureModal = document.getElementById('signatureModal');
    const signatureCanvas = document.getElementById('signatureCanvas');
    const clearSignatureBtn = document.getElementById('clearSignature');
    const saveSignatureBtn = document.getElementById('saveSignature');
    let signaturePad = new SignaturePad(signatureCanvas);
    let currentSessionNumToSign = null;

    const bsModalInstance = new bootstrap.Modal(signatureModal);

    signatureModal.addEventListener('shown.bs.modal', () => {
        const parent = signatureCanvas.parentElement;
        signatureCanvas.width = parent.clientWidth;
        signatureCanvas.height = 200;
        signaturePad.clear();
        signaturePad.on();
    });

    signatureModal.addEventListener('hidden.bs.modal', () => {
        signaturePad.off();
        signaturePad.clear();
    });

    // Course data: Store objects with both full display text and clean name for backend
    // MODIFICATION HERE: Set value to display text (which includes the number)
    const courseModules = [
        { display: '1 Why we should manage workplace health and safety', value: '1 Why we should manage workplace health and safety' },
        { display: '2 How health and safety management systems work and what they look like', value: '2 How health and safety management systems work and what they look like' },
        { display: '3 Managing risk - understanding people and process', value: '3 Managing risk - understanding people and process' },
        { display: '4 Health and safety monitoring and measuring', value: '4 Health and safety monitoring and measuring' },
        { display: '5 Physical and psychological health', value: '5 Physical and psychological health' },
        { display: '6 Musculoskeletal health', value: '6 Musculoskeletal health' },
        { display: '7 Chemical and biological agents', value: '7 Chemical and biological agents' },
        { display: '8 General workplace issues', value: '8 General workplace issues' },
        { display: '9 Work equipment', value: '9 Work equipment' },
        { display: '10 Fire', value: '10 Fire' }
    ];

    // Populate Module Title dropdown
    function populateModuleTitles() {
        moduleTitleSelect.innerHTML = '<option value="">-- Select Module --</option>';
        courseModules.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.value; // Now sends the value with the number
            option.textContent = item.display; // Show this in the dropdown (with number)
            moduleTitleSelect.appendChild(option);
        });
    }
    populateModuleTitles();

    function openSignatureModal(sessionNum) {
        currentSessionNumToSign = sessionNum;
        bsModalInstance.show();
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
        const attendanceDate = attendanceDateInput.value;
        // This will now correctly be the value with the number (e.g., "1 Why we should manage...")
        const moduleTitle = moduleTitleSelect.value; 

        if (!learnerName || !attendanceDate || !moduleTitle) {
            displayStatus('Please fill in Learner Name, Date, and Module Title before signing.', 'danger');
            bsModalInstance.hide();
            return;
        }

        const signatureData = signaturePad.toDataURL('image/png');

        displayStatus(`Signing for Session ${currentSessionNumToSign}...`, 'info');

        try {
            const response = await fetch('https://traininghealthandsafety.com:3000/api/sign-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    learnerName,
                    learnerId,
                    attendanceDate,
                    moduleTitle, // This now sends the value (e.g., "1 Why we should manage...")
                    sessionNum: currentSessionNumToSign,
                    signatureData
                })
            });

            if (response.ok) {
                const result = await response.json();
                displayStatus(result.message || `Session ${currentSessionNumToSign} signed successfully!`, 'success');
                bsModalInstance.hide();
                if (result.learnerId && learnerIdInput.value === 'NEW') {
                    learnerIdInput.value = result.learnerId;
                }
                fetchAttendanceForLearnerModule();
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

    // --- Autocomplete Logic (No changes needed here for module names) ---
    let currentFocus = -1;

    learnerNameInput.addEventListener('input', async function() {
        const query = this.value.trim();
        closeAllLists();

        if (!query || query.length < 2) {
            learnerIdInput.value = 'NEW';
            renderSessionSigners({});
            return;
        }

        try {
            const response = await fetch(`https://traininghealthandsafety.com:3000/api/learners/search?query=${query}`);
            if (!response.ok) throw new Error('Failed to fetch learners');
            const learners = await response.json();

            nameSuggestionsDiv.innerHTML = '';
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
                    fetchAttendanceForLearnerModule();
                });
                nameSuggestionsDiv.appendChild(btn);
            });
            nameSuggestionsDiv.style.display = 'block';
        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            nameSuggestionsDiv.innerHTML = '';
            nameSuggestionsDiv.style.display = 'none';
        }
    });

    learnerNameInput.addEventListener('keydown', function(e) {
        let x = nameSuggestionsDiv.getElementsByTagName("button");
        if (x.length === 0) return;

        if (e.keyCode == 40) {
            currentFocus++;
            addActive(x);
        } else if (e.keyCode == 38) {
            currentFocus--;
            addActive(x);
        } else if (e.keyCode == 13) {
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
                x[i].innerHTML = '';
                x[i].style.display = 'none';
            }
        }
        currentFocus = -1;
    }
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });

    // --- Dynamic Session Signer Blocks & Status Update (No changes needed here) ---
    function renderSessionSigners(currentSignatures = {}) {
        sessionSignersContainer.innerHTML = '';
        for (let i = 1; i <= 4; i++) {
            const signatureKey = `signature${i}`;
            const isSignedKey = `is_signed${i}`;

            const isSigned = currentSignatures[isSignedKey] === 1;
            const signatureData = currentSignatures[signatureKey];

            const colDiv = document.createElement('div');
            colDiv.classList.add('col-12', 'col-md-6', 'col-lg-3');

            const sessionBlock = document.createElement('div');
            sessionBlock.classList.add('session-signer-block', 'p-3', 'shadow-sm', 'h-100');

            let isDisabled = false;
            if (i > 1) {
                const prevIsSignedKey = `is_signed${i-1}`;
                if (currentSignatures[prevIsSignedKey] !== 1) {
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

        sessionSignersContainer.querySelectorAll('.btn-sign-session').forEach(button => {
            button.addEventListener('click', (event) => {
                const sessionNum = event.target.dataset.sessionNum;
                openSignatureModal(parseInt(sessionNum));
            });
        });
    }

    // Function to fetch attendance status for selected learner/module (No changes needed here)
    async function fetchAttendanceForLearnerModule() {
        const learnerId = learnerIdInput.value;
        const moduleTitle = moduleTitleSelect.value; // This will also be the value with the number

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

        if (!isValid || learnerId === 'NEW') {
            renderSessionSigners({});
            return;
        }

        displayStatus('Fetching existing signatures for module...', 'info');

        try {
            const response = await fetch(`https://traininghealthandsafety.com:3000/api/attendance/learner-module?learnerId=${learnerId}&moduleTitle=${encodeURIComponent(moduleTitle)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.record_id) {
                    renderSessionSigners(data);
                    displayStatus('Existing signatures loaded.', 'success');
                } else {
                    renderSessionSigners({});
                    displayStatus('No existing signatures found for this module for this learner.', 'secondary');
                }
            } else {
                console.error('Failed to fetch existing attendance:', response.statusText);
                renderSessionSigners({});
                displayStatus('Error fetching existing signatures.', 'danger');
            }
        } catch (error) {
            console.error('Error fetching existing attendance:', error);
            renderSessionSigners({});
            displayStatus('Network error fetching existing signatures.', 'danger');
        }
    }

    learnerNameInput.addEventListener('change', () => {
        if (learnerIdInput.value !== 'NEW' || learnerNameInput.value.trim() === '') {
            fetchAttendanceForLearnerModule();
        }
    });

    moduleTitleSelect.addEventListener('change', fetchAttendanceForLearnerModule);

    function displayStatus(message, type) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = `mt-4 alert alert-${type}`;
        statusMessageDiv.style.display = 'block';
        setTimeout(() => {
            statusMessageDiv.style.display = 'none';
        }, 5000);
    }

    if (learnerNameInput.value && moduleTitleSelect.value && learnerIdInput.value !== 'NEW') {
        fetchAttendanceForLearnerModule();
    } else {
        renderSessionSigners({});
    }
});