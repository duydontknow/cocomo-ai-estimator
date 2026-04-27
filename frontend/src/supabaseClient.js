import { createClient } from '@supabase/supabase-js';

// Vui lòng đảm bảo bạn đã set biến môi trường (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) trong thư mục frontend (file .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.error('LỖI GIAO DIỆN: Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env');
  alert('Chưa có file .env! Ứng dụng không thể kết nối Database Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
