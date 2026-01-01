/**
 * Project Timothy Fund Uganda - Blog App
 * Version: v1.0.001
 * Description: Core application logic for SPA routing, Supabase integration, 
 * audio recording, and admin/consumer interfaces.
 */

// --- Constants & State ---
const APP_VERSION = 'v1.0.002';
const ADMIN_ROUTE_SECRET = 'admin-portal'; // Accessible via index.html#admin-portal

let currentUser = null;
let currentView = 'home';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`[${new Date().toISOString()}] App initializing version ${APP_VERSION}`);
    initRouting();
    initAuth();
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
    const { data: posts, error } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !posts.length) {
        document.getElementById('latest-post-container').innerHTML = '<p>No updates found.</p>';
        return;
    }

    loadPostDetails(posts[0].id);
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
        <article class="post-detail">
            <h2>${post.title}</h2>
            <div class="slides-stack">
                ${slides.map(slide => `
                    <div class="slide-card">
                        <img src="${slide.image_url}" class="slide-image" loading="lazy">
                        ${slide.audio_url ? `
                            <div class="audio-wrapper">
                                <audio controls src="${slide.audio_url}"></audio>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </article>
    `;

    loadComments(id);

    // If admin is viewing, allow editing/audio tagging
    if (currentUser) {
        attachAdminControlsToSlides(slides);
    }
}

// --- Admin Features ---
async function renderAdminPosts(container) {
    container.innerHTML = `
        <div class="admin-header">
            <h2>Manage Blog Posts</h2>
            <button id="btn-new-post" class="btn btn-primary">+ New Post</button>
        </div>
        <div id="admin-posts-list" class="admin-list">
            <div class="loader">Loading posts...</div>
        </div>
        
        <!-- New Post Modal (Hidden) -->
        <div id="modal-new-post" class="modal hidden">
            <div class="modal-content">
                <h3>Create New Post</h3>
                <input type="text" id="new-post-title" placeholder="Post Title (e.g. June 2026 Update)">
                <div class="upload-zone" id="upload-zone">
                    <p>Click to select folder of PNG images</p>
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

    // Folder selection
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

        const { error: uploadErr } = await supabaseClient.storage
            .from('post-assets')
            .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabaseClient.storage.from('post-assets').getPublicUrl(filePath);

        await supabaseClient.from('slides').insert([{
            post_id: post.id,
            image_url: publicUrl,
            order_index: i
        }]);

        console.log(`[Upload] Slide ${i + 1}/${files.length} uploaded.`);
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

        // Ensure AudioContext is resumed (required by some browsers)
        if (!audioRecorder.audioCtx) {
            audioRecorder.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioRecorder.audioCtx.state === 'suspended') {
            await audioRecorder.audioCtx.resume();
        }

        audioRecorder.recorder = new MediaRecorder(audioRecorder.stream);
        audioRecorder.chunks = [];

        audioRecorder.recorder.ondataavailable = (e) => audioRecorder.chunks.push(e.data);

        // Visuals
        initVisualizer(audioRecorder.stream);

        audioRecorder.recorder.start();
        audioRecorder.startTime = Date.now();
        audioRecorder.timerInterval = setInterval(updateTimer, 1000);

        document.getElementById('btn-start-record').classList.add('hidden');
        document.getElementById('btn-stop-record').classList.remove('hidden');

        console.log('[Audio] Capture started');
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
    audioRecorder.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioRecorder.audioCtx.createMediaStreamSource(stream);
    audioRecorder.analyser = audioRecorder.audioCtx.createAnalyser();
    audioRecorder.analyser.fftSize = 256;
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
    const blob = new Blob(audioRecorder.chunks, { type: 'audio/mp3' });
    const btnSave = document.getElementById('btn-save-record');
    btnSave.textContent = 'Uploading...';
    btnSave.disabled = true;

    try {
        const publicUrl = await uploadAudio(audioRecorder.targetSlideId, blob);

        // Immediate UI Update
        const item = document.querySelector(`.gallery-item[data-id="${audioRecorder.targetSlideId}"]`);
        if (item) {
            item.dataset.audio = publicUrl;
            if (!item.querySelector('.audio-icon')) {
                const icon = document.createElement('div');
                icon.className = 'audio-icon';
                icon.style.pointerEvents = 'none';
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
    const filePath = `audio/${slideId}_${Date.now()}.mp3`;
    const { error: uploadErr } = await supabaseClient.storage
        .from('post-assets')
        .upload(filePath, blob);

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabaseClient.storage.from('post-assets').getPublicUrl(filePath);

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
        // 1. Storage Cleanup
        if (audioUrl) {
            const path = audioUrl.split('/').pop();
            await supabaseClient.storage.from('post-assets').remove([`audio/${path}`]);
        }

        // 2. Database Update
        await supabaseClient.from('slides').update({ audio_url: null }).eq('id', slideId);

        // 3. Immediate UI Update
        const item = document.querySelector(`.gallery-item[data-id="${slideId}"]`);
        if (item) {
            item.dataset.audio = '';
            const icon = item.querySelector('.audio-icon');
            if (icon) icon.remove();
        }

        alert('Audio deleted successfully.');
    } catch (err) {
        alert('Failed to delete audio: ' + err.message);
    }
}

// --- Subscriber Management Logic ---
async function loadAdminSubscribers() {
    const tbody = document.getElementById('subscribers-tbody');
    const { data: subs, error } = await supabaseClient.from('subscribers').select('*').order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
        return;
    }

    tbody.innerHTML = subs.map(sub => `
        <tr>
            <td>${sub.name}</td>
            <td>${sub.email}</td>
            <td>${new Date(sub.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-text delete" onclick="deleteSubscriber('${sub.id}')">Delete</button>
            </td>
        </tr>
    `).join('');

    document.getElementById('btn-new-sub').onclick = async () => {
        const name = prompt('Enter Supporter Name:');
        const email = prompt('Enter Supporter Email:');
        if (name && email) {
            await supabaseClient.from('subscribers').insert([{ name, email }]);
            loadAdminSubscribers();
        }
    };
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

    menu.innerHTML = `
        <div class="menu-item" id="menu-record-action">
            ${hasAudio ? '�️ Delete Recorded Audio' : '�🔴 Record Audio'}
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
        queue.innerHTML = '<p>No pending comments.</p>';
        return;
    }

    queue.innerHTML = comments.map(c => `
        <div class="comment-item">
            <div class="comment-meta">
                <strong>${c.author_name}</strong> on <em>${c.posts.title}</em>
            </div>
            <p class="comment-body">${c.comment_text}</p>
            <div class="actions">
                <button class="btn btn-primary" onclick="moderateComment('${c.id}', 'approved')">Approve</button>
                <button class="btn btn-text delete" onclick="moderateComment('${c.id}', 'deleted')">Delete</button>
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
        <div class="admin-header">
            <h2>Editing: ${post.title}</h2>
            <button class="btn btn-text" onclick="window.location.hash='#admin/posts'">← Back to Posts</button>
        </div>
        <p class="help-text">Drag and drop thumbnails to re-order. Right-click for options.</p>
        <div id="gallery-container" class="slides-gallery">
            ${(slides || []).map(slide => `
                <div class="gallery-item" draggable="true" data-id="${slide.id}" data-image="${slide.image_url}" data-audio="${slide.audio_url || ''}">
                    <img src="${slide.image_url}" loading="lazy" style="pointer-events: none; user-select: none;">
                    <div class="slide-badge" style="pointer-events: none;">${slide.order_index + 1}</div>
                    ${slide.audio_url ? '<div class="audio-icon" style="pointer-events: none;">♪</div>' : ''}
                </div>
            `).join('')}
        </div>
    `;

    initDragAndDrop(postId);
}

function initDragAndDrop(postId) {
    const gallery = document.getElementById('gallery-container');
    let draggedItem = null;

    gallery.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.gallery-item');
        if (!draggedItem) return;
        draggedItem.classList.add('dragging');
    });

    gallery.addEventListener('dragend', (e) => {
        if (!draggedItem) return;
        draggedItem.classList.remove('dragging');
        updateSlideOrder(postId);
    });

    gallery.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(gallery, e.clientX, e.clientY);
        if (afterElement == null) {
            gallery.appendChild(draggedItem);
        } else {
            gallery.insertBefore(draggedItem, afterElement);
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
                audio_url: item.dataset.audio || null
            };
            showContextMenu(e.pageX, e.pageY, slide);
        }
    });
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.gallery-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
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

    // Perform individual updates (Supabase doesn't support bulk update with different keys in one go easily without RPC)
    for (const update of updates) {
        await supabaseClient.from('slides').update({ order_index: update.order_index }).eq('id', update.id);
    }

    // Refresh UI to show new badges
    const { data: slides } = await supabaseClient.from('slides').select('*').eq('post_id', postId).order('order_index');
    renderAdminEditGallery(document.getElementById('admin-content'), postId);
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
