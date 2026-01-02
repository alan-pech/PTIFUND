/**
 * Project Timothy Fund Uganda - Blog App
 * Version: v1.0.001
 * Description: Core application logic for SPA routing, Supabase integration, 
 * audio recording, and admin/consumer interfaces.
 */

// --- Constants & State ---
const APP_VERSION = 'v1.0.008';
const ADMIN_ROUTE_SECRET = 'admin-portal'; // Accessible via index.html#admin-portal

let currentUser = null;
let currentView = 'home';
let r2Client = null;
let S3SDK = null;

// --- S3 / R2 Initialization ---
async function ensureS3SDK() {
    if (S3SDK) return S3SDK;
    console.log('[R2] Loading AWS SDK v3 via ESM...');
    try {
        S3SDK = await import("https://esm.sh/@aws-sdk/client-s3@3.525.0?bundle&target=browser");
        return S3SDK;
    } catch (err) {
        console.error('[R2] Failed to load AWS SDK:', err);
        throw err;
    }
}

async function initR2Client() {
    try {
        const { S3Client } = await ensureS3SDK();
        r2Client = new S3Client({
            region: "auto",
            endpoint: R2_CONFIG.endpoint,
            credentials: {
                accessKeyId: R2_CONFIG.accessKeyId,
                secretAccessKey: R2_CONFIG.secretAccessKey,
            },
        });
        console.log('[R2] Storage client initialized');
    } catch (err) {
        console.error('[R2] Failed to initialize storage client:', err);
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`[${new Date().toISOString()}] App initializing version ${APP_VERSION}`);
    initRouting();
    initAuth();
    initR2Client();
    updateVersionDisplay();
});

// --- Routing ---
function initRouting() {
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Handle initial load
}

function handleRouteChange() {
    const hash = window.location.hash.substring(1) || 'home';
    console.log(`[Navigation] Hash changed to: ${hash}`);

    // Update navigation active state
    updateNavActiveState(hash);

    // Route logic
    if (hash === 'home') {
        showView('home-view');
        loadLatestPost();
    } else if (hash === 'archive') {
        showView('archive-view');
        loadArchive();
    } else if (hash.startsWith('post/')) {
        const postId = hash.split('/')[1];
        showView('post-view');
        loadPostDetails(postId);
    } else if (hash === ADMIN_ROUTE_SECRET) {
        handleAdminAccess();
    } else if (hash.startsWith('admin/')) {
        checkAdminAuth(() => handleAdminRoutes(hash));
    } else {
        console.warn(`[Routing] Unrecognized route: ${hash}. Redircting home.`);
        window.location.hash = '#home';
    }
}

function updateNavActiveState(hash) {
    // Remove active class from all nav links
    document.querySelectorAll('#main-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to current link
    if (hash === 'home' || hash === '') {
        const homeLink = document.querySelector('#main-nav a[href="#home"]');
        if (homeLink) homeLink.classList.add('active');
    } else if (hash === 'archive') {
        const archiveLink = document.querySelector('#main-nav a[href="#archive"]');
        if (archiveLink) archiveLink.classList.add('active');
    }
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
        currentView = viewId;
    }
}

// --- Authentication ---
async function initAuth() {
    // Sync setup
    updateAdminNavUI();

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        console.log(`[Auth] State changed: ${event}`, currentUser?.email);
        updateAdminNavUI();

        // If logged in from the portal page, redirect to dashboard
        if (event === 'SIGNED_IN' && window.location.hash === `#${ADMIN_ROUTE_SECRET}`) {
            window.location.hash = '#admin/posts';
        }

        // If logged out from an admin page, redirect home
        if (event === 'SIGNED_OUT' && window.location.hash.startsWith('#admin/')) {
            window.location.hash = '#home';
        }
    });

    // Handle Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            console.log(`[Auth] Attempting login for ${email}`);
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                alert(`Login failed: ${error.message}`);
            } else {
                console.log('[Auth] Login successful');
                // Redirect directly to the dashboard
                window.location.hash = '#admin/posts';
            }
        });
    }

    // Handle Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.hash = '#home';
        });
    }
}

function handleAdminAccess() {
    if (currentUser) {
        window.location.hash = '#admin/posts';
    } else {
        showView('admin-login-view');
    }
}

function checkAdminAuth(callback) {
    if (!currentUser) {
        console.warn('[Auth] Attempted admin access without session.');
        window.location.hash = `#${ADMIN_ROUTE_SECRET}`;
    } else {
        callback();
    }
}

function updateAdminNavUI() {
    const container = document.getElementById('admin-link-container');
    if (currentUser) {
        container.innerHTML = `<a href="#admin/posts" class="nav-link admin-active">Admin Dashboard</a>`;
    } else {
        container.innerHTML = '';
    }
}

