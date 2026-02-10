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
    - [x] Mode Integration: Tab key to toggle between AI Edit and Direct Edit modes.
    - [x] Animations: Add natural React animations for button clicks and hovers.
    - [x] Interaction Loop: Cancel button and ESC key support for Save, Edit, and Download actions.

- [x] Phase 3: Email Feature Enhancements
    - [x] Bulk Email: Implement bulk email registration capability.
        - [x] useEmailContacts hook with CRUD operations
        - [x] Bulk CSV import functionality
        - [x] Contact group management
        - [x] Contact search and filtering
    - [x] Email Editing: Allow editing of Recipient, CC, BCC, Subject, and Body.
    - [x] Email List Management: Select, Delete, Edit, Copy, Paste registered emails.
        - [x] Contact selection with checkboxes
        - [x] Bulk delete selected contacts
        - [x] Inline editing for contacts
        - [x] Add selected contacts to To/CC/BCC fields
    - [x] Interaction: Disable edit mode on ESC key or Save button click.
        - [x] ESC key closes edit mode, compose form, or panel
        - [x] Keyboard shortcuts for Undo/Redo/Copy/Cut/Paste in templates
    - [x] Header/Footer: Implement CRUD (Create, Read, Update, Delete) for Email Header/Footer.
        - [x] useEmailTemplates hook with CRUD operations
        - [x] Email templates API route
        - [x] Template management UI (EmailTemplateManager component)
        - [x] Header/Footer/Signature template types
        - [x] Default template support
        - [x] Auto-apply default templates to compose form
    - [x] Header/Footer: Implement Move, Copy, Paste, Cut.
        - [x] Drag-and-drop reordering
        - [x] Copy/Cut/Paste with clipboard
        - [x] Duplicate template
    - [x] Header/Footer: Implement Undo/Redo.
        - [x] Undo/Redo stack in useEmailTemplates hook
        - [x] Ctrl+Z / Ctrl+Y keyboard shortcuts
    - [x] Attachment Quality: Ensure downloaded attachment matches original size/resolution. (Code verified - uses original PDF dimensions when available, 2x scale rendering for new PDFs)
    - [x] BCC Management: Implement CRUD for BCC emails.
        - [x] BCC contacts stored with group_name="bcc"
        - [x] Add single BCC contact
        - [x] Bulk import BCC contacts
        - [x] Edit BCC contact inline
        - [x] Delete BCC contacts
    - [x] BCC Management: Implement Move, Copy, Paste, Cut.
        - [x] Copy BCC contact to clipboard
        - [x] Cut BCC contact (copy + delete)
        - [x] Paste BCC contact from clipboard
    - [x] BCC Management: Implement Undo/Redo.
        - [x] Local undo/redo stack for BCC operations
    - [x] BCC List Management: Select, Delete, Edit, Copy, Paste registered BCC emails.
        - [x] Multi-select with checkboxes
        - [x] Select all / clear selection
        - [x] Add selected to BCC field
        - [x] Search/filter BCC contacts

