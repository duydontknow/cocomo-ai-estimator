-- Chạy trên giao diện SQL Editor của Supabase

-- 1. Xóa bảng cũ nếu tồn tại (Cẩn thận nều đã có dữ liệu quan trọng)
DROP TABLE IF EXISTS projects;

-- 2. Tạo bảng projects, liên kết với auth.users của Supabase
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users NOT NULL, -- UUID của user đang login
    name TEXT NOT NULL,
    description TEXT,
    kloc NUMERIC,
    fp NUMERIC,
    language TEXT,
    project_mode TEXT,
    cost_drivers JSONB, -- Lưu trữ dạng JSONb 15 cost drivers
    avg_salary NUMERIC,
    effort NUMERIC,
    time NUMERIC,
    cost NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bật RLS (Row Level Security) cho bảng projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 4. Tạo Policy: User CHỈ thấy dữ liệu CỦA BẢN THÂN HỌ
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Tạo Policy: User CHỈ insert dữ liệu khi login và user_id bằng CHÍNH HỌ
CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Tạo Policy: User CHỈ update dự án CỦA HỌ
CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Tạo Policy: User CHỈ delete dự án CỦA HỌ
CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- (Tuỳ chọn) Helper trigger để tự cập nhật `updated_at` mỗi khi lưu.
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_modtime
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