// --- Admin Features ---
function handleAdminRoutes(hash) {
    showView('admin-dashboard-view');
    const subRoute = hash.split('/')[1];
    const adminContent = document.getElementById('admin-content');

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        const route = item.getAttribute('data-route');
        if (route === subRoute) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Bind logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabaseClient.auth.signOut();
            window.location.hash = '#home';
        };
    }

    switch (subRoute) {
        case 'posts':
            renderAdminPosts(adminContent);
            break;
        case 'edit':
            const postId = hash.split('/')[2];
            renderAdminEditGallery(adminContent, postId);
            break;
        case 'subscribers':
            renderAdminSubscribers(adminContent);
            break;
        case 'comments':
            renderAdminComments(adminContent);
            break;
        default:
            window.location.hash = '#admin/posts';
    }
}

// --- UI Helpers ---
function updateVersionDisplay() {
    const displays = document.querySelectorAll('.version');
    displays.forEach(el => el.textContent = APP_VERSION);
}

// --- Consumer Content Loading ---
async function loadLatestPost() {
    const container = document.getElementById('latest-post-container');
    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !posts.length) {
        container.innerHTML = '<p>No updates found.</p>';
        return;
    }

    const post = posts[0];
    const { data: slides } = await supabaseClient.from('slides').select('*').eq('post_id', post.id).order('order_index');

    container.innerHTML = `
        <div class="post-with-sidebar">
            <aside class="slides-thumbnail-sidebar">
                ${slides.map((slide, index) => `
                    <div class="thumbnail-item" data-slide-index="${index}" onclick="scrollToSlide(${index})">
                        Page ${index + 1}
                    </div>
                `).join('')}
            </aside>
            <article class="post-detail">
                <div class="slides-stack">
                    ${slides.map((slide, index) => `
                        <div class="slide-card" data-slide-index="${index}">
                            <img src="${slide.image_url}" class="slide-image" loading="lazy">
                            ${slide.audio_url ? `
                                <div class="audio-wrapper">
                                    <audio controls src="${slide.audio_url}"></audio>
                                </div>
                            ` : ''}
                            ${slide.video_url ? `
                                <div class="video-detail">
                                    <video class="video-js vjs-big-play-centered vjs-theme-city" controls preload="auto" width="640" height="360">
                                        <source src="${slide.video_url}" type="video/mp4">
                                        <p class="vjs-no-js">
                                            To view this video please enable JavaScript, and consider upgrading to a web browser that
                                            <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
                                        </p>
                                    </video>
                                    ${slide.video_description ? `<div class="video-description">${slide.video_description}</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </article>
        </div>
    `;

    loadComments(post.id);
    initVideoPlayers();
}

async function loadArchive() {
    const grid = document.getElementById('archive-grid');
    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        return;
    }

    grid.innerHTML = posts.map(post => `
        <div class="archive-card" onclick="window.location.hash = '#post/${post.id}'">
            <h4>${post.title}</h4>
            <p>${new Date(post.created_at).toLocaleDateString()}</p>
        </div>
    `).join('');
}

async function loadPostDetails(id) {
    const content = document.getElementById('post-content');
    content.innerHTML = '<div class="loader">Loading slides...</div>';

    // Fetch post and slides
    const { data: post } = await supabaseClient.from('posts').select('*').eq('id', id).single();
    const { data: slides } = await supabaseClient.from('slides').select('*').eq('post_id', id).order('order_index');

    if (!post) return;

    content.innerHTML = `
        <div class="post-with-sidebar">
            <aside class="slides-thumbnail-sidebar">
                ${slides.map((slide, index) => `
                    <div class="thumbnail-item" data-slide-index="${index}" onclick="scrollToSlide(${index})">
                        Page ${index + 1}
                    </div>
                `).join('')}
            </aside>
            <article class="post-detail">
                <div class="slides-stack">
                    ${slides.map((slide, index) => `
                        <div class="slide-card" data-slide-index="${index}">
                            <img src="${slide.image_url}" class="slide-image" loading="lazy">
                            ${slide.audio_url ? `
                                <div class="audio-wrapper">
                                    <audio controls src="${slide.audio_url}"></audio>
                                </div>
                            ` : ''}
                            ${slide.video_url ? `
                                <div class="video-detail">
                                    <video class="video-js vjs-big-play-centered vjs-theme-city" controls preload="auto" width="640" height="360">
                                        <source src="${slide.video_url}" type="video/mp4">
                                        <p class="vjs-no-js">
                                            To view this video please enable JavaScript, and consider upgrading to a web browser that
                                            <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
                                        </p>
                                    </video>
                                    ${slide.video_description ? `<div class="video-description">${slide.video_description}</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </article>
        </div>
    `;

    loadComments(id);
    initVideoPlayers();

    // If admin is viewing, allow editing/audio tagging
    if (currentUser) {
        attachAdminControlsToSlides(slides);
    }
}

// Scroll to specific slide
function scrollToSlide(index) {
    const slideCard = document.querySelector(`.slide-card[data-slide-index="${index}"]`);
    if (slideCard) {
        // Use scrollIntoView with smooth behavior. 
        // The offset is handled by scroll-margin-top in CSS.
        slideCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Highlight active thumbnail
        document.querySelectorAll('.thumbnail-item').forEach(item => {
            item.classList.remove('active');
        });
        const thumbnail = document.querySelector(`.thumbnail-item[data-slide-index="${index}"]`);
        if (thumbnail) {
            thumbnail.classList.add('active');
        }
    }
}

// --- Admin Features ---
async function renderAdminPosts(container) {
    container.innerHTML = `
        <div class="admin-header-row">
            <div class="header-left">
                <h1>Manage Posts</h1>
            </div>
            <button id="btn-new-post" class="btn btn-primary">+ New Post</button>
        </div>
        
        <div class="card">
            <div id="admin-posts-list" class="admin-list">
                <div class="loader">Loading posts...</div>
            </div>
        </div>
        
        <!-- New Post Modal (Hidden) -->
        <div id="modal-new-post" class="modal hidden">
            <div class="modal-content card">
                <h3>Create New Post</h3>
                <div class="input-group">
                    <label>Post Title</label>
                    <input type="text" id="new-post-title" placeholder="e.g. February 2026 Update">
                </div>
                
                <div class="upload-zone" id="upload-zone">
                    <p>📁 Click to select folder of PNG images</p>
                    <input type="file" id="folder-input" webkitdirectory directory multiple hidden>
                </div>
                
                <div id="upload-preview" class="upload-preview grid"></div>
                
                <div class="modal-actions">
                    <button class="btn btn-text" id="btn-cancel-post">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-post">Create Post & Upload</button>
                </div>
            </div>
        </div>
    `;

    // Bind events
    document.getElementById('btn-new-post').onclick = () => {
        document.getElementById('modal-new-post').classList.remove('hidden');
    };
    document.getElementById('btn-cancel-post').onclick = () => {
        document.getElementById('modal-new-post').classList.add('hidden');
    };

    const uploadZone = document.getElementById('upload-zone');
    const folderInput = document.getElementById('folder-input');
    const btnSave = document.getElementById('btn-save-post');
    const titleInput = document.getElementById('new-post-title');

    uploadZone.onclick = () => folderInput.click();

    folderInput.onchange = (e) => {
        const files = Array.from(e.target.files).filter(f => f.type === 'image/png');
        renderUploadPreview(files);
    };

    btnSave.onclick = async () => {
        const title = titleInput.value;
        const files = Array.from(folderInput.files).filter(f => f.type === 'image/png');

        if (!title || files.length === 0) {
            alert('Please provide a title and select a folder with PNGs.');
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Uploading...';

        try {
            await createPostWithSlides(title, files);
            document.getElementById('modal-new-post').classList.add('hidden');
            loadAdminPosts();
        } catch (err) {
            alert(`Upload failed: ${err.message}`);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Create Post & Upload';
        }
    };

    loadAdminPosts();
}

// --- Bulk Upload Logic ---
async function createPostWithSlides(title, files) {
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    // 1. Create Post Entry
    const { data: post, error: postErr } = await supabaseClient
        .from('posts')
        .insert([{ title, slug }])
        .select()
        .single();

    if (postErr) throw postErr;

    // 2. Upload Images and Create Slides
    console.log(`[Upload] Starting upload for ${files.length} images...`);

    // Sort files by name to maintain order
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${post.id}/slide_${i}_${Date.now()}.png`;

        const { PutObjectCommand } = await ensureS3SDK();
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_CONFIG.bucketName,
            Key: filePath,
            Body: file,
            ContentType: file.type
        }));

        const publicUrl = `${R2_CONFIG.publicUrl}/${filePath}`;

        await supabaseClient.from('slides').insert([{
            post_id: post.id,
            image_url: publicUrl,
            order_index: i
        }]);

        console.log(`[Upload] Slide ${i + 1}/${files.length} uploaded to R2.`);
    }
}

// --- Audio Recording Logic (Pro Modal with Visualization) ---
let audioRecorder = {
    recorder: null,
    chunks: [],
    stream: null,
    audioCtx: null,
    analyser: null,
    animationId: null,
    startTime: 0,
    timerInterval: null,
    targetSlideId: null
};

async function openAudioRecorder(slideId) {
    audioRecorder.targetSlideId = slideId;
    const modal = document.getElementById('modal-audio-recorder');
    modal.classList.remove('hidden');

    resetRecorderUI();

    // Bind buttons
    document.getElementById('btn-start-record').onclick = startCapture;
    document.getElementById('btn-stop-record').onclick = stopCapture;
    document.getElementById('btn-save-record').onclick = saveAndUploadAudio;
    document.getElementById('btn-cancel-record').onclick = closeAudioRecorder;
}

function closeAudioRecorder() {
    stopCapture();
    document.getElementById('modal-audio-recorder').classList.add('hidden');
    if (audioRecorder.stream) {
        audioRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

function resetRecorderUI() {
    document.getElementById('btn-start-record').classList.remove('hidden');
    document.getElementById('btn-stop-record').classList.add('hidden');
    document.getElementById('btn-save-record').classList.add('hidden');
    document.getElementById('recording-timer').textContent = '00:00';
    clearWaveform();
}

async function startCapture() {
    try {
        console.log('[Audio] Requesting microphone access...');
        audioRecorder.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup MediaRecorder with appropriate mime type
        const options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            options.mimeType = 'audio/mp4';
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = '';
        }

        audioRecorder.recorder = new MediaRecorder(audioRecorder.stream, options);
        audioRecorder.chunks = [];

        audioRecorder.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioRecorder.chunks.push(e.data);
                console.log('[Audio] Data chunk received:', e.data.size, 'bytes');
            }
        };

        // Initialize visualizer before starting recording
        initVisualizer(audioRecorder.stream);

        audioRecorder.recorder.start(100); // Collect data every 100ms
        audioRecorder.startTime = Date.now();
        audioRecorder.timerInterval = setInterval(updateTimer, 1000);

        document.getElementById('btn-start-record').classList.add('hidden');
        document.getElementById('btn-stop-record').classList.remove('hidden');

        console.log('[Audio] Recording started with mimeType:', options.mimeType);
    } catch (err) {
        console.error('[Audio] Capture failed:', err);
        let msg = 'Microphone access denied or not available.';
        if (err.name === 'NotAllowedError') msg = 'Microphone permission was denied. Please allow it in your browser settings.';
        else if (err.name === 'NotFoundError') msg = 'No microphone was found on this device.';
        else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            msg = 'Audio recording requires a secure connection (HTTPS).';
        }
        alert(msg + '\n\nDebug: ' + err.message);
    }
}

function stopCapture() {
    if (audioRecorder.recorder && audioRecorder.recorder.state === 'recording') {
        audioRecorder.recorder.stop();
        clearInterval(audioRecorder.timerInterval);
        cancelAnimationFrame(audioRecorder.animationId);

        document.getElementById('btn-stop-record').classList.add('hidden');
        document.getElementById('btn-save-record').classList.remove('hidden');

        console.log('[Audio] Capture stopped');
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - audioRecorder.startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('recording-timer').textContent = `${m}:${s}`;
}

function initVisualizer(stream) {
    if (!audioRecorder.audioCtx) {
        audioRecorder.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume if suspended
    if (audioRecorder.audioCtx.state === 'suspended') {
        audioRecorder.audioCtx.resume();
    }

    const source = audioRecorder.audioCtx.createMediaStreamSource(stream);
    audioRecorder.analyser = audioRecorder.audioCtx.createAnalyser();
    audioRecorder.analyser.fftSize = 2048;
    audioRecorder.analyser.smoothingTimeConstant = 0.8;
    source.connect(audioRecorder.analyser);

    drawWaveform();
}

function drawWaveform() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    const bufferLength = audioRecorder.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
        audioRecorder.animationId = requestAnimationFrame(render);
        audioRecorder.analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#D35400';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    };
    render();
}

function clearWaveform() {
    const canvas = document.getElementById('waveform');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function saveAndUploadAudio() {
    if (audioRecorder.chunks.length === 0) {
        alert('No audio data recorded. Please try recording again.');
        return;
    }

    console.log('[Audio] Total chunks:', audioRecorder.chunks.length);

    // Use the appropriate mime type for the blob
    const mimeType = audioRecorder.recorder.mimeType || 'audio/webm';
    const blob = new Blob(audioRecorder.chunks, { type: mimeType });
    console.log('[Audio] Blob created:', blob.size, 'bytes, type:', blob.type);

    const btnSave = document.getElementById('btn-save-record');
    btnSave.textContent = 'Uploading...';
    btnSave.disabled = true;

    try {
        const publicUrl = await uploadAudio(audioRecorder.targetSlideId, blob);

        // Immediate UI Update
        const item = document.querySelector(`.gallery-item[data-id="${audioRecorder.targetSlideId}"]`);
        if (item) {
            item.dataset.audio = publicUrl;
            if (!item.querySelector('.audio-badge')) {
                const icon = document.createElement('div');
                icon.className = 'audio-badge';
                icon.textContent = '♪';
                item.appendChild(icon);
            }
        }

        closeAudioRecorder();
        alert('Audio tagged successfully!');
    } catch (err) {
        alert('Upload failed: ' + err.message);
    } finally {
        btnSave.textContent = 'Save & Upload';
        btnSave.disabled = false;
    }
}

async function uploadAudio(slideId, blob) {
    // Determine file extension based on blob type
    let extension = 'webm';
    if (blob.type.includes('mp4')) {
        extension = 'mp4';
    } else if (blob.type.includes('ogg')) {
        extension = 'ogg';
    }

    const filePath = `audio/${slideId}_${Date.now()}.${extension}`;
    console.log('[Audio] Uploading to R2:', filePath, 'Size:', blob.size);

    const { PutObjectCommand } = await ensureS3SDK();
    await r2Client.send(new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filePath,
        Body: blob,
        ContentType: blob.type
    }));

    const publicUrl = `${R2_CONFIG.publicUrl}/${filePath}`;
    console.log('[Audio] Uploaded successfully to R2:', publicUrl);

    const { error: dbErr } = await supabaseClient
        .from('slides')
        .update({ audio_url: publicUrl })
        .eq('id', slideId);

    if (dbErr) throw dbErr;
    return publicUrl;
}

async function deleteAudio(slideId, audioUrl) {
    if (!confirm('Are you sure you want to delete this audio recording?')) return;

    try {
        // 1. Storage Cleanup (R2)
        if (audioUrl) {
            const path = audioUrl.split(`${R2_CONFIG.publicUrl}/`).pop();
            const { DeleteObjectCommand } = await ensureS3SDK();
            await r2Client.send(new DeleteObjectCommand({
                Bucket: R2_CONFIG.bucketName,
                Key: path
            }));
            console.log('[R2] Audio deleted from storage:', path);
        }

        // 2. Database Update
        await supabaseClient.from('slides').update({ audio_url: null }).eq('id', slideId);

        // 3. Immediate UI Update
        const item = document.querySelector(`.gallery-item[data-id="${slideId}"]`);
        if (item) {
            item.dataset.audio = '';
            const icon = item.querySelector('.audio-badge');
            if (icon) icon.remove();
        }

        alert('Audio deleted successfully.');
    } catch (err) {
        alert('Failed to delete audio: ' + err.message);
    }
}

// --- Subscriber Management Logic ---
async function renderAdminSubscribers(container) {
    container.innerHTML = `
        <div class="admin-header-row">
            <div class="header-left">
                <h1>Supporters</h1>
            </div>
            <button id="btn-new-sub" class="btn btn-primary">+ Add Supporter</button>
        </div>
        
        <div class="card">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="subscribers-tbody">
                    <tr><td colspan="4">Loading supporters...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    loadAdminSubscribers();

    document.getElementById('btn-new-sub').onclick = async () => {
        const name = prompt('Enter Supporter Name:');
        const email = prompt('Enter Supporter Email:');
        if (name && email) {
            await supabaseClient.from('subscribers').insert([{ name, email }]);
            loadAdminSubscribers();
        }
    };
}

async function loadAdminSubscribers() {
    const tbody = document.getElementById('subscribers-tbody');
    const { data: subs, error } = await supabaseClient.from('subscribers').select('*').order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
        return;
    }

    if (subs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">No supporters found.</td></tr>`;
        return;
    }

    tbody.innerHTML = subs.map(sub => `
        <tr>
            <td><strong>${sub.name}</strong></td>
            <td>${sub.email}</td>
            <td>${new Date(sub.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-text delete" onclick="deleteSubscriber('${sub.id}')">Remove</button>
            </td>
        </tr>
    `).join('');
}

async function deleteSubscriber(id) {
    if (confirm('Are you sure?')) {
        await supabaseClient.from('subscribers').delete().eq('id', id);
        loadAdminSubscribers();
    }
}

// --- Interaction Branding: Context Menu ---
function attachAdminControlsToSlides(slides) {
    const slideCards = document.querySelectorAll('.slide-card');
    slideCards.forEach((card, index) => {
        const slide = slides[index];
        card.oncontextmenu = (e) => {
            e.preventDefault();
            showContextMenu(e.pageX, e.pageY, slide);
        };
    });
}

function showContextMenu(x, y, slide) {
    // Remove existing menu
    const existing = document.getElementById('custom-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.className = 'context-menu';
    menu.style.top = `${y}px`;
    menu.style.left = `${x}px`;

    const hasAudio = !!slide.audio_url && slide.audio_url !== '';
    const hasVideo = !!slide.video_url && slide.video_url !== '';

    menu.innerHTML = `
        <div class="menu-item" id="menu-record-action">
            ${hasAudio ? '🗑️ Delete Recorded Audio' : '🎙️ Record Audio'}
        </div>
        <div class="menu-item" id="menu-video-action">
            🎥 ${hasVideo ? 'Edit' : 'Add'} Video
        </div>
        <div class="menu-item delete" id="menu-delete-slide">🗑️ Delete Slide</div>
    `;

    document.body.appendChild(menu);

    // Bind item events
    document.getElementById('menu-record-action').onclick = () => {
        if (hasAudio) {
            deleteAudio(slide.id, slide.audio_url);
        } else {
            openAudioRecorder(slide.id);
        }
        menu.remove();
    };

    document.getElementById('menu-video-action').onclick = () => {
        openVideoUploader(slide);
        menu.remove();
    };

    document.getElementById('menu-delete-slide').onclick = () => {
        deleteSlide(slide.id);
        menu.remove();
    };

    // Close on click elsewhere
    document.addEventListener('click', () => menu.remove(), { once: true });
}


async function deleteSlide(slideId) {
    if (!confirm('Are you sure you want to delete this slide?')) return;

    try {
        const { error } = await supabaseClient.from('slides').delete().eq('id', slideId);
        if (error) throw error;

        // Immediate UI Update
        const item = document.querySelector(`.gallery-item[data-id="${slideId}"]`);
        if (item) item.remove();

        // Re-number badges
        const items = [...document.querySelectorAll('.gallery-item')];
        items.forEach((item, index) => {
            const badge = item.querySelector('.slide-badge');
            if (badge) badge.textContent = index + 1;
        });

        console.log('[Gallery] Slide deleted and UI updated.');
    } catch (err) {
        alert('Failed to delete slide: ' + err.message);
    }
}

// --- Comment Moderation Logic ---
async function renderAdminComments(container) {
    container.innerHTML = `
        <div class="admin-header-row">
            <div class="header-left">
                <h1>Moderation</h1>
            </div>
        </div>
        
        <div id="comments-queue" class="comments-moderation-grid">
            <div class="loader">Loading pending comments...</div>
        </div>
    `;

    loadAdminComments();
}

async function loadAdminComments() {
    const queue = document.getElementById('comments-queue');
    const { data: comments, error } = await supabaseClient
        .from('comments')
        .select('*, posts(title)')
        .eq('status', 'pending');

    if (error) {
        queue.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        return;
    }

    if (comments.length === 0) {
        queue.innerHTML = '<div class="card"><p>No pending comments in the queue.</p></div>';
        return;
    }

    queue.innerHTML = comments.map(c => `
        <div class="card moderation-card">
            <div class="comment-meta">
                <strong>${c.author_name}</strong> on <em>${c.posts.title}</em>
            </div>
            <p class="comment-body">${c.comment_text}</p>
            <div class="actions">
                <button class="btn btn-primary" onclick="moderateComment('${c.id}', 'approved')">Approve</button>
                <button class="btn btn-text delete" onclick="moderateComment('${c.id}', 'deleted')">Deny</button>
            </div>
        </div>
    `).join('');
}

async function moderateComment(id, status) {
    const { error } = await supabaseClient
        .from('comments')
        .update({ status })
        .eq('id', id);

    if (error) alert(`Error: ${error.message}`);
    else loadAdminComments();
}

async function loadComments(postId) {
    const list = document.getElementById('comments-list');
    const { data: comments } = await supabaseClient
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

    list.innerHTML = (comments || []).map(c => `
        <div class="user-comment">
            <strong>${c.author_name}</strong>
            <p>${c.comment_text}</p>
        </div>
    `).join('');

    // Handle submission
    const form = document.getElementById('comment-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const author = document.getElementById('comment-author').value;
        const text = document.getElementById('comment-text').value;

        await supabaseClient.from('comments').insert([{
            post_id: postId,
            author_name: author,
            comment_text: text
        }]);

        form.reset();
        alert('Your comment has been submitted for moderation.');
    };
}
async function loadAdminPosts() {
    const list = document.getElementById('admin-posts-list');
    const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = `<p class="error">Error loading posts: ${error.message}</p>`;
        return;
    }

    if (posts.length === 0) {
        list.innerHTML = '<p>No posts yet. Create your first one!</p>';
        return;
    }

    list.innerHTML = posts.map(post => `
        <div class="post-item-row">
            <span class="post-title">${post.title}</span>
            <span class="post-date">${new Date(post.created_at).toLocaleDateString()}</span>
            <div class="actions">
                <button class="btn btn-text" onclick="window.location.hash='#admin/edit/${post.id}'">Edit Gallery</button>
                <button class="btn btn-text" onclick="sendBroadcast('${post.id}')">Email</button>
                <button class="btn btn-text delete" onclick="deletePost('${post.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

async function renderAdminEditGallery(container, postId) {
    const { data: post } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
    const { data: slides } = await supabaseClient.from('slides').select('*').eq('post_id', postId).order('order_index');

    container.innerHTML = `
        <div class="admin-header-row">
            <div class="header-left">
                <button class="btn btn-text" onclick="window.location.hash='#admin/posts'">← Back</button>
                <h1>Edit Post</h1>
            </div>
            <div class="toggle-group">
                <button class="btn btn-primary active">Gallery</button>
                <button class="btn" disabled>List</button>
            </div>
        </div>

        <div class="card">
            <h3>Post Title</h3>
            <div class="input-row">
                <input type="text" id="edit-post-title" value="${post.title}" placeholder="Enter post title">
                <button class="btn btn-secondary" onclick="updatePostTitle('${post.id}')">Update Title</button>
            </div>
        </div>

        <div class="manage-slides-section">
            <div class="section-header">
                <h2>Manage Slides</h2>
                <p class="help-text">Drag slides to reorder. Right-click on a slide to see options.</p>
            </div>
            
            <div id="gallery-container" class="slides-grid">
                ${(slides || []).map(slide => `
                    <div class="slide-card-wrapper">
                        <div class="gallery-item" draggable="true" data-id="${slide.id}" data-image="${slide.image_url}" data-audio="${slide.audio_url || ''}" data-video="${slide.video_url || ''}" data-video-description="${slide.video_description || ''}">
                            <img src="${slide.image_url}" loading="lazy">
                            ${slide.audio_url ? '<div class="audio-badge">♪</div>' : ''}
                            ${slide.video_url ? '<div class="video-badge">🎥</div>' : ''}
                        </div>
                        <div class="slide-label">Slide ${slide.order_index + 1}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="card">
            <h3>Add More Slides</h3>
            <div class="upload-zone" onclick="document.getElementById('slide-files').click()">
                <input type="file" id="slide-files" multiple accept="image/*" style="display: none;" onchange="uploadNewSlides('${post.id}')">
                <p>📁 Click to choose files or drag and drop here</p>
            </div>
            <div id="upload-status" style="margin-top: 1rem; color: var(--color-orange); font-weight: 500;"></div>
        </div>
    `;

    initDragAndDrop(postId);
}

async function updatePostTitle(postId) {
    const newTitle = document.getElementById('edit-post-title').value;
    if (!newTitle.trim()) return alert('Title cannot be empty');

    const { error } = await supabaseClient.from('posts').update({ title: newTitle }).eq('id', postId);
    if (!error) alert('Title updated successfully!');
    else alert('Error updating title: ' + error.message);
}

function initDragAndDrop(postId) {
    const gallery = document.getElementById('gallery-container');
    let draggedWrapper = null;

    gallery.addEventListener('dragstart', (e) => {
        const galleryItem = e.target.closest('.gallery-item');
        if (!galleryItem) return;

        draggedWrapper = galleryItem.closest('.slide-card-wrapper');
        if (draggedWrapper) {
            draggedWrapper.classList.add('dragging');
            galleryItem.classList.add('dragging');
        }
    });

    gallery.addEventListener('dragend', (e) => {
        if (!draggedWrapper) return;
        draggedWrapper.classList.remove('dragging');
        draggedWrapper.querySelector('.gallery-item')?.classList.remove('dragging');
        updateSlideOrder(postId);
        draggedWrapper = null;
    });

    gallery.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedWrapper) return;

        const afterElement = getDragAfterElement(gallery, e.clientX, e.clientY);
        if (afterElement == null) {
            gallery.appendChild(draggedWrapper);
        } else {
            gallery.insertBefore(draggedWrapper, afterElement);
        }
    });

    // Event Delegation for Context Menu
    gallery.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
            e.preventDefault();
            const slide = {
                id: item.dataset.id,
                image_url: item.dataset.image,
                audio_url: item.dataset.audio || null,
                video_url: item.dataset.video || null,
                video_description: item.dataset.videoDescription || null
            };
            showContextMenu(e.pageX, e.pageY, slide, postId);
        }
    });
}

