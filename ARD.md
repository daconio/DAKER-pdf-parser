# Architecture Decision Record (ARD)

This document tracks key architectural decisions and significant changes in the project.

## [2024-02-08] Light/Dark Mode System

### Context
The application needed a consistent way to handle Light and Dark modes to match modern web standards and user preferences.

### Decision
- **Strategy**: Adopted a semantic CSS variable system compatible with Tailwind CSS v4.
- **Implementation**:
    - Defined variables like `--background`, `--foreground`, `--primary`, etc., in `app/globals.css`.
    - Used `next-themes` for safe hydration and theme switching.
    - Wrapped the app in a client-side `ThemeProvider`.
- **Component Updates**: Refactored `Hero.tsx` and `app/convert/[mode]/page.tsx` to use these semantic variables instead of hardcoded hex values or utility classes like `bg-black`.

## [2024-02-08] UI Stability: Scrollbar Layout Shift

### Context
Users experienced a "screen shake" or layout shift when navigating between pages or toggling elements that changed the document height, causing the scrollbar to appear/disappear.

### Decision
- **Fix**: Enforced `html { overflow-y: scroll; }` in `globals.css`.
- **Reasoning**: This ensures the vertical scrollbar track is always present, preventing the layout from jumping horizontally when the content height changes.

## [2024-02-08] Theme Toggle Feature

### Context
Users required a manual way to switch between Light and Dark modes.

### Decision
- **Component**: Created `components/mode-toggle.tsx` using `lucide-react` icons.
- **Integration**: Placed the toggle in the main header of the conversion page for easy access.

## [2024-02-08] UI Stability: Header Alignment

### Context
Users reported a vertical layout shift ("screen moves up and down") when navigating from the Landing page to the App page. Investigated and found discrepancies in header padding and font sizes.

### Decision
- **Standardization**: Updated `components/main/Hero.tsx` header metrics to match `app/convert/[mode]/page.tsx`.
    - Mobile Padding: `py-5` -> `py-4`.
    - Logo Height: `h-8` -> `h-6`.
    - Title Size: `text-2xl` -> `text-xl`.
- **Outcome**: The header elements (Logo, Title) now appear in the same vertical position during navigation, reducing visual "jump".

## [2024-02-08] UI Stability: Header Icon Shift (Auth Loading)

### Context
When logged in, users experienced a "shake" or horizontal/vertical shift in the header icons upon navigation.
- **Cause 1 (Vertical)**: The Auth "Loading Skeleton" (`h-9` / 36px) was taller than the loaded "User Profile" (`h-8` / 32px), causing the header height to jump.
- **Cause 2 (Horizontal)**: The "Mode Toggle" icon was grouped with the right-aligned Auth buttons. When Auth state changed (Loading -> Loaded), the width changed, pushing the Mode Toggle left/right.

### Decision
- **Vertical Fix**: Resized Auth Skeleton to `w-8 h-8` (32px) to match the computed height of the User Profile component.
- **Horizontal Fix**: Moved the `ModeToggle` component to the **Left** side of the header (next to the Logo). This isolates it from the dynamic width changes of the Auth/Action buttons on the right.

---

## [2026-02-08] Architecture Refactoring: Component Modularization

### Context
The main convert page (`app/convert/[mode]/page.tsx`) had grown to 2,346 lines with 30+ useState hooks, making it difficult to maintain, test, and extend. This was identified as a major technical debt.

### Decision
Implemented a comprehensive modular architecture with the following structure:

#### 1. Custom Hooks (`hooks/`)
- **`useAuth.ts`**: Authentication state management (user, loading, signIn, signOut, getAccessToken)
- **`useCloudStorage.ts`**: Cloud file operations (fetch, upload, download, delete)
- **`useUndoHistory.ts`**: Per-page undo/redo history with MAX_UNDO_HISTORY=20

#### 2. UI Components (`components/ui/`)
- **`ProgressBar.tsx`**: Visual progress indicator with gradient styling
- **`RecoveryDialog.tsx`**: Session recovery modal for IndexedDB saved sessions
- **`CloudPanel.tsx`**: Cloud file browser with list/open/delete actions

