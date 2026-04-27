from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Xác thực JWT Token từ Supabase và trả về user_id.
    """
    token = credentials.credentials
    try:
        # Gọi SDK Supabase để lấy thông tin user dựa trên JWT
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user.id
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ hoặc đã hết hạn",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Lỗi xác thực: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
