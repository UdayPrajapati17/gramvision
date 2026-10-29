# Authentication: registration, login, profile, and password workflows.
from datetime import datetime, timedelta
from secrets import randbelow
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.core.security import hash_password, verify_password, make_token, current_user
from app.core.config import settings
from app.models.models import User, OTP
from app.schemas.schemas import RegisterIn, LoginIn, OTPIn, ResetIn, NameIn
from app.services.email import send_otp, email_configuration_missing

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Registration: create a user with a unique email and a one-way password hash.
@router.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=data.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")
    user = User(name=data.name.strip(), email=data.email.lower(), password_hash=hash_password(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": make_token(user.id), "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}

# Login: verify the supplied password before returning a short-lived bearer token.
@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect")
    return {"access_token": make_token(user.id), "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}

# Profile: return only the signed-in user's public account details and counts.
@router.get("/me")
def profile(user: User = Depends(current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "created_at": user.created_at, "dataset_count": len(user.datasets)}

# Profile settings: update a display name after backend validation.
@router.patch("/me")
def update_profile(data: NameIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.name = data.name.strip(); db.commit()
    return {"name": user.name, "email": user.email}

# Email diagnostics expose configuration status only, never SMTP credentials.
@router.get("/email-status")
def email_status():
    missing = email_configuration_missing()
    return {"configured": not missing, "missing_settings": missing}

# Forgot password: issue a hashed, expiring, single-use six-digit code via SMTP.
@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=email.lower()).first()
    if user:
        previous = db.query(OTP).filter_by(email=email.lower(), purpose="reset", used=False).order_by(desc(OTP.created_at)).first()
        if previous and (datetime.utcnow() - previous.created_at).total_seconds() < settings.otp_resend_cooldown_seconds:
            return {"message": "If the account exists, a code has been sent."}
        code = f"{randbelow(1_000_000):06d}"
        db.query(OTP).filter_by(email=email.lower(), purpose="reset", used=False).update({"used": True})
        db.add(OTP(email=email.lower(), purpose="reset", code_hash=hash_password(code), expires_at=datetime.utcnow()+timedelta(minutes=settings.otp_expiry_minutes)))
        db.commit()
        try:
            send_otp(email, code, "password reset")
        except Exception as exc:
            db.query(OTP).filter_by(email=email.lower(), purpose="reset", used=False).update({"used": True}); db.commit()
            raise HTTPException(503, str(exc))
    return {"message": "If the account exists, a code has been sent."}

# OTP verification: check purpose, expiry, attempt count, and single-use status.
@router.post("/verify-otp")
def verify_otp(data: OTPIn, db: Session = Depends(get_db)):
    otp = db.query(OTP).filter_by(email=data.email.lower(), purpose=data.purpose, used=False).order_by(desc(OTP.created_at)).first()
    if not otp or otp.expires_at < datetime.utcnow() or otp.attempts >= 5:
        raise HTTPException(400, "Code is invalid or expired")
    otp.attempts += 1
    if not verify_password(data.code, otp.code_hash):
        if otp.attempts >= 5: otp.used = True
        db.commit(); raise HTTPException(400, "Code is invalid or expired")
    db.commit()
    return {"verified": True}

# Password reset: accept a valid current code and atomically consume it with password update.
@router.post("/reset-password")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    otp = db.query(OTP).filter_by(email=data.email.lower(), purpose="reset", used=False).order_by(desc(OTP.created_at)).first()
    if not otp or otp.expires_at < datetime.utcnow() or otp.attempts >= 5 or not verify_password(data.code, otp.code_hash):
        if otp: otp.attempts += 1; db.commit()
        raise HTTPException(400, "Code is invalid or expired")
    user = db.query(User).filter_by(email=data.email.lower()).first()
    if not user: raise HTTPException(400, "Unable to reset password")
    user.password_hash = hash_password(data.password); otp.used = True; db.commit()
    return {"message": "Password reset successfully"}

# OTP-confirmed password change uses a separate purpose from account recovery.
from app.schemas.schemas import ChangeOtpRequest, ChangeOtpConfirm

@router.post("/change-password/request-otp")
def request_password_change_otp(data: ChangeOtpRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if data.current_password == data.new_password:
        raise HTTPException(400, "Choose a different new password")
    previous = db.query(OTP).filter_by(email=user.email, purpose="change", used=False).order_by(desc(OTP.created_at)).first()
    if previous and (datetime.utcnow() - previous.created_at).total_seconds() < settings.otp_resend_cooldown_seconds:
        raise HTTPException(429, "Please wait before requesting another password-change code")
    code = f"{randbelow(1_000_000):06d}"
    db.query(OTP).filter_by(email=user.email, purpose="change", used=False).update({"used": True})
    db.add(OTP(email=user.email, purpose="change", code_hash=hash_password(code), expires_at=datetime.utcnow()+timedelta(minutes=settings.otp_expiry_minutes)))
    db.commit()
    try:
        send_otp(user.email, code, "password change")
    except Exception as exc:
        db.query(OTP).filter_by(email=user.email, purpose="change", used=False).update({"used": True}); db.commit()
        raise HTTPException(503, str(exc))
    return {"message": "A password-change code was sent to your registered email."}

@router.post("/change-password/confirm")
def confirm_password_change(data: ChangeOtpConfirm, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if data.current_password == data.new_password:
        raise HTTPException(400, "Choose a different new password")
    otp = db.query(OTP).filter_by(email=user.email, purpose="change", used=False).order_by(desc(OTP.created_at)).first()
    if not otp or otp.expires_at < datetime.utcnow() or otp.attempts >= 5:
        raise HTTPException(400, "Code is invalid or expired")
    otp.attempts += 1
    if not verify_password(data.code, otp.code_hash):
        if otp.attempts >= 5: otp.used = True
        db.commit(); raise HTTPException(400, "Code is invalid or expired")
    otp.used = True
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully. Please sign in again."}