#### 3. Editor Components (`components/editor/`)
- **`DirectToolbar.tsx`**: Drawing tools (pencil, text, rectangle, eraser) with color/size controls
- **`PageNavigator.tsx`**: Thumbnail strip with page CRUD operations
- **`ColorPicker.tsx`**: Background color picker with presets and eyedropper

#### 4. AI Components (`components/ai/`)
- **`PromptTemplates.tsx`**: Quick edit templates (fix typo, translate, change color, remove watermark, enhance quality, add logo)

#### 5. Convert Components (`components/convert/`)
- **`ModeSelector.tsx`**: 6 conversion mode selector with AI badge

#### 6. Upload Components (`components/upload/`)
- **`FileUploader.tsx`**: Drag-and-drop file uploader with file list

#### 7. Layout Components (`components/layout/`)
- **`Header.tsx`**: Unified header with auth, download, cloud actions

#### 8. Performance Optimization (`lib/pdfLoader.ts`)
- Dynamic import wrapper for lazy-loading PDF libraries
- Async function wrappers: `getPdfPageCountAsync`, `convertPdfToImagesAsync`, etc.

### Benefits
- **Maintainability**: Each component has single responsibility
- **Reusability**: Components can be used across different pages
- **Testability**: Isolated components are easier to unit test
- **Performance**: Lazy loading reduces initial bundle size
- **Developer Experience**: Better code navigation and understanding

### File Structure
```
├── hooks/
│   ├── index.ts
│   ├── useAuth.ts
│   ├── useCloudStorage.ts
│   └── useUndoHistory.ts
├── components/
│   ├── ai/
│   │   └── PromptTemplates.tsx
│   ├── convert/
│   │   ├── index.ts
│   │   └── ModeSelector.tsx
│   ├── editor/
│   │   ├── index.ts
│   │   ├── ColorPicker.tsx
│   │   ├── DirectToolbar.tsx
│   │   └── PageNavigator.tsx
│   ├── layout/
│   │   ├── index.ts
│   │   └── Header.tsx
│   ├── ui/
│   │   ├── index.ts
│   │   ├── CloudPanel.tsx
│   │   ├── ProgressBar.tsx
│   │   └── RecoveryDialog.tsx
│   └── upload/
│       ├── index.ts
│       └── FileUploader.tsx
└── lib/
    └── pdfLoader.ts
```

---

## [2026-02-08] AI Enhancement: Prompt Templates

### Context
Users often performed similar editing tasks repeatedly, requiring them to type the same prompts.

### Decision
Added a `PromptTemplates` component with pre-defined quick edit options:
1. **오타 수정**: Auto-detect and fix typos
2. **영어 번역**: Translate all text to English
3. **색상 변경**: Change background color
4. **워터마크 제거**: Remove watermarks/logos
5. **품질 향상**: Enhance image quality
6. **로고 추가**: Create logo placeholder

### Outcome
Users can now perform common edits with a single click, improving productivity and reducing API usage for poorly-worded prompts.

---

## [2026-02-08] Feature: Copy/Paste and PDF Merge

### Context
Users needed to quickly add images from clipboard and merge additional PDFs into existing edit sessions.

### Decision
1. **Clipboard Paste (Ctrl+V)**: Added paste event listener to insert images from clipboard as new pages
2. **PDF Add Upload**: Added button to upload additional PDF files and merge pages into current session
3. **Hidden input ref**: `addPdfInputRef` for file selection

### Implementation
- `handlePasteFromClipboard`: Handles `paste` event, creates new page from clipboard image
- `addPdfToEdit`: Renders new PDF pages and inserts them after current page
- FileText icon button in Page CRUD toolbar for PDF upload

---

## [2026-02-08] UI Fix: Light Mode Readability

### Context
Multiple UI elements had hardcoded dark-mode colors (e.g., `text-gray-400`, `bg-gray-800`) that were unreadable in light mode.

