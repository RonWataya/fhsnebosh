document.addEventListener('DOMContentLoaded', function() {
    // ... (your existing app.js code) ...

    const completeSubmissionBtn = document.getElementById('completeSubmissionBtn');

    if (completeSubmissionBtn) {
        completeSubmissionBtn.addEventListener('click', function() {
            // Display toast notification
            showToast('Form submitted');

            // Refresh the page after a short delay to allow toast to be seen
            setTimeout(() => {
                location.reload();
            }, 1000); // 1-second delay
        });
    }

    // Function to show a Bootstrap toast notification
    function showToast(message) {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.classList.add('toast-container', 'position-fixed', 'bottom-0', 'end-0', 'p-3');
            document.body.appendChild(toastContainer);
        }

        const toastHtml = `
            <div class="toast align-items-center text-bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = toastHtml;
        const toastElement = div.firstElementChild;
        toastContainer.appendChild(toastElement);

        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        // Optional: Remove toast element from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function () {
            toastElement.remove();
        });
    }
});