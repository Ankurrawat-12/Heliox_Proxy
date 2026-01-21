"""Email service for sending transactional emails."""

import logging
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from src.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SMTP."""
    
    def __init__(self):
        self.settings = get_settings()
    
    def _get_smtp_connection(self) -> smtplib.SMTP:
        """Create SMTP connection."""
        if self.settings.smtp_secure:
            smtp = smtplib.SMTP_SSL(self.settings.smtp_host, self.settings.smtp_port)
        else:
            smtp = smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port)
            smtp.starttls()
        
        smtp.login(self.settings.smtp_user, self.settings.smtp_pass)
        return smtp
    
    def _send_email_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Send an email synchronously (internal)."""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.settings.smtp_from_name} <{self.settings.smtp_from_email or self.settings.smtp_user}>"
            msg["To"] = to_email
            
            # Add text part
            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            
            # Add HTML part
            msg.attach(MIMEText(html_content, "html"))
            
            # Send email
            with self._get_smtp_connection() as smtp:
                smtp.sendmail(
                    self.settings.smtp_from_email or self.settings.smtp_user,
                    to_email,
                    msg.as_string(),
                )
            
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Send an email in background thread (non-blocking)."""
        if not self.settings.smtp_configured:
            logger.warning("SMTP not configured, skipping email send")
            return False
        
        # Run in background thread to not block the request
        thread = threading.Thread(
            target=self._send_email_sync,
            args=(to_email, subject, html_content, text_content),
            daemon=True,
        )
        thread.start()
        
        return True  # Return immediately, email will be sent in background
    
    def send_verification_email(self, to_email: str, token: str) -> bool:
        """Send email verification email."""
        verify_url = f"{self.settings.frontend_url}/verify-email?token={token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Welcome to Heliox!</h1>
                </div>
                <div class="content">
                    <h2>Verify Your Email</h2>
                    <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
                    <p style="text-align: center;">
                        <a href="{verify_url}" class="button">Verify Email Address</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">{verify_url}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                    <p>© 2024 Heliox. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to Heliox!
        
        Please verify your email address by clicking the link below:
        {verify_url}
        
        This link will expire in 24 hours.
        
        If you didn't create an account, you can safely ignore this email.
        """
        
        return self.send_email(to_email, "Verify your Heliox account", html_content, text_content)
    
    def send_password_reset_email(self, to_email: str, token: str) -> bool:
        """Send password reset email."""
        reset_url = f"{self.settings.frontend_url}/reset-password?token={token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <p style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #f5576c;">{reset_url}</p>
                    <p>This link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>If you didn't request a password reset, you can safely ignore this email.</p>
                    <p>© 2024 Heliox. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Password Reset Request
        
        We received a request to reset your password. Click the link below to create a new password:
        {reset_url}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, you can safely ignore this email.
        """
        
        return self.send_email(to_email, "Reset your Heliox password", html_content, text_content)
    
    def send_welcome_email(self, to_email: str, company_name: str) -> bool:
        """Send welcome email after signup."""
        dashboard_url = f"{self.settings.frontend_url}/portal"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .feature {{ background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to Heliox!</h1>
                </div>
                <div class="content">
                    <h2>Your account is ready, {company_name}!</h2>
                    <p>You're all set to start using Heliox API Gateway. Here's what you can do:</p>
                    
                    <div class="feature">
                        <strong>🔑 Create API Keys</strong>
                        <p>Generate secure API keys for your applications.</p>
                    </div>
                    
                    <div class="feature">
                        <strong>🛤️ Configure Routes</strong>
                        <p>Set up routing rules to your backend services.</p>
                    </div>
                    
                    <div class="feature">
                        <strong>📊 Monitor Usage</strong>
                        <p>Track your API usage and performance metrics.</p>
                    </div>
                    
                    <p style="text-align: center;">
                        <a href="{dashboard_url}" class="button">Go to Dashboard</a>
                    </p>
                </div>
                <div class="footer">
                    <p>Need help? Check out our documentation or contact support.</p>
                    <p>© 2024 Heliox. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(to_email, f"Welcome to Heliox, {company_name}!", html_content)


# Global email service instance
email_service = EmailService()