### Decision
Replaced hardcoded colors with semantic Tailwind CSS variables:
- `text-gray-400` → `text-muted-foreground`
- `text-gray-500` → `text-muted-foreground`
- `text-white/90` → `text-foreground`
- `bg-gray-800` → `bg-secondary`
- `border-gray-700` → `border-border`
- `hover:border-gray-600` → `hover:border-ring`

### Affected Areas
- Header (logo, auth buttons)
- Mode description text
- Direct edit toolbar (tool buttons, sliders, labels)
- Prompt panel (example buttons)
- Logo controls (position, size, opacity labels)
- Login button styling

---

## [2026-02-08] UX: AI PDF Edit Mode Priority

### Context
AI PDF Edit is the primary feature, but was listed last in the mode selector.

### Decision
Moved `AI_EDIT` to the first position in the `MODES` array to improve discoverability.

```typescript
const MODES = [
  { id: AI_EDIT, label: "AI PDF 수정", ... },  // Now first
  { id: ConversionMode.PDF_TO_PNG, ... },
  // ... other modes
]
```

---

## [2026-02-08] Feature: Thumbnail Context Menu & Keyboard Shortcuts

### Context
Users needed quick access to page operations without navigating through multiple UI elements. Required power-user features for efficient PDF editing.

### Decision
Implemented a comprehensive context menu and keyboard shortcut system for page thumbnails.

#### Context Menu (Right-Click)
- **복사 (⌘C)**: Copy current page to clipboard
- **스타일 복사 (⌥⌘C)**: Copy only the edited layer/style
- **붙여넣기 (⌘V)**: Paste copied page after current position
- **복제 (⌘D)**: Duplicate current page
- **삭제 (Delete)**: Delete current page (respects lock status)
- **잠금/해제**: Toggle page lock to prevent accidental edits
- **링크 (⌘K)**: Link functionality placeholder

#### Implementation Details
- **State Management**:
  ```typescript
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pageIndex: number } | null>(null)
  const [copiedPage, setCopiedPage] = useState<{ data: EditPageData; isStyleOnly: boolean } | null>(null)
  const [lockedPages, setLockedPages] = useState<Set<number>>(new Set())
  ```
- **New Functions**: `copyPage`, `pastePage`, `togglePageLock`, `closeContextMenu`, `handleContextMenuAction`
- **Context Menu UI**: Fixed-position dropdown with backdrop for click-outside dismissal
- **Lock Icon**: Visual indicator on locked page thumbnails
- **MoreHorizontal Button**: Alternative access to context menu for touch/accessibility

#### Keyboard Shortcuts (Global)
| Shortcut | Action |
|----------|--------|
| ⌘C / Ctrl+C | Copy page |
| ⌥⌘C / Alt+Ctrl+C | Style copy |
| ⌘V / Ctrl+V | Paste page |
| ⌘D / Ctrl+D | Duplicate page |
| Delete / Backspace | Delete page |
| Escape | Close context menu |

### Outcome
Power users can now manage PDF pages efficiently with familiar keyboard shortcuts while casual users have intuitive right-click access.

---

## [2026-02-08] Feature: Filename Display in Header

### Context
Users needed to see which PDF file they were currently editing.

### Decision
Added filename display in the mode header section when in AI Edit mode.

```tsx
{isAiEdit && editFileName && (
  <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full flex items-center gap-1.5">
    <FileText className="w-3.5 h-3.5" />
    {editFileName}
  </span>
)}
```

### Outcome
Users can now clearly identify the current working file in the header.

---

## [2026-02-08] Feature: Fullscreen Mode & Hamburger Menu

### Context
Users needed a distraction-free viewing mode to focus on PDF editing, and the sidebar took up valuable screen space on smaller displays.

### Decision
Implemented fullscreen mode with collapsible sidebar:

#### Fullscreen Mode
- **Toggle**: Header button or `⌘Enter` / `Ctrl+Enter`
- **Exit**: `ESC` key or floating toolbar button
- **Canvas Size**: Expands from `calc(100vh - 420px)` to `calc(100vh - 120px)`
- **Header/Sidebar**: Hidden in fullscreen mode