- [x] Phase 4: Pencil MCP 디자인 시스템 구축
    - [x] 디자인 파일 생성 및 초기 설정
        - [x] `pencil-new.pen` 파일에 Pencil MCP 연동
        - [x] `design_system.md.resolved` 참고하여 초기 변수/컴포넌트 설계
    - [x] 변수 정의 (`mcp__pencil__set_variables`)
        - [x] 색상 변수 26개 (oklch → hex 변환, Dark 모드 기준)
        - [x] 브랜드 색상 (Indigo, Emerald, Purple, Red)
        - [x] 타이포그래피 (Pretendard Variable → Roboto 전환)
        - [x] 테두리 반지름 (sm, md, lg, xl)
    - [x] 재사용 컴포넌트 17개 생성 (`mcp__pencil__batch_design`)
        - [x] Button 5종: Primary, Secondary, Ghost, Destructive, Emerald
        - [x] IconButton: 36x36 아이콘 전용 버튼
        - [x] Input: 라벨 + 입력 필드 구조
        - [x] Textarea: 라벨 + 텍스트 영역 구조
        - [x] Card: header/content/actions 슬롯 구조
        - [x] SidebarItem 2종: Active (accent stripe), Default
        - [x] Divider: 구분선
        - [x] Badge 2종: Default, Brand
        - [x] TabToggle: 활성/비활성 탭
        - [x] Chip: 태그/퀵 프롬프트
        - [x] Avatar: 원형 이니셜 아바타
    - [x] 디자인 시스템 쇼케이스 프레임 (1200x900)
        - [x] Colors 섹션 (gray scale + brand swatches)
        - [x] Buttons 섹션 (5 variants + icon buttons)
        - [x] Inputs 섹션 (Input + Textarea)
        - [x] Navigation 섹션 (SidebarItems + TabToggle)
        - [x] Badges, Chips & Avatar 섹션
        - [x] Card 섹션
        - [x] Icons (Lucide) 섹션
    - [x] Nitro 디자인 시스템 마이그레이션
        - [x] `pencil-nitro.pen` (Node: rgGjc) 레퍼런스 분석
        - [x] 변수 37개로 확장 (Light/Dark 테마 지원)
        - [x] 프라이머리 컬러: #4F46E5 → #0F5FFE (Nitro Blue)
        - [x] 폰트: Inter → Roboto
        - [x] 모서리 반지름: rounded → 0 (sharp corners)
        - [x] SidebarItem: 56x56 vertical → 280px horizontal + accent stripe
        - [x] 모든 컴포넌트 Nitro 스타일 적용 완료
        - [x] 스크린샷 검증 완료

## 디자인 시스템 컴포넌트 ID 참조

### pencil-new.pen 파일

| 컴포넌트 | Node ID | 주요 자식 노드 |
|----------|---------|----------------|
| Button/Primary | `UJQJ7` | icon: `4ed6A`, label: `Nv9VL` |
| Button/Secondary | `56DBy` | icon: `BKN0B`, label: `tBM5T` |
| Button/Ghost | `5ycEm` | icon: `ZY1Le`, label: `sAU92` |
| Button/Destructive | `wSwPm` | icon: `q70nH`, label: `Qctbn` |
| Button/Emerald | `fhSAL` | icon: `ZzeOI`, label: `0UtJI` |
| IconButton | `cg5J8` | icon: `9kJPc` |
| Input | `vdbGI` | label: `N1h1F`, box: `55XEr`, placeholder: `bxlcO` |
| Textarea | `UKz6y` | label: `LnlGT`, box: `BRTF1`, placeholder: `zwOR2` |
| Card | `6LUZP` | header: `qJLse`, content: `oENoD`, actions: `kT61T` |
| SidebarItem/Active | `F5Smt` | icon: `BXBcE`, label: `2wod7` |
| SidebarItem/Default | `BRzue` | icon: `F7TMg`, label: `bdQe8` |
| Divider | `FCAtS` | — |
| Badge/Default | `Nvx2H` | label: `57kGM` |
| Badge/Brand | `v6Ytv` | label: `gYWUr` |
| TabToggle | `RU2W1` | active: `nhpGL`/`l6z3L`, inactive: `hxKE4`/`EqisU` |
| Chip | `uxcwT` | text: `hPfmf` |
| Avatar | `WndwW` | text: `yhPI9` |
| Showcase Frame | `6OaOy` | — |

### Nitro 디자인 변수 (37개, Light/Dark 테마)