function getDragAfterElement(container, x, y) {
    const draggableWrappers = [...container.querySelectorAll('.slide-card-wrapper:not(.dragging)')];

    return draggableWrappers.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

        if (distance < closest.offset) {
            return { offset: distance, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.POSITIVE_INFINITY }).element;
}

async function updateSlideOrder(postId) {
    const items = [...document.querySelectorAll('.gallery-item')];
    console.log('[Gallery] Updating order for ' + items.length + ' slides...');

    const updates = items.map((item, index) => ({
        id: item.dataset.id,
        order_index: index
    }));

    // Perform individual updates
    for (const update of updates) {
        await supabaseClient.from('slides').update({ order_index: update.order_index }).eq('id', update.id);
    }

    // Refresh UI
    renderAdminEditGallery(document.getElementById('admin-content'), postId);
}

async function uploadNewSlides(postId) {
    const fileInput = document.getElementById('slide-files');
    const files = fileInput.files;
    if (files.length === 0) return;

    const statusDiv = document.getElementById('upload-status');
    statusDiv.textContent = `Uploading ${files.length} slide(s)...`;

    try {
        // Get current max order
        const { data: slides } = await supabaseClient.from('slides').select('order_index').eq('post_id', postId).order('order_index', { ascending: false }).limit(1);
        let nextIndex = slides.length > 0 ? slides[0].order_index + 1 : 0;

        for (const file of files) {
            const fileName = `${postId}_${Date.now()}_${file.name}`;
            const filePath = `${postId}/slide_${nextIndex}_${Date.now()}.png`;

            const { PutObjectCommand } = await ensureS3SDK();
            await r2Client.send(new PutObjectCommand({
                Bucket: R2_CONFIG.bucketName,
                Key: filePath,
                Body: file,
                ContentType: file.type
            }));

            const imageUrl = `${R2_CONFIG.publicUrl}/${filePath}`;

            await supabaseClient.from('slides').insert({
                post_id: postId,
                image_url: imageUrl,
                order_index: nextIndex++
            });
        }

        statusDiv.textContent = `✓ ${files.length} slide(s) uploaded successfully!`;
        setTimeout(() => {
            renderAdminEditGallery(document.getElementById('admin-content'), postId);
        }, 500);
    } catch (err) {
        console.error('Upload error:', err);
        statusDiv.textContent = `✗ Upload failed: ${err.message}`;
        statusDiv.style.color = '#e74c3c';
    } finally {
        fileInput.value = '';
    }
}