#### Hamburger Menu
- **Toggle Button**: `PanelLeftClose` / `PanelLeft` icons in header
- **State**: `sidebarCollapsed` controls visibility
- **Animation**: CSS transition for smooth collapse

#### Floating Toolbar (Fullscreen)
- Exit button with `ESC` shortcut hint
- Page navigation (prev/next with counter)
- Download button
- Temp save status indicator

#### State Variables
```typescript
const [isFullscreen, setIsFullscreen] = useState(false)
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
```

### Outcome
Users can now focus on editing with maximum canvas space and easily toggle UI elements.

---

## [2026-02-08] Feature: Temp Save Status Indicator

### Context
Users needed visual feedback to know when their work was being auto-saved to IndexedDB.

### Decision
Added a visual indicator in the header showing save status:

```typescript
const [tempSaveStatus, setTempSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
```

#### Status Display
- **Saving**: Yellow pulsing circle + "저장 중..."
- **Saved**: Green circle + "임시 저장됨" (auto-hides after 2s)
- **Idle**: No indicator shown

### Outcome
Users now have clear visual feedback about their work being saved automatically.

---

## [2026-02-08] Feature: Real-Time Collaboration (Figma-like)

### Context
Users needed to collaborate on PDF editing with team members in real-time.

### Decision
Implemented a collaboration system with the following architecture:

#### Hook: `useCollaboration.ts`
- **Session Management**: Create/join collaboration sessions with invite codes
- **Presence Tracking**: Real-time online status via Supabase Realtime
- **Cursor Sync**: Broadcast cursor position to other collaborators
- **Edit Broadcast**: Share edits in real-time via broadcast channel

#### Interfaces
```typescript
interface Collaborator {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: "owner" | "editor" | "viewer"
  isOnline: boolean
  cursor?: { x: number; y: number; page: number }
  lastSeen: number
}

interface CollaborationSession {
  id: string
  name: string
  ownerId: string
  createdAt: string
  inviteCode?: string
}
```

#### Component: `CollaborationPanel.tsx`
- **Avatar Stack**: Shows online collaborators with presence indicators
- **Invite Dialog**: Share via link or email invitation
- **Role Selection**: Owner, Editor, or Viewer permissions
- **Collaborator List**: Shows all participants with their roles

#### Key Features
1. **Invite by Link**: Generate shareable invite code
2. **Invite by Email**: Send invitations to specific users
3. **Role-Based Access**: Owner, Editor, Viewer permissions
4. **Presence Indicators**: Green dot for online users
5. **Real-Time Sync**: Edits appear instantly for all collaborators

### Technical Implementation
- Supabase Realtime channels for presence and broadcast
- Local storage for session persistence (MVP)
- 30-second heartbeat for presence updates

### Outcome
Teams can now collaborate on PDF editing in real-time, similar to Figma's collaboration model.

---

## [2026-02-08] UX: Presentation Mode (Fullscreen Improvements)

### Context
Users needed a truly immersive fullscreen experience without any UI distractions, similar to presentation software.

### Decision
Enhanced fullscreen mode with presentation-style features:

#### Visual Changes
- **Black Background**: `bg-black` for true theater-mode viewing
- **No Margins**: Removed all padding (`p-0`) in fullscreen
- **Full Canvas**: Canvas height now uses `100vh` instead of `calc(100vh - 120px)`
- **No Max-Width**: Removed `max-w-5xl` constraint in fullscreen

#### Auto-Hide Toolbar
- **Behavior**: Toolbar appears on mouse movement, hides after 3 seconds of inactivity
- **Animation**: Smooth fade-out with `opacity-0 -translate-y-4` transition
- **State Variables**:
  ```typescript
  const [showFullscreenToolbar, setShowFullscreenToolbar] = useState(true)
  const fullscreenToolbarTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  ```

