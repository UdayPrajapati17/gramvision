# OTP email delivery through Brevo SMTP. Never log or return verification codes.
import smtplib
from email.message import EmailMessage
from app.core.config import settings

def email_configuration_missing() -> list[str]:
    required = {
        "SMTP_HOST": settings.smtp_host,
        "SMTP_USERNAME": settings.smtp_username,
        "SMTP_PASSWORD": settings.smtp_password,
        "SMTP_FROM_EMAIL": settings.smtp_from_email,
    }
    return [name for name, value in required.items() if not value or value.startswith("your-") or value == "verified-sender@example.com"]

def send_otp(address: str, code: str, purpose: str) -> None:
    missing = email_configuration_missing()
    if missing:
        raise RuntimeError(
            "Password-reset email is not configured. In backend/.env set "
            + ", ".join(missing)
            + ". Use your Brevo SMTP login and SMTP key (not your normal account password), "
              "and a sender address verified in Brevo, then restart the backend."
        )
    msg = EmailMessage()
    msg["Subject"] = "Your GramVision verification code"
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = address
    msg.set_content(
        f"Your GramVision {purpose} code is {code}. It expires in "
        f"{settings.otp_expiry_minutes} minutes. Do not share this code."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError as exc:
        raise RuntimeError(
            "Brevo rejected the SMTP credentials. Check SMTP_USERNAME and SMTP_PASSWORD in backend/.env; "
            "SMTP_PASSWORD must be the Brevo SMTP key, not your Brevo website password."
        ) from exc
    except smtplib.SMTPRecipientsRefused as exc:
        raise RuntimeError(
            "The email provider refused the recipient. Check the recipient address and that your sender is verified in Brevo."
        ) from exc
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError) as exc:
        raise RuntimeError(
            f"Could not connect to the configured SMTP server ({settings.smtp_host}:{settings.smtp_port}). "
            "Check your internet connection, SMTP host, and port 587."
        ) from exc
    except smtplib.SMTPException as exc:
        raise RuntimeError(
            "Brevo SMTP could not send the reset email. Check your sender verification and Brevo SMTP settings."
        ) from exc
