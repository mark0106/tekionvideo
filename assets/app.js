// ===== DOM References =====
const joinForm = document.getElementById('join-form');
const identityInput = document.getElementById('identity-input');
const roomInput = document.getElementById('room-input');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const flipBtn = document.getElementById('flip-btn');
const localVideo = document.getElementById('local-video');
const noVideoPlaceholder = document.getElementById('no-video-placeholder');
const recBadge = document.getElementById('rec-badge');
const statusMessage = document.getElementById('status-message');
const recordingsList = document.getElementById('recordings-list');
const recordingsStatus = document.getElementById('recordings-status');
const recordingsPagination = document.getElementById('recordings-pagination');
const videoModal = document.getElementById('video-modal');
const modalVideo = document.getElementById('modal-video');
const modalTitle = document.getElementById('modal-title');
const smsModal = document.getElementById('sms-modal');
const smsPhoneInput = document.getElementById('sms-phone-input');
const smsSendBtn = document.getElementById('sms-send-btn');
const smsStatus = document.getElementById('sms-status');
const smsRecordingLabel = document.getElementById('sms-recording-label');

// ===== State =====
let currentRoom = null;
let currentRoomSid = null;
let currentIdentity = null;
let currentRoomName = null;
let pollTimeout = null;
let currentDeviceId = null;
let storageBucket = null;
let firebaseApiKey = null;

let compositionUploading = false; // whether a composition upload is in progress
const PAGE_SIZE = 10;
let recordingsPage = 0;
let recordingsAllItems = []; // full sorted list for pagination

// ===== Initialise — fetch public config then load all stored videos =====

fetch('/config')
  .then((r) => r.json())
  .then(({ storageBucket: bucket, apiKey }) => {
    storageBucket = bucket;
    firebaseApiKey = apiKey;
    loadAllVideos();
  })
  .catch((err) => console.error('Could not load config:', err));

// ===== Firebase Storage helpers =====

function firebaseListUrl() {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o` +
    `?prefix=recordings%2F&maxResults=200&key=${firebaseApiKey}`
  );
}

function firebaseDownloadUrl(name) {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/` +
    `${encodeURIComponent(name)}?alt=media&key=${firebaseApiKey}`
  );
}

async function loadAllVideos() {
  if (!storageBucket) return;

  recordingsStatus.innerHTML = '<span class="spinner"></span>Loading recordings...';
  recordingsStatus.classList.remove('hidden');

  try {
    const res = await fetch(firebaseListUrl());
    if (!res.ok) throw new Error(`Firebase list returned ${res.status}`);
    const data = await res.json();
    renderFirebaseVideos(data.items || []);
  } catch (err) {
    console.error('Could not load videos from Firebase:', err);
    recordingsStatus.textContent = 'Could not load recordings.';
    recordingsStatus.classList.remove('hidden');
  }
}

function renderFirebaseVideos(items) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = items.filter((item) => {
    const base = item.name.split('/').pop();
    const tsMatch = base.match(/^(\d{13})_/);
    if (tsMatch) return parseInt(tsMatch[1], 10) >= cutoff;
    return true;
  });

  if (recent.length === 0) {
    recordingsStatus.textContent = 'No recordings in the last 24 hours.';
    recordingsStatus.classList.remove('hidden');
    recordingsList.innerHTML = '';
    recordingsPagination.classList.add('hidden');
    return;
  }

  recordingsStatus.classList.add('hidden');

  const tsOf = (item) => {
    const m = item.name.split('/').pop().match(/^(\d{13})_/);
    return m ? parseInt(m[1], 10) : 0;
  };
  recordingsAllItems = [...recent].sort((a, b) => tsOf(b) - tsOf(a));
  recordingsPage = 0;
  renderPage();
}

