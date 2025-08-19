from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends
from typing import List, Dict, Any, Optional
import logging
import threading
import json
from datetime import datetime
from pathlib import Path

from email_ingestion import EmailIngestionService
from email_utils import (
    get_auth_url, 
    exchange_code_for_token,
    get_credentials,
    TOKENS_DIR
)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a router with the /api/emails prefix
router = APIRouter(prefix="/emails")

# Add a simple health check endpoint
@router.get("/health")
async def health_check():
    return {"status": "ok"}

# Dictionary to store email services by account
email_services = {}

# Lock for thread-safe operations on email_services
services_lock = threading.Lock()

class EmailServiceManager:
    def __init__(self):
        self.services = {}
        self.lock = threading.Lock()
    
    def get_service(self, email: str) -> Optional[EmailIngestionService]:
        with self.lock:
            return self.services.get(email)
    
    def add_service(self, email: str, service: EmailIngestionService):
        with self.lock:
            self.services[email] = service
    
    def remove_service(self, email: str):
        with self.lock:
            if email in self.services:
                del self.services[email]
    
    def get_all_services(self) -> Dict[str, EmailIngestionService]:
        with self.lock:
            return self.services.copy()

# Global email service manager
email_service_manager = EmailServiceManager()

@router.get("/auth/url")
async def get_auth_url_endpoint(redirect_uri: str):
    """Get the OAuth URL for Gmail authentication."""
    try:
        auth_url = get_auth_url(redirect_uri)
        return {"auth_url": auth_url}
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate auth URL")

@router.get("/auth/callback")
async def auth_callback(code: str, redirect_uri: str, state: Optional[str] = None):
    """Handle OAuth callback and exchange code for tokens."""
    try:
        credentials, email = exchange_code_for_token(code, redirect_uri, state)
        
        # Initialize email service for this account if not exists
        if not email_service_manager.get_service(email):
            service = EmailIngestionService(
                email=email,
                poll_interval=300  # 5 minutes
            )
            email_service_manager.add_service(email, service)
            
            # Start the email ingestion in a separate thread
            thread = threading.Thread(
                target=service.run_continuous,
                daemon=True
            )
            thread.start()
            logger.info(f"Started email ingestion service for {email}")
        
        return {"status": "authenticated", "email": email}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in auth callback: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@router.get("/accounts")
async def get_connected_accounts():
    """Get list of all connected email accounts."""
    try:
        accounts = []
        for token_file in TOKENS_DIR.glob("*.json"):
            try:
                with open(token_file, 'r') as f:
                    token_data = json.load(f)
                email = token_file.stem
                accounts.append({
                    "email": email,
                    "scopes": token_data.get("scopes", []),
                    "is_active": email in email_service_manager.get_all_services()
                })
            except Exception as e:
                logger.error(f"Error reading token file {token_file}: {e}")
        
        return {"accounts": accounts}
    except Exception as e:
        logger.error(f"Error getting connected accounts: {e}")
        raise HTTPException(status_code=500, detail="Failed to get connected accounts")

@router.post("/accounts/{email}/disconnect")
async def disconnect_account(email: str):
    """Disconnect an email account and stop its service."""
    try:
        # Stop the email service if running
        service = email_service_manager.get_service(email)
        if service:
            service.stop()
            email_service_manager.remove_service(email)
        
        # Remove the token file
        token_file = TOKENS_DIR / f"{email}.json"
        if token_file.exists():
            token_file.unlink()
        
        return {"status": "disconnected", "email": email}
    except Exception as e:
        logger.error(f"Error disconnecting account {email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect account: {e}")

@router.get("/emails/status")
async def get_email_status():
    """Get the status of the email ingestion service."""
    if not email_service:
        return {"status": "not_initialized"}
    
    return {
        "status": "running",
        "processed_emails": len(email_service.processed_emails) if hasattr(email_service, 'processed_emails') else 0,
        "last_checked": datetime.utcnow().isoformat()
    }

@router.post("/emails/ingest")
async def ingest_emails(background_tasks: BackgroundTasks, max_results: int = 10):
    """Trigger an immediate ingestion of recent emails."""
    if not email_service:
        raise HTTPException(status_code=503, detail="Email service not initialized")
    
    def _ingest():
        try:
            count = email_service.ingest_recent_emails(max_results)
            logger.info(f"Ingested {count} emails in background")
        except Exception as e:
            logger.error(f"Error during background email ingestion: {e}")
    
    # Run in background to avoid blocking the API
    background_tasks.add_task(_ingest)
    
    return {
        "status": "started",
        "message": f"Ingesting up to {max_results} recent emails in the background"
    }

@router.get("/emails/check")
async def check_new_emails(background_tasks: BackgroundTasks):
    """Check for new unread emails."""
    if not email_service:
        raise HTTPException(status_code=503, detail="Email service not initialized")
    
    def _check():
        try:
            count = email_service.check_new_emails()
            logger.info(f"Processed {count} new unread emails")
        except Exception as e:
            logger.error(f"Error checking for new emails: {e}")
    
    # Run in background
    background_tasks.add_task(_check)
    
    return {
        "status": "checking",
        "message": "Checking for new unread emails in the background"
    }
