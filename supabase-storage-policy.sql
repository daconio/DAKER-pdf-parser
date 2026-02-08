                                                                  -- Supabase Storage RLS 정책 설정
                                                                  -- pdf-files 버킷에 대해 로그인한 사용자가 자신의 폴더에만 접근 가능하도록 설정

                                                                  -- 1. 업로드 (INSERT) 정책
                                                                  CREATE POLICY "Users can upload to own folder"
                                                                  ON storage.objects
                                                                  FOR INSERT
                                                                  TO authenticated
                                                                  WITH CHECK (
                                                                    bucket_id = 'pdf-files'
                                                                    AND (storage.foldername(name))[1] = auth.uid()::text
                                                                  );

                                                                  -- 2. 조회 (SELECT) 정책
                                                                  CREATE POLICY "Users can view own files"
                                                                  ON storage.objects
                                                                  FOR SELECT
                                                                  TO authenticated
                                                                  USING (
                                                                    bucket_id = 'pdf-files'
                                                                    AND (storage.foldername(name))[1] = auth.uid()::text
                                                                  );

                                                                  -- 3. 삭제 (DELETE) 정책
                                                                  CREATE POLICY "Users can delete own files"
                                                                  ON storage.objects
                                                                  FOR DELETE
                                                                  TO authenticated
                                                                  USING (
                                                                    bucket_id = 'pdf-files'
                                                                    AND (storage.foldername(name))[1] = auth.uid()::text
                                                                  );

                                                                  -- 4. 수정 (UPDATE) 정책
                                                                  CREATE POLICY "Users can update own files"
                                                                  ON storage.objects
                                                                  FOR UPDATE
                                                                  TO authenticated
                                                                  USING (
                                                                    bucket_id = 'pdf-files'
                                                                    AND (storage.foldername(name))[1] = auth.uid()::text
                                                                  );
