# API validation: keep account and password inputs consistent.
from pydantic import BaseModel, EmailStr, Field, field_validator

def validate_password_bytes(value: str) -> str:
    # bcrypt accepts at most 72 UTF-8 bytes; reject clearly instead of silently truncating.
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes. Choose a shorter password.")
    return value

class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    _password_bytes = field_validator("password")(validate_password_bytes)

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    _password_bytes = field_validator("password")(validate_password_bytes)

class OTPIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    purpose: str = "reset"

class ResetIn(OTPIn):
    password: str = Field(min_length=8)
    _password_bytes = field_validator("password")(validate_password_bytes)

class ChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    _current_password_bytes = field_validator("current_password")(validate_password_bytes)
    _new_password_bytes = field_validator("new_password")(validate_password_bytes)

class NameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class ChangeOtpRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    _current_password_bytes = field_validator("current_password")(validate_password_bytes)
    _new_password_bytes = field_validator("new_password")(validate_password_bytes)

class ChangeOtpConfirm(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    code: str = Field(pattern=r"^\d{6}$")
    _current_password_bytes = field_validator("current_password")(validate_password_bytes)
    _new_password_bytes = field_validator("new_password")(validate_password_bytes)
