import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html: str) -> bool:
    """Отправка email через SMTP (не блокирует event loop).

    Если SMTP_HOST не задан — логирует и возвращает False (no-op),
    чтобы разработка и тесты не требовали реального SMTP.
    """
    if not settings.SMTP_HOST:
        logger.info("SMTP not configured — skipping email to %s", to)
        return False

    def _send() -> None:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg.set_content("Ваш почтовый клиент не поддерживает HTML.")
        msg.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)

    try:
        await asyncio.to_thread(_send)
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False
