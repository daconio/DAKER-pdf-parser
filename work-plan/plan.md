# Work Plan

## Overview
This document outlines the plan for the upcoming work.

## Tasks
- [x] Image Management Feature
    - [x] Create `images` bucket in Supabase (Manual Step)
    - [x] Backend: Create `/api/image-storage` API route for handling image uploads, listing, and deletion.
    - [x] Frontend: Create `useImageStorage` hook to interact with the API.
    - [x] UI: Create `ImagePanel` component to list, upload, and preview images.
    - [x] Integration: Add `ImagePanel` to the main editor interface.
- [x] Logo Consistency Feature
    - [x] Auto-apply logo settings (position, scale, opacity) when adding new PDF pages.
- [x] Background Eraser Feature
    - [x] Implement eraser tool that paints with the detected or manually selected background color.
- [x] Selection Tools Feature
    - [x] Implement drag-to-select functionality for rectangular regions.
    - [x] Cut: Remove content from selection but keep background color (fill with background).
    - [x] Copy: Copy selected region to clipboard.
    - [x] Delete: Fill selected region with background color.
- [x] Page Management Feature
    - [x] Enable drag-and-drop reordering of PDF pages in the preview list.
    - [x] Auto Page Numbering: Automatically insert page numbers starting from the 2nd page (exclude cover).
    - [x] Allow customizing the position of page numbers.

- [x] Phase 2: AI PDF Optimization
    - [ ] Verify image size consistency: Check `edited_DAKER_내부매뉴얼.pdf` (pages 1 & 3) for resolution drops when copying from other PDFs. (Manual testing required)
    - [x] State Persistence: Ensure page edit state is restored when navigating sidebar menus.
    - [x] Auto-Formatting: Automatically apply existing logo and page numbers to newly inserted pages.
    - [x] Fullscreen: Auto-resize content to fit browser window in fullscreen mode.
    - [x] Download Quality: Ensure downloaded PDF matches original size and resolution. (Code verified)
    - [ ] Mode Integration: Improve and integrate AI Edit and Direct Edit functionalities.
    - [x] Animations: Add natural React animations for button clicks and hovers.
    - [ ] Interaction Loop: Implement Cancel button and ESC key support for Save, Edit, and Download actions.

- [ ] Phase 3: Email Feature Enhancements
    - [ ] Bulk Email: Implement bulk email registration capability.
    - [ ] Email Editing: Allow editing of Recipient, CC, BCC, Subject, and Body.
    - [ ] Attachment Quality: Ensure downloaded attachment matches original size/resolution.
    - [ ] Interaction: Click subject to enable edit mode; click again to disable.
    - [ ] Interaction: Disable edit mode on ESC key or Save button click.
    - [ ] Header/Footer: Implement CRUD (Create, Read, Update, Delete) for Email Header/Footer.
    - [ ] Header/Footer: Implement Move, Copy, Paste, Cut.
    - [ ] Header/Footer: Implement Undo/Redo.
    - [ ] Email List Management: Select, Delete, Edit, Copy, Paste registered emails.
    - [ ] BCC Management: Implement CRUD for BCC emails.
    - [ ] BCC Management: Implement Move, Copy, Paste, Cut.
    - [ ] BCC Management: Implement Undo/Redo.
    - [ ] BCC List Management: Select, Delete, Edit, Copy, Paste registered BCC emails.