function renderUploadPreview(files) {
    const preview = document.getElementById('upload-preview');
    preview.innerHTML = files.map(file => `
        <div class="preview-thumb">
            <img src="${URL.createObjectURL(file)}">
            <span>${file.name}</span>
        </div>
    `).join('');
}

// --- Email Broadcast Logic ---
async function sendBroadcast(postId) {
    if (!confirm('Send this post as an email broadcast to all subscribers?')) return;

    const { data: post } = await supabaseClient.from('posts').select('*').eq('id', postId).single();

    console.log('[Broadcast] Triggering email for: ' + post.title);

    try {
        const { data, error } = await supabaseClient.functions.invoke('send-batch-emails', {
            body: {
                postId: post.id,
                title: post.title,
                content: post.description || ''
            }
        });

        if (error) throw error;
        alert('Broadcast sent successfully to subscribers!');
    } catch (err) {
        console.error('[Broadcast] Failed:', err);
        alert('Failed to send broadcast: ' + err.message);
    }
}

// --- Cleanup & Maintenance ---
async function deletePost(id) {
    if (!confirm('Are you sure you want to delete this post? This will remove all slides and audio from storage.')) return;

    const { error } = await supabaseClient.from('posts').delete().eq('id', id);


    if (error) alert('Error: ' + error.message);
    else loadAdminPosts();
}

