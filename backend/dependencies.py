from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, ClientOptions

from database import SUPABASE_URL, SUPABASE_KEY

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Xác thực JWT Token từ Supabase và trả về (user_id, authenticated_supabase_client).
    """
    token = credentials.credentials
    try:
        # Tạo một client mới riêng cho request này với token của user 
        # để vượt qua Row Level Security (RLS) policies thay vì dùng global client anon_key
        user_client = create_client(
            SUPABASE_URL, 
            SUPABASE_KEY, 
            options=ClientOptions(headers={"Authorization": f"Bearer {token}"})
        )
        
        # Gọi SDK Supabase để lấy thông tin user dựa trên JWT
        user_response = user_client.auth.get_user(token)
        if user_response and user_response.user:
            return {
                "user_id": user_response.user.id,
                "client": user_client
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ hoặc đã hết hạn",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Lỗi xác thực: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
