# DAKER PDF Parser

![DAKER Logo](https://r2-images.dacon.co.kr/external/DAKER.svg)

AI powered PDF conversion and editing tool.

## Features

- **PDF to Image**: Convert PDF pages to high-quality images.
- **Image to PDF**: Combine multiple images into a single PDF.
- **Merge PDF**: Merge multiple PDF files into one.
- **Split PDF**: Split a PDF file into separate pages.
- **AI Edit**: Edit PDF text and content using AI.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment (Vercel)

### 1. GitHub 연동
```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

### 2. Vercel 프로젝트 생성
1. [vercel.com](https://vercel.com) 접속 후 로그인
2. "Add New" → "Project" 클릭
3. GitHub 저장소 선택
4. Framework Preset: **Next.js** (자동 감지됨)

### 3. 환경 변수 설정
Vercel 대시보드 → Settings → Environment Variables에서 다음 변수 추가:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API 키 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 역할 키 |
| `NAVER_CLOUD_ACCESS_KEY` | 네이버 클라우드 Access Key |
| `NAVER_CLOUD_SECRET_KEY` | 네이버 클라우드 Secret Key |
| `NAVER_CLOUD_SENDER_EMAIL` | 발신자 이메일 주소 |

### 4. 배포
"Deploy" 버튼 클릭하면 자동 배포됩니다.

## Design System

Pencil MCP 기반 비주얼 디자인 시스템이 `pencil-new.pen` 파일에 구축되어 있습니다.

### Design Tokens (37 Variables)

| Category | Variables | Description |
|----------|-----------|-------------|
| Colors | `--background`, `--foreground`, `--card`, `--primary`, `--secondary` | 시맨틱 색상 (Light/Dark 테마) |
| Brand | `--primary` (#0F5FFE), `--destructive`, `--success`, `--warning` | 브랜드/상태 색상 |
| Typography | `--font-primary` (Roboto), `--font-secondary` (Roboto Mono) | 폰트 패밀리 |
| Radius | `--radius-none` (0) ~ `--radius-pill` (999) | 모서리 반지름 |
| Sidebar | `--sidebar`, `--sidebar-accent`, `--sidebar-primary` | 사이드바 전용 |

### Reusable Components (17)

- **Buttons**: Primary, Secondary, Ghost, Destructive, Emerald
- **Form**: Input, Textarea, IconButton
- **Layout**: Card (header/content/actions slots), SidebarItem (Active/Default), Divider
- **Data Display**: Badge (Default/Brand), TabToggle, Chip, Avatar

### Style Reference
- **Base**: Nitro Design System (`pencil-nitro.pen`)
- **Corners**: Sharp (0px radius)
- **Theme**: Light/Dark dual theme support
- **Font**: Roboto (primary), Roboto Mono (code)

## Architecture

Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS.
