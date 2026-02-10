-- email_contacts 테이블 생성
CREATE TABLE IF NOT EXISTS email_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  group_name TEXT DEFAULT 'default' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_id + email 조합에 대한 unique constraint (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_contacts_user_email
  ON email_contacts(user_id, email);

-- RLS 활성화
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 조회 가능
CREATE POLICY "Users can view own contacts"
  ON email_contacts FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자 본인 데이터만 추가 가능
CREATE POLICY "Users can insert own contacts"
  ON email_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자 본인 데이터만 수정 가능
CREATE POLICY "Users can update own contacts"
  ON email_contacts FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자 본인 데이터만 삭제 가능
CREATE POLICY "Users can delete own contacts"
  ON email_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- 검색 최적화를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_email_contacts_user_id ON email_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_group ON email_contacts(user_id, group_name);
CREATE INDEX IF NOT EXISTS idx_email_contacts_name ON email_contacts(user_id, name);