#### Toolbar Styling
- Dark theme: `bg-black/80 border-white/10`
- Smaller footprint with rounded-full design
- Pointer-events disabled when hidden

### Outcome
Fullscreen mode now provides a distraction-free, presentation-quality viewing experience.

---

## [2026-02-08] UX: Save/Apply Visual Feedback

### Context
Users needed clear visual feedback when saving PDFs, uploading to cloud, or applying AI edits.

### Decision
Added a centered overlay animation system for save operations:

#### State
```typescript
const [saveAnimation, setSaveAnimation] = useState<"idle" | "saving" | "success" | "error">("idle")
```

#### Visual Feedback
- **Saving**: Blue pulsing animation with `Loader2` spinner
- **Success**: Green bounce animation with `CheckCircle` icon, auto-dismisses after 1.5s
- **Error**: Red fade with `X` icon, auto-dismisses after 2s

#### Integrated Functions
1. `downloadEditedPdf()` - PDF download
2. `uploadPdfToCloud()` - Cloud storage upload
3. `applyEditToCurrentPage()` - AI edit application

### Outcome
Users now receive immediate, clear visual feedback for all save and apply operations.

---

## [2026-02-08] Layout: Expanded Content Area

### Context
The main content area had too much whitespace, reducing the effective canvas size.

### Decision
Expanded the content area with conditional max-width:

#### Changes
- **Normal Mode**: `max-w-5xl` (1024px)
- **AI Edit Mode**: `max-w-7xl` (1280px) when editing
- **Fullscreen Mode**: No max-width constraint

#### Code
```typescript
<div className={`w-full flex-1 flex flex-col transition-all duration-300 ${
  isFullscreen ? "" : isAiEdit && editPages.length > 0 ? "max-w-7xl mx-auto" : "max-w-5xl mx-auto"
}`}>
```

#### Mode Header
- Reduced margin: `mb-8` → `mb-6`
- Hidden in fullscreen mode

### Outcome
More screen real estate for PDF editing while maintaining clean layouts in other modes.

---

## [2026-02-08] Feature: Email System (Naver Cloud Integration)

### Context
Users needed to send PDFs and collaboration invites via email directly from the application.

### Decision
Implemented a complete email system using Naver Cloud Outbound Mailer API:

#### API Route: `/api/send-email/route.ts`
- **POST**: Send email with optional PDF attachment
- **GET**: Fetch email history for current user
- **DELETE**: Remove email from history
- **Authentication**: HMAC-SHA256 signature for NCP API

#### Hook: `useEmail.ts`
```typescript
interface SendEmailParams {
  to: string[]
  subject: string
  htmlBody?: string
  textBody?: string
  attachments?: EmailAttachment[]
  saveToHistory?: boolean
}
```

#### Features
1. **Email Compose**: Recipients, subject, body fields
2. **PDF Attachment**: Attach current PDF to email
3. **Email History**: View sent emails with status
4. **Collaboration Invite**: Styled HTML email with invite link

#### UI: `EmailPanel.tsx`
- **Inline Mode**: Displays in main content area (not modal)
- **List View**: Email history with status icons
- **Compose View**: Full email composition form
- **Sidebar Button**: Access via left sidebar menu

### Outcome
Users can send PDFs and invite collaborators directly from the app.

---

## [2026-02-08] Deployment: Vercel Configuration

### Context
Application needed to be deployed to Vercel via GitHub.

### Decision
Created deployment configuration:

#### Files Added
1. **`.env.example`**: Template for required environment variables
2. **Updated `.gitignore`**: Excluded `.env*` but included `.env.example`
3. **Updated `README.md`**: Added Vercel deployment guide

#### Environment Variables (Vercel Dashboard)
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI PDF editing |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role |
| `NAVER_CLOUD_ACCESS_KEY` | Naver Cloud API access |
| `NAVER_CLOUD_SECRET_KEY` | Naver Cloud API secret |
| `NAVER_CLOUD_SENDER_EMAIL` | Email sender address |

### Outcome
Project is ready for one-click deployment to Vercel with proper environment configuration.