| 변수명 | Light | Dark | 용도 |
|--------|-------|------|------|
| `--background` | `#F5F5F5` | `#252629` | 페이지 배경 |
| `--foreground` | `#333333` | `#F5F5F5` | 기본 텍스트 |
| `--card` | `#FFFFFF` | `#1F1F1F` | 카드 배경 |
| `--card-foreground` | `#333333` | `#F5F5F5` | 카드 텍스트 |
| `--primary` | `#0F5FFE` | `#0F5FFE` | 주요 액션 |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | 프라이머리 위 텍스트 |
| `--secondary` | `#333333` | `#414347` | 보조 요소 |
| `--secondary-foreground` | `#FFFFFF` | `#F5F5F5` | 보조 위 텍스트 |
| `--muted` | `#F0F0F0` | `#2E2F33` | 뮤트 배경 |
| `--muted-foreground` | `#888888` | `#A0A0A0` | 뮤트 텍스트 |
| `--destructive` | `#A62911` | `#A62911` | 삭제/경고 |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | 삭제 위 텍스트 |
| `--border` | `#E1E2E5` | `#2E2E2E` | 테두리 |
| `--input` | `#E1E2E5` | `#414347` | 입력 필드 테두리 |
| `--ring` | `#0F5FFE` | `#0F5FFE` | 포커스 링 |
| `--sidebar` | `#FFFFFF` | `#2E2F33` | 사이드바 배경 |
| `--sidebar-foreground` | `#333333` | `#F5F5F5` | 사이드바 텍스트 |
| `--sidebar-accent` | `#333333` | `#1F1F1F` | 사이드바 아이콘 |
| `--sidebar-primary` | `#0F5FFE` | `#0F5FFE` | 사이드바 활성 |
| `--success` | `#059669` | `#10B981` | 성공 상태 |
| `--warning` | `#D97706` | `#F59E0B` | 경고 상태 |
| `--error` | `#DC2626` | `#EF4444` | 에러 상태 |
| `--info` | `#2563EB` | `#3B82F6` | 정보 상태 |
| `--font-primary` | `Roboto` | — | 기본 폰트 |
| `--font-secondary` | `Roboto Mono` | — | 코드 폰트 |
| `--radius-none` | `0` | — | 모서리 없음 |
| `--radius-xs` | `2` | — | 매우 작은 모서리 |
| `--radius-sm` | `4` | — | 작은 모서리 |
| `--radius-md` | `6` | — | 중간 모서리 |
| `--radius-lg` | `8` | — | 큰 모서리 |
| `--radius-xl` | `12` | — | 매우 큰 모서리 |
| `--radius-pill` | `999` | — | 알약형 |

### Pencil MCP 도구 사용 가이드

| 도구 | 용도 | 주요 파라미터 |
|------|------|--------------|
| `get_editor_state` | 현재 열린 파일/선택 확인 | `include_schema` |
| `open_document` | 파일 열기 | `filePathOrTemplate` |
| `set_variables` | 변수 정의/수정 | `variables`, `replace` |
| `batch_design` | 컴포넌트 CRUD | `operations` (I/U/D/C/R/M/G) |
| `batch_get` | 노드 검색/조회 | `patterns`, `nodeIds` |
| `get_screenshot` | 시각적 검증 | `nodeId` |
| `snapshot_layout` | 레이아웃 검사 | `parentId`, `maxDepth` |
| `get_guidelines` | 디자인 가이드라인 | `topic` |
| `get_style_guide` | 스타일 영감 | `tags`, `name` |

#### batch_design 오퍼레이션 문법
```
// Insert: 부모에 새 노드 삽입
foo=I("parentId", { type: "frame", layout: "vertical" })

// Update: 기존 노드 속성 수정
U("nodeId", { fill: "#FF0000" })

// Delete: 노드 삭제
D("nodeId")

// Copy: 노드 복제
bar=C("sourceId", "parentId", { name: "Copy" })

// Replace: 노드 교체
baz=R("parentId/childId", { type: "text", content: "New" })

// Move: 노드 이동
M("nodeId", "newParentId", 0)

// Generate Image: 이미지 생성
G("frameId", "ai", "prompt text")
```

