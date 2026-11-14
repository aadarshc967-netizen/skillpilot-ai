import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

_PASSWORD_ITERATIONS = 600_000
_DEVELOPMENT_JWT_SECRET = secrets.token_bytes(32)
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PASSWORD_ITERATIONS,
    )
    return f"pbkdf2_sha256${_PASSWORD_ITERATIONS}${_b64encode(salt)}${_b64encode(derived)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$", maxsplit=3)
        if algorithm != "pbkdf2_sha256":
            return False
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            _b64decode(salt),
            int(iterations),
        )
        return hmac.compare_digest(_b64encode(derived), expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> str:
    issued = int(time.time())
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64encode(json.dumps({
        "sub": str(user_id),
        "iat": issued,
        "exp": issued + 60 * 60 * 24,
    }, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}"
    signature = hmac.new(_secret(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64encode(signature)}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        header, payload, signature = token.split(".")
        signing_input = f"{header}.{payload}"
        expected = hmac.new(_secret(), signing_input.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64decode(signature), expected):
            return None
        decoded_header = json.loads(_b64decode(header))
        claims = json.loads(_b64decode(payload))
        if decoded_header != {"alg": "HS256", "typ": "JWT"}:
            return None
        if int(claims["exp"]) <= int(time.time()):
            return None
        int(claims["sub"])
        return claims
    except (ValueError, TypeError, KeyError, json.JSONDecodeError):
        return None


def _secret() -> bytes:
    configured = os.getenv("JWT_SECRET_KEY", "")
    if configured:
        if len(configured) < 32:
            raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
        return configured.encode("utf-8")
    if os.getenv("APP_ENV", "").casefold() == "production":
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")
    return _DEVELOPMENT_JWT_SECRET


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
