// app.js

const logoutBtn = document.getElementById('logout-btn');
const dashboardPage = document.getElementById('dashboard-page');
const learnersPage = document.getElementById('learners-page');
const learnersTableBody = document.getElementById('learners-table-body');
const totalLearnersCard = document.getElementById('total-learners');
const learnerDetailModal = new bootstrap.Modal(document.getElementById('learnerDetailModal'));
const modalLearnerName = document.getElementById('modal-learner-name');
const modalRegistrationDate = document.getElementById('modal-registration-date');
const attendanceList = document.getElementById('attendance-list');
const noAttendanceMessage = document.getElementById('no-attendance-message');

let currentView = '';

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('loggedIn') !== 'true') {
    window.location.href = 'index.html';
    return;
  }
  showPage('dashboard');
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('loggedIn');
  window.location.href = 'index';
});

function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(page => {
    page.classList.add('d-none');
  });

  if (pageId === 'dashboard' || pageId === 'learners') {
    dashboardPage.classList.remove('d-none');
    fetchTotalLearners();
    fetchAllLearners();
  }
  currentView = pageId;
}

async function fetchTotalLearners() {
  try {
    const response = await fetch('https://traininghealthandsafety.com:3000/api/learners/count');
    const data = await response.json();
    totalLearnersCard.textContent = data.total_learners;
  } catch (error) {
    console.error('Error fetching total learners:', error);
    totalLearnersCard.textContent = 'Error';
  }
}

async function fetchAllLearners() {
  try {
    const response = await fetch('https://traininghealthandsafety.com:3000/api/learners');
    const learners = await response.json();
    learnersTableBody.innerHTML = '';

    if (learners.length === 0) {
      learnersTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No learners registered yet.</td></tr>';
      return;
    }

    learners.forEach(learner => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${learner.learner_id}</td>
        <td><a href="#" class="view-learner-details" data-id="${learner.learner_id}">${learner.learner_name}</a></td>
        <td>${new Date(learner.registration_date).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-info btn-sm view-learner-details me-2" data-id="${learner.learner_id}">View</button>
          <button class="btn btn-danger btn-sm remove-learner-btn" data-id="${learner.learner_id}">Remove</button>
        </td>
      `;
      learnersTableBody.appendChild(row);
    });

    document.querySelectorAll('.view-learner-details').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const id = e.target.dataset.id;
        fetchLearnerDetails(id);
      });
    });

    document.querySelectorAll('.remove-learner-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.target.dataset.id;
        removeLearner(id);
      });
    });

  } catch (error) {
    console.error('Error loading learners:', error);
    learnersTableBody.innerHTML = '<tr><td colspan="4" class="text-danger">Failed to load learners.</td></tr>';
  }
}

async function removeLearner(id) {
  if (!confirm('Are you sure you want to delete this learner and their attendance?')) return;

  try {
    const response = await fetch(`https://traininghealthandsafety.com:3000/api/learners/${id}`, { method: 'DELETE' });
    if (response.ok) {
      alert('Learner removed.');
      fetchAllLearners();
      fetchTotalLearners();
    } else {
      alert('Error removing learner.');
    }
  } catch (err) {
    console.error('Remove error:', err);
  }
}

async function fetchLearnerDetails(id) {
  try {
    const allLearners = await (await fetch('https://traininghealthandsafety.com:3000/api/learners')).json();
    const learner = allLearners.find(l => l.learner_id == id);

    if (learner) {
      modalLearnerName.textContent = learner.learner_name;
      modalRegistrationDate.textContent = new Date(learner.registration_date).toLocaleDateString();
    }

    const response = await fetch(`https://traininghealthandsafety.com:3000/api/learners/${id}/attendance`);
    const records = await response.json();

    attendanceList.innerHTML = '';
    noAttendanceMessage.classList.add('d-none');

    if (records.length === 0) {
      noAttendanceMessage.classList.remove('d-none');
    } else {
      records.forEach(r => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex align-items-center';

        const badgeHTML = Object.keys(r.isSignedStatus).map(key => {
          const signed = r.isSignedStatus[key];
          const label = key.replace('is_signed', 'Sig');
          return `<span class="badge ${signed ? 'bg-success' : 'bg-danger'} me-1">${label}</span>`;
        }).join('');

        li.innerHTML = `
          ${r.signatures.signature1 ? `<img src="${r.signatures.signature1}" class="me-2" style="max-width:60px;">` : '<span class="text-muted me-2">No Sig</span>'}
          <div>
            <strong>${r.moduleTitle}</strong> - Day ${r.moduleDay}<br>
            <small>${new Date(r.attendanceDate).toLocaleDateString()}</small>
          </div>
          <div class="ms-auto">${badgeHTML}</div>
        `;

        attendanceList.appendChild(li);
      });
    }

    learnerDetailModal.show();

  } catch (err) {
    console.error('Error fetching learner detail:', err);
    modalLearnerName.textContent = 'Error';
    modalRegistrationDate.textContent = 'Error';
    attendanceList.innerHTML = '';
    noAttendanceMessage.classList.remove('d-none');
    learnerDetailModal.show();
  }
}