function renderPage() {
  const start = recordingsPage * PAGE_SIZE;
  const page = recordingsAllItems.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(recordingsAllItems.length / PAGE_SIZE);

  recordingsList.innerHTML = page.map((item) => {
    const name = item.name.split('/').pop();
    const url = firebaseDownloadUrl(item.name);
    const isVideo = !name.endsWith('.mka');

    const base = name.replace(/\.mp4$/, '');
    const parts = base.split('_');
    let displayName = null;
    let roomLabel = null;
    let recordedAt = null;
    if (parts.length >= 4 && /^\d{13}$/.test(parts[0])) {
      displayName = parts[1].replace(/-/g, ' ');
      roomLabel = parts[2].replace(/-/g, ' ');
      recordedAt = new Date(parseInt(parts[0], 10)).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    }

    const primaryLabel = displayName || name;
    const secondaryLabel = [roomLabel && `Room: ${roomLabel}`, recordedAt]
      .filter(Boolean).join(' · ');

    const smsBtn = `<button class="recording-sms-btn"
        data-sms-url="${escapeHTML(url)}"
        data-sms-name="${escapeHTML(primaryLabel)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        SMS
      </button>`;

    return `
      <li class="recording-item">
        <div class="recording-info">
          <span class="recording-name">${escapeHTML(primaryLabel)}</span>
          ${secondaryLabel ? `<span class="recording-meta">${escapeHTML(secondaryLabel)}</span>` : ''}
        </div>
        <div class="recording-actions">
          ${isVideo
            ? `<button class="recording-view-btn"
                 data-view-url="${escapeHTML(url)}"
                 data-view-title="${escapeHTML(primaryLabel)}">View</button>`
            : `<a class="recording-view-btn" href="${escapeHTML(url)}" target="_blank" rel="noopener">Download</a>`
          }
          ${smsBtn}
        </div>
      </li>`;
  }).join('');

  // Pagination controls
  if (totalPages <= 1) {
    recordingsPagination.classList.add('hidden');
  } else {
    recordingsPagination.classList.remove('hidden');
    recordingsPagination.innerHTML = `
      <button class="pagination-btn" id="page-prev" ${recordingsPage === 0 ? 'disabled' : ''}>&lsaquo; Prev</button>
      <span class="pagination-info">Page ${recordingsPage + 1} of ${totalPages}</span>
      <button class="pagination-btn" id="page-next" ${recordingsPage >= totalPages - 1 ? 'disabled' : ''}>Next &rsaquo;</button>`;

    document.getElementById('page-prev').addEventListener('click', () => {
      recordingsPage--;
      renderPage();
    });
    document.getElementById('page-next').addEventListener('click', () => {
      recordingsPage++;
      renderPage();
    });
  }
}

// ===== API Helpers =====

async function fetchToken(identity, roomName) {
  const res = await fetch('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, roomName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to get token');
  }
  return res.json();
}

async function stopRoom(roomSid) {
  const res = await fetch('/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomSid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to stop room');
  }
  return res.json();
}

async function createComposition(roomSid) {
  const res = await fetch('/compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomSid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to create composition');
  }
  return res.json();
}

async function fetchCompositionStatus(compositionSid) {
  const res = await fetch(`/composition-status?compositionSid=${encodeURIComponent(compositionSid)}`);
  if (!res.ok) throw new Error('Failed to fetch composition status');
  return res.json();
}

async function uploadComposition(compositionSid, identity, roomName) {
  const res = await fetch('/upload-composition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compositionSid, identity, roomName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  const { url } = await res.json();
  return url;
}

// ===== UI Helpers =====

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type === 'error') statusMessage.classList.add('status-error');
  if (type === 'success') statusMessage.classList.add('status-success');
}

