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