// --- Post Management ---

// --- Video Upload Logic ---
let currentVideoSlide = null;

async function openVideoUploader(slide) {
    currentVideoSlide = slide;
    const modal = document.getElementById('modal-video-uploader');
    const descriptionInput = document.getElementById('video-description');
    const btnDelete = document.getElementById('btn-delete-video');
    const statusDiv = document.getElementById('video-upload-status');

    // Reset UI
    descriptionInput.value = slide.video_description || '';
    statusDiv.textContent = '';
    document.getElementById('video-file-input').value = '';

    if (slide.video_url) {
        btnDelete.classList.remove('hidden');
    } else {
        btnDelete.classList.add('hidden');
    }

    modal.classList.remove('hidden');

    // Bind buttons
    document.getElementById('btn-cancel-video').onclick = () => modal.classList.add('hidden');
    document.getElementById('video-upload-zone').onclick = () => document.getElementById('video-file-input').click();

    btnDelete.onclick = async () => {
        if (confirm('Are you sure you want to remove the video from this slide?')) {
            await deleteVideo(slide.id, slide.video_url);
            modal.classList.add('hidden');
        }
    };

    document.getElementById('btn-save-video').onclick = async () => {
        const fileInput = document.getElementById('video-file-input');
        const description = descriptionInput.value;
        const file = fileInput.files[0];

        if (!file && !slide.video_url) {
            alert('Please select a video file.');
            return;
        }

        const btnSave = document.getElementById('btn-save-video');
        btnSave.disabled = true;
        btnSave.textContent = 'Processing...';

        try {
            let videoUrl = slide.video_url;

            if (file) {
                statusDiv.textContent = 'Uploading video to R2...';
                const filePath = `video/${slide.id}_${Date.now()}_${file.name}`;

                const { PutObjectCommand } = await ensureS3SDK();
                await r2Client.send(new PutObjectCommand({
                    Bucket: R2_CONFIG.bucketName,
                    Key: filePath,
                    Body: file,
                    ContentType: file.type
                }));

                videoUrl = `${R2_CONFIG.publicUrl}/${filePath}`;
            }

            statusDiv.textContent = 'Updating database...';
            const { error: dbErr } = await supabaseClient
                .from('slides')
                .update({
                    video_url: videoUrl,
                    video_description: description
                })
                .eq('id', slide.id);

            if (dbErr) throw dbErr;

            alert('Video updated successfully!');
            modal.classList.add('hidden');

            // Refresh current view to show changes
            if (window.location.hash.startsWith('#admin/edit/')) {
                const postId = window.location.hash.split('/')[2];
                renderAdminEditGallery(document.getElementById('admin-content'), postId);
            }
        } catch (err) {
            alert('Operation failed: ' + err.message);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Upload & Tag Slide';
        }
    };
}