function setStatusHTML(html, type) {
  statusMessage.innerHTML = html;
  statusMessage.className = 'status-message';
  if (type === 'error') statusMessage.classList.add('status-error');
  if (type === 'success') statusMessage.classList.add('status-success');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function showJoinForm() {
  joinForm.classList.remove('hidden');
  startBtn.disabled = false;
  stopBtn.classList.add('hidden');
}

function showStopButton() {
  joinForm.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  stopBtn.disabled = false;
}

// ===== Video Modal =====

function openVideoModal(url, title) {
  modalTitle.textContent = title || 'Recording';
  modalVideo.src = url;
  videoModal.classList.remove('hidden');
  modalVideo.play().catch(() => {});
}

function closeVideoModal() {
  videoModal.classList.add('hidden');
  modalVideo.pause();
  modalVideo.src = '';
}

// ===== SMS Modal =====

let smsCurrentUrl = null;
let smsCurrentName = null;

function openSmsModal(url, name) {
  smsCurrentUrl = url;
  smsCurrentName = name;
  smsRecordingLabel.textContent = name || url;
  smsPhoneInput.value = '';
  smsStatus.textContent = '';
  smsStatus.className = 'sms-status hidden';
  smsSendBtn.disabled = false;
  smsModal.classList.remove('hidden');
  smsPhoneInput.focus();
}

function closeSmsModal() {
  smsModal.classList.add('hidden');
  smsCurrentUrl = null;
  smsCurrentName = null;
}

async function sendSms() {
  const to = smsPhoneInput.value.trim();
  if (!to) {
    smsStatus.textContent = 'Please enter a phone number.';
    smsStatus.className = 'sms-status sms-error';
    smsStatus.classList.remove('hidden');
    return;
  }

  smsSendBtn.disabled = true;
  smsStatus.innerHTML = '<span class="spinner"></span>Sending...';
  smsStatus.className = 'sms-status';
  smsStatus.classList.remove('hidden');

  try {
    const res = await fetch('/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, recordingUrl: smsCurrentUrl, recordingName: smsCurrentName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send SMS');

    smsStatus.textContent = 'SMS sent successfully!';
    smsStatus.className = 'sms-status sms-success';
    smsPhoneInput.value = '';
    setTimeout(closeSmsModal, 2000);
  } catch (err) {
    smsStatus.textContent = 'Error: ' + err.message;
    smsStatus.className = 'sms-status sms-error';
    smsSendBtn.disabled = false;
  }
}

// ===== Core Logic =====

async function startVideo() {
  const identity = identityInput.value.trim();
  const roomName = roomInput.value.trim();

  if (!identity || !roomName) {
    setStatus('Please enter both a display name and room name.', 'error');
    return;
  }

  startBtn.disabled = true;
  setStatusHTML('<span class="spinner"></span>Connecting...', null);

  try {
    const { token, roomSid } = await fetchToken(identity, roomName);
    currentRoomSid = roomSid;
    currentIdentity = identity;
    currentRoomName = roomName;

    const room = await Twilio.Video.connect(token, {
      name: roomName,
      video: true,
      audio: true,
    });

    currentRoom = room;

    noVideoPlaceholder.classList.add('hidden');
    room.localParticipant.videoTracks.forEach((pub) => {
      localVideo.appendChild(pub.track.attach());
    });

    recBadge.classList.remove('hidden');
    flipBtn.classList.remove('hidden');
    document.querySelector('.video-container').classList.add('recording');
    showStopButton();
    setStatus('Recording in progress...', null);

    room.on('disconnected', () => cleanupVideo());
  } catch (err) {
    console.error('Start video error:', err);
    setStatus('Error: ' + err.message, 'error');
    showJoinForm();
  }
}

async function stopVideo() {
  stopBtn.disabled = true;
  compositionUploading = false;
  setStatusHTML('<span class="spinner"></span>Stopping recording...', null);

  const savedRoomSid = currentRoomSid;
  const savedIdentity = currentIdentity;
  const savedRoomName = currentRoomName;

  try {
    if (savedRoomSid) await stopRoom(savedRoomSid);
  } catch (err) {
    console.error('Stop room error:', err);
  }

  if (currentRoom) currentRoom.disconnect();

  cleanupVideo();
  setStatus('Processing and uploading to Firebase...', 'success');
  showJoinForm();

  if (savedRoomSid) {
    try {
      const { compositionSid } = await createComposition(savedRoomSid);
      startPollingComposition(compositionSid, savedIdentity, savedRoomName);
    } catch (err) {
      console.error('Failed to create composition:', err);
      setStatus('Error creating MP4: ' + err.message, 'error');
    }
  }
}

function cleanupVideo() {
  localVideo.querySelectorAll('video, audio').forEach((el) => el.remove());
  noVideoPlaceholder.classList.remove('hidden');
  recBadge.classList.add('hidden');
  flipBtn.classList.add('hidden');
  document.querySelector('.video-container').classList.remove('recording');
  currentDeviceId = null;
  currentRoom = null;
  currentRoomSid = null;
  currentIdentity = null;
  currentRoomName = null;
}

function startPollingComposition(compositionSid, identity, roomName) {
  stopPolling();

  let elapsed = 0;
  const POLL_INTERVAL = 5000;
  const MAX_POLL_TIME = 300000; // compositions can take a few minutes

  const label = identity || compositionSid;
  const meta = roomName ? `Room: ${roomName}` : 'video';

  recordingsStatus.textContent = 'Creating MP4...';
  recordingsStatus.classList.remove('hidden');
  recordingsList.innerHTML = `
    <li class="recording-item">
      <div class="recording-info">
        <span class="recording-name">${escapeHTML(label)}</span>
        <span class="recording-meta">${escapeHTML(meta)}</span>
      </div>
      <span class="recording-processing">Processing&hellip;</span>
    </li>`;

  async function poll() {
    try {
      const comp = await fetchCompositionStatus(compositionSid);

      if (comp.status === 'completed' && !compositionUploading) {
        compositionUploading = true;
        recordingsList.innerHTML = `
          <li class="recording-item">
            <div class="recording-info">
              <span class="recording-name">${escapeHTML(label)}</span>
              <span class="recording-meta">${escapeHTML(meta)}</span>
            </div>
            <span class="recording-uploading">Uploading&hellip;</span>
          </li>`;

        uploadComposition(compositionSid, identity, roomName)
          .then(() => {
            compositionUploading = false;
            stopPolling();
            identityInput.value = '';
            roomInput.value = '';
            loadAllVideos();
          })
          .catch((err) => {
            compositionUploading = false;
            console.error('Composition upload failed:', err);
            setStatus('Upload failed: ' + err.message, 'error');
          });

        return; // stop polling — upload in progress
      }

      if (comp.status === 'failed' || comp.status === 'deleted') {
        stopPolling();
        setStatus('Composition failed: ' + comp.status, 'error');
        return;
      }
    } catch (err) {
      console.error('Composition polling error:', err);
    }

    elapsed += POLL_INTERVAL;
    if (elapsed >= MAX_POLL_TIME) {
      stopPolling();
      return;
    }

    pollTimeout = setTimeout(poll, POLL_INTERVAL);
  }

  poll();
}

function stopPolling() {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

async function flipCamera() {
  if (!currentRoom) return;
  flipBtn.disabled = true;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    if (videoDevices.length < 2) {
      setStatus('No second camera detected.', 'error');
      return;
    }

    const currentPub = [...currentRoom.localParticipant.videoTracks.values()][0];
    if (!currentDeviceId && currentPub) {
      currentDeviceId = currentPub.track.mediaStreamTrack.getSettings().deviceId;
    }

    const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
    const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];

    const newTrack = await Twilio.Video.createLocalVideoTrack({
      deviceId: { exact: nextDevice.deviceId },
    });

    if (currentPub) {
      currentRoom.localParticipant.unpublishTrack(currentPub.track);
      currentPub.track.stop();
    }

    await currentRoom.localParticipant.publishTrack(newTrack);
    localVideo.querySelectorAll('video').forEach((el) => el.remove());
    localVideo.appendChild(newTrack.attach());
    currentDeviceId = nextDevice.deviceId;
  } catch (err) {
    console.error('Camera flip error:', err);
    setStatus('Could not switch camera: ' + err.message, 'error');
  } finally {
    flipBtn.disabled = false;
  }
}

// ===== Event Listeners =====

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  startVideo();
});

stopBtn.addEventListener('click', () => stopVideo());
flipBtn.addEventListener('click', () => flipCamera());

// Event delegation for View and SMS buttons (list is rebuilt on every render)
recordingsList.addEventListener('click', (e) => {
  const viewBtn = e.target.closest('[data-view-url]');
  if (viewBtn) return openVideoModal(viewBtn.dataset.viewUrl, viewBtn.dataset.viewTitle);

  const smsBtn = e.target.closest('[data-sms-url]');
  if (smsBtn) return openSmsModal(smsBtn.dataset.smsUrl, smsBtn.dataset.smsName);
});

document.querySelector('.modal-close-btn').addEventListener('click', closeVideoModal);
document.querySelector('.sms-modal-close-btn').addEventListener('click', closeSmsModal);

smsSendBtn.addEventListener('click', sendSms);

smsPhoneInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendSms();
});

videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) closeVideoModal();
});

smsModal.addEventListener('click', (e) => {
  if (e.target === smsModal) closeSmsModal();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeVideoModal();
    closeSmsModal();
  }
});

window.addEventListener('beforeunload', () => {
  if (currentRoom) currentRoom.disconnect();
  stopPolling();
});
