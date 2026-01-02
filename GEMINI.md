# Project Timothy Fund Uganda - Blog Application

## Overview

A single-page application (SPA) for publishing monthly updates and prayer requests from mission work in Uganda. The app serves both public consumers (supporters viewing updates) and administrators (managing content).

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **Hosting** | Static file hosting (Netlify, GitHub Pages, etc.) |
| **Fonts** | Google Fonts (Outfit, Playfair Display) |

---

## Architecture

```
PTIFUND/
├── index.html          # Single HTML entry point
├── style.css           # All application styles
├── js/
│   ├── app.js          # Core application logic
│   └── config.js       # Supabase credentials (gitignored)
├── supabase/
│   └── functions/
│       └── send-batch-emails/
│           └── index.ts   # Edge function for email broadcasts
└── Reference Docs/     # Design mockups (PDFs)
```

---

## Database Schema (Supabase)

### Tables

| Table | Purpose |
|-------|---------|
| `posts` | Blog post metadata (id, title, slug, created_at) |
| `slides` | Individual slides per post (id, post_id, image_url, audio_url, order_index) |
| `subscribers` | Email subscribers (id, name, email, created_at) |
| `comments` | User comments with moderation (id, post_id, author_name, comment_text, status) |

### Storage Buckets

| Bucket | Purpose |
|--------|---------|
| `post-assets` | Slide images and audio recordings |
| `blog-assets` | Additional uploaded content |

---

## Features

### Consumer Features

1. **Home View** - Displays the latest monthly update with slide stack
2. **Archive View** - Grid of all past monthly updates
3. **Post Detail View** - Full slide viewer with audio playback
4. **Comments** - Public comment submission (pending moderation)

### Admin Features

1. **Authentication** - Supabase email/password login
2. **Post Management**
   - Create new posts with folder upload (PNG slides)
   - Edit post titles inline
   - Delete posts
3. **Gallery Editor**
   - Drag-and-drop slide reordering
   - Right-click context menu for slide actions
   - Upload additional slides to existing posts
4. **Audio Recording**
   - Record audio directly in browser (Web Audio API)
   - Real-time waveform visualization
   - Automatic upload to Supabase Storage
5. **Subscriber Management**
   - View/add/remove email subscribers
6. **Comment Moderation**
   - Approve or deny pending comments
7. **Email Broadcasts**
   - Send post notifications to all subscribers (via Edge Function)

---

## Routing

Hash-based SPA routing:

| Route | View |
|-------|------|
| `#home` | Latest post (consumer) |
| `#archive` | All posts grid (consumer) |
| `#post/{id}` | Single post detail (consumer) |
| `#admin-portal` | Admin login |
| `#admin/posts` | Post management |
| `#admin/edit/{id}` | Gallery editor |
| `#admin/subscribers` | Subscriber list |
| `#admin/comments` | Comment moderation |

---

## UI Design

### Color Palette

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-orange` | `#D35400` | Primary actions, branding |
| `--color-green` | `#27AE60` | Success states, accents |
| `--color-yellow` | `#F39C12` | Warnings |
| `--color-dark` | `#2C3E50` | Text, headers |
| `--color-light` | `#ECF0F1` | Backgrounds |
| `--color-bg` | `#F9FAFB` | Page background |

### Admin Layout

- **Sidebar**: 240px fixed left navigation
- **Main Content**: Full remaining width
- **Cards**: White background, 16px border-radius, subtle shadows
- **Gallery Grid**: Responsive grid with 180px minimum column width

---

## Key Functions

### Audio Recording

```javascript
openAudioRecorder(slideId)   // Opens modal, binds to slide
startCapture()               // Requests mic, starts recording
stopCapture()                // Stops recording
saveAndUploadAudio()         // Uploads blob to Supabase
deleteAudio(slideId, url)    // Removes audio from slide
```

### Drag-and-Drop

```javascript
initDragAndDrop(postId)      // Sets up event listeners
getDragAfterElement()        // Calculates drop position
updateSlideOrder(postId)     // Persists new order to database
```

### Content Loading

```javascript
loadLatestPost()             // Consumer home view
loadArchive()                // Consumer archive grid
loadPostDetails(id)          // Full slide stack with audio
```

---

## Edge Functions

### send-batch-emails

Sends email broadcasts to all subscribers when admin triggers notification.

- **Batching**: 30 recipients per batch (BCC)
- **Rate limiting**: 1 second delay between batches
- **Template**: Responsive HTML email with brand styling

---

## Configuration

Create `js/config.js` (gitignored):

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

## Security

- **Row Level Security (RLS)**: Enabled on all Supabase tables
- **Admin Auth**: Supabase email/password authentication
- **Service Role**: Used only in Edge Functions (server-side)
- **HTTPS Required**: Audio recording requires secure context

---

## Version

Current: `v1.0.007`

Version displayed in:
- Admin sidebar footer
- Console log on initialization