async function deleteVideo(slideId, videoUrl) {
    try {
        // 1. Storage Cleanup (R2)
        if (videoUrl) {
            const path = videoUrl.split(`${R2_CONFIG.publicUrl}/`).pop();
            const { DeleteObjectCommand } = await ensureS3SDK();
            await r2Client.send(new DeleteObjectCommand({
                Bucket: R2_CONFIG.bucketName,
                Key: path
            }));
            console.log('[R2] Video deleted from storage:', path);
        }

        // 2. Database Update
        await supabaseClient.from('slides').update({
            video_url: null,
            video_description: null
        }).eq('id', slideId);

        alert('Video removed successfully.');

        // Refresh UI
        if (window.location.hash.startsWith('#admin/edit/')) {
            const postId = window.location.hash.split('/')[2];
            renderAdminEditGallery(document.getElementById('admin-content'), postId);
        }
    } catch (err) {
        alert('Failed to remove video: ' + err.message);
    }
}

// --- Video.js Integration ---
function initVideoPlayers() {
    // Look for all video-js elements and initialize them
    document.querySelectorAll('.video-js').forEach(videoEl => {
        // Avoid double initialization
        if (!videoEl.classList.contains('vjs-initialized')) {
            videojs(videoEl, {
                fluid: true,
                responsive: true,
                playbackRates: [0.5, 1, 1.5, 2]
            });
            videoEl.classList.add('vjs-initialized');
        }
    });
}
