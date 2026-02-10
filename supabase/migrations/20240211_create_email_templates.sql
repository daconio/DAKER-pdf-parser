-- email_templates 테이블 생성 (이메일 헤더/푸터 템플릿)
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('header', 'footer', 'signature')),
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_id + name + type 조합에 대한 unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_user_name_type
  ON email_templates(user_id, name, type);

-- RLS 활성화
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 조회 가능
CREATE POLICY "Users can view own templates"
  ON email_templates FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자 본인 데이터만 추가 가능
CREATE POLICY "Users can insert own templates"
  ON email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 데이터만 수정 가능
CREATE POLICY "Users can update own templates"
  ON email_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own templates"
  ON email_templates FOR DELETE
  USING (auth.uid() = user_id);

-- 검색 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(user_id, type);
CREATE INDEX IF NOT EXISTS idx_email_templates_default ON email_templates(user_id, is_default) WHERE is_default = TRUE;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();