- [x] Phase 5: PDF 에디터 UI 디자인 완성
    - [x] Pencil MCP 연동 확인 및 문서 열기
        - [x] `pencil-new.pen` 파일 열기
        - [x] Nitro 변수 30개 설정 (`set_variables`)
    - [x] 재사용 컴포넌트 14개 생성 (`batch_design`)
        - [x] Button/Primary (`AKbFa`): 프라이머리 버튼 (#0F5FFE)
        - [x] Button/Secondary (`xRbe6`): 세컨더리 버튼 (#333333)
        - [x] Button/Ghost (`0bGcr`): 고스트 버튼 (#F2F3F0)
        - [x] Button/Destructive (`RIQ6t`): 삭제 버튼 (#A62911)
        - [x] Button/Outline (`uTflw`): 아웃라인 버튼
        - [x] Icon Button (`vaDnX`): 아이콘 전용 버튼
        - [x] Input Group (`e6EYt`): 라벨 + 입력 필드
        - [x] Sidebar Item/Active (`HQQS8`): 활성 사이드바 항목
        - [x] Sidebar Item/Default (`Gu9FM`): 기본 사이드바 항목
        - [x] Card (`JCe1O`): header/content/actions 슬롯
        - [x] Tab Item/Active (`9DwRZ`): 활성 탭
        - [x] Tab Item/Inactive (`hwYSL`): 비활성 탭
        - [x] Avatar (`dyJGY`): 원형 아바타
        - [x] Badge (`lvVvG`): AI 뱃지
    - [x] PDF 에디터 화면 구성 (`IZUwq`)
        - [x] Header: 로고, 파일명 뱃지, Save/Download 버튼
        - [x] Sidebar: PDF Editor 타이틀, AI Edit/Direct Edit/Images/Email 메뉴
        - [x] Canvas Area: 페이지 네비게이터, PDF 캔버스 (A4 비율)
        - [x] AI Panel: AI Edit Mode 타이틀, 프롬프트 입력, Quick 액션 칩
    - [x] Dark 모드 화면 생성 (`5sQS4`)
        - [x] Light 모드 화면 복제
        - [x] Dark 테마 색상 적용
    - [x] 모든 컴포넌트에 디자인 변수 적용
        - [x] 버튼: `$--primary`, `$--secondary`, `$--destructive` 등
        - [x] 입력: `$--card`, `$--input`, `$--muted-foreground`
        - [x] 사이드바: `$--sidebar`, `$--sidebar-accent`, `$--sidebar-primary`
        - [x] 레이아웃: `$--background`, `$--border`, `$--card`
    - [x] 스크린샷 검증 완료
    - [x] Git 커밋 및 푸시 (`0cf3e77`)

## Phase 5 컴포넌트 ID 참조 (최신)

### pencil-new.pen 파일 (업데이트됨)

| 컴포넌트 | Node ID | 주요 자식 노드 |
|----------|---------|----------------|
| Button/Primary | `AKbFa` | icon: `Igcv6`, label: `BqDC2` |
| Button/Secondary | `xRbe6` | icon: `0cMnT`, label: `syjAV` |
| Button/Ghost | `0bGcr` | icon: `UbBJY`, label: `V6dGq` |
| Button/Destructive | `RIQ6t` | icon: `DhpEO`, label: `dqSFv` |
| Button/Outline | `uTflw` | icon: `otZ6s`, label: `ufqAf` |
| Icon Button | `vaDnX` | icon: `QwLFu` |
| Input Group | `e6EYt` | label: `9oZ5P`, box: `GGX82`, placeholder: `7WsiM` |
| Sidebar Item/Active | `HQQS8` | icon: `J6hMs`, label: `DCltV` |
| Sidebar Item/Default | `Gu9FM` | icon: `4NXOp`, label: `kPbpO` |
| Card | `JCe1O` | header: `kwWoy`, content: `2WrnH`, actions: `sqk0N` |
| Tab Item/Active | `9DwRZ` | label: `1vivZ` |
| Tab Item/Inactive | `hwYSL` | label: `LJS4T` |
| Avatar | `dyJGY` | text: `nbrLl` |
| Badge | `lvVvG` | label: `6ftFU` |

### PDF 에디터 화면 구조

| 요소 | Node ID | 설명 |
|------|---------|------|
| PDF Editor (Light) | `IZUwq` | 메인 에디터 화면 |
| Header | `t5YjD` | 상단 헤더 |
| Header Left | `7k4GA` | 로고 + 파일명 |
| Header Right | `ptBjT` | Save/Download 버튼 |
| Main Content | `Mm0Ga` | 사이드바 + 캔버스 영역 |
| Sidebar | `nuGt6` | 좌측 사이드바 |
| Sidebar Header | `DKynq` | 사이드바 타이틀 |
| Sidebar Content | `KDa5S` | 메뉴 항목들 |
| Canvas Area | `ct2lo` | 캔버스 영역 |
| Page Navigator | `91F2U` | 페이지 네비게이션 |
| Canvas Wrapper | `S0BZ5` | 캔버스 래퍼 |
| PDF Canvas | `PHu5R` | PDF 표시 영역 |
| AI Panel | `2BrdE` | AI 편집 패널 |
| PDF Editor (Dark) | `5sQS4` | 다크 모드 화면 |
