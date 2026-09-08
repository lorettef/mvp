import bcrypt
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
from app.core.config import settings

# Валидный bcrypt-хеш «пустышки», который используется для timing-safe проверки
# пароля несуществующего пользователя. Хеш валиден (сгенерирован через
# bcrypt.hashpw), поэтому bcrypt.checkpw отрабатывает полный KDF и НЕ бросает
# ValueError("Invalid salt") — в отличие от прежнего литерала
# "$2b$12$dummy_hash_for_timing_safety_xxxx", который был невалидным и ронял
# login в 500. Хеш вычисляется один раз при импорте модуля.
_DUMMY_HASH: str = bcrypt.hashpw(
    b"timing-safe-dummy-password",
    bcrypt.gensalt(),
).decode("utf-8")


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль.

    Возвращает False (fail-closed) при любом невалидном хеше (например, битые
    данные в БД), вместо того чтобы бросать ValueError и ронять запрос в 500.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except ValueError:
        # Некорректный формат bcrypt-хеша — данные повреждены. Не даём запросу
        # упасть: закрываем доступ (аналогично неверному паролю).
        return False


def dummy_password_hash() -> str:
    """Валидный bcrypt-хеш для timing-safe проверки несуществующих пользователей.

    Использование валидного хеша гарантирует: (1) одинаковое время проверки для
    существующего и несуществующего пользователя (защита от перебора по таймингу),
    (2) корректный 401 без исключений.
    """
    return _DUMMY_HASH

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создаёт JWT токен."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, settings.SECRET_KEY.get_secret_value(), algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Декодирует JWT токен."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY.get_secret_value(),
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.PyJWTError:
        return None
