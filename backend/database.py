import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Trỏ đến file .env ở thư mục ngoài cùng (d:\cocomo-ai-estimator\.env)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY are required in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
