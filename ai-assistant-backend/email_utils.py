import base64
import os
import sys
import json
import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from email import message_from_bytes
from email.header import decode_header
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from fastapi import HTTPException

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OAuth2 scopes required for Gmail API
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]

# Directory to store user tokens
TOKENS_DIR = Path("./tokens")
TOKENS_DIR.mkdir(exist_ok=True)

def get_flow(redirect_uri: str) -> Flow:
    """Create and return a Flow instance for OAuth."""
    credentials_path = Path('credentials.json')
    if not credentials_path.exists():
        raise FileNotFoundError(
            f"Credentials file '{credentials_path}' not found. "
            "Please download it from Google Cloud Console and save it in the project root."
        )
    
    return Flow.from_client_secrets_file(
        credentials_path,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

def get_auth_url(redirect_uri: str, state: str = None) -> str:
    """Generate the authorization URL for OAuth flow."""
    flow = get_flow(redirect_uri)
    auth_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='select_account',  # Force account selection
        state=state or str(uuid.uuid4())
    )
    return auth_url

def exchange_code_for_token(code: str, redirect_uri: str, state: str = None) -> Tuple[Credentials, str]:
    """Exchange authorization code for tokens and save them."""
    try:
        flow = get_flow(redirect_uri)
        flow.fetch_token(code=code)
        
        # Get user info to identify the account
        user_info_service = build('oauth2', 'v2', credentials=flow.credentials)
        user_info = user_info_service.userinfo().get().execute()
        email = user_info.get('email')
        
        if not email:
            raise HTTPException(status_code=400, detail="Could not retrieve user email")
        
        # Save the credentials
        save_credentials(email, flow.credentials)
        
        return flow.credentials, email
    except Exception as e:
        logger.error(f"Error exchanging code for token: {e}")
        raise HTTPException(status_code=400, detail="Invalid authorization code")

def save_credentials(email: str, credentials: Credentials) -> None:
    """Save credentials for a specific email."""
    token_file = TOKENS_DIR / f"{email}.json"
    token_data = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes,
        'expiry': credentials.expiry.isoformat() if credentials.expiry else None
    }
    
    with open(token_file, 'w') as f:
        json.dump(token_data, f)

def get_credentials(email: str) -> Optional[Credentials]:
    """Get credentials for a specific email."""
    token_file = TOKENS_DIR / f"{email}.json"
    if not token_file.exists():
        return None
    
    try:
        with open(token_file, 'r') as f:
            token_data = json.load(f)
        
        # Convert string expiry back to datetime
        expiry = datetime.fromisoformat(token_data['expiry']) if token_data['expiry'] else None
        
        return Credentials(
            token=token_data['token'],
            refresh_token=token_data['refresh_token'],
            token_uri=token_data['token_uri'],
            client_id=token_data['client_id'],
            client_secret=token_data['client_secret'],
            scopes=token_data['scopes'],
            expiry=expiry
        )
    except Exception as e:
        logger.error(f"Error loading credentials for {email}: {e}")
        return None

def get_gmail_service(email: str):
    """Get Gmail API service for a specific email account."""
    creds = get_credentials(email)
    if not creds:
        raise HTTPException(status_code=401, detail="No credentials found. Please authenticate first.")
    
    # Refresh token if needed
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            save_credentials(email, creds)
        except Exception as e:
            logger.error(f"Error refreshing token for {email}: {e}")
            raise HTTPException(status_code=401, detail="Failed to refresh access token")
    
    try:
        return build('gmail', 'v1', credentials=creds)
    except Exception as e:
        logger.error(f"Error building Gmail service for {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize Gmail service")

def parse_email(raw_data):
    msg = message_from_bytes(base64.urlsafe_b64decode(raw_data))
    subject = decode_mime_words(msg.get("Subject"))
    from_name, from_email = parse_email_header(msg.get("From"))

    return {
        "subject": subject,
        "from_name": from_name,
        "from_email": from_email
    }


    
    # Extract email body
    def get_body(part):
        """Recursively extract body from email parts."""
        if part.get('parts'):
            for subpart in part['parts']:
                get_body(subpart)
        
        mime_type = part.get('mimeType', '').lower()
        data = part.get('body', {}).get('data', '')
        
        if not data:
            return
            
        try:
            text = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            
            # Prefer plain text over HTML
            if mime_type == 'text/plain' and not email_data['body']:
                email_data['body'] = text
            elif mime_type == 'text/html' and not email_data['body']:
                # Simple HTML to text conversion
                import re
                text = re.sub('<[^<]+?>', ' ', text)
                email_data['body'] = ' '.join(text.split())
                
        except Exception as e:
            logger.error(f"Error decoding email body: {e}")
    
    # Start processing from the root payload
    get_body(message.get('payload', {}))
    
    # If we still don't have a body, try the simple approach
    if not email_data['body']:
        data = message.get("payload", {}).get("body", {}).get("data", "")
        if data:
            try:
                email_data['body'] = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            except Exception as e:
                logger.error(f"Error decoding simple email body: {e}")
    
    return email_data

def parse_email_header(header: str) -> Tuple[str, str]:
    """Parse and decode name and email from a header"""
    if not header:
        return "", ""
    name, email = parseaddr(header)
    name = decode_mime_words(name).strip()
    return name or "", email or ""

def get_recent_emails(service, max_results: int = 10) -> List[Dict[str, Any]]:
    """Fetch recent emails from Gmail."""
    try:
        results = service.users().messages().list(
            userId='me',
            maxResults=max_results,
            labelIds=['INBOX']
        ).execute()
        
        messages = results.get('messages', [])
        emails = []
        
        for msg in messages:
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='full'
            ).execute()
            
            email = parse_email(msg_data)
            email['id'] = msg['id']
            emails.append(email)
        
        return emails
    
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        return []

def get_unread_emails(service, max_results: int = 10) -> List[Dict[str, Any]]:
    """Fetch unread emails from Gmail."""
    try:
        results = service.users().messages().list(
            userId='me',
            maxResults=max_results,
            labelIds=['INBOX', 'UNREAD']
        ).execute()
        
        messages = results.get('messages', [])
        emails = []
        
        for msg in messages:
            msg_data = service.users().messages().get(
                userId='me',
                id=msg['id'],
                format='full'
            ).execute()
            
            email = parse_email(msg_data)
            email['id'] = msg['id']
            emails.append(email)
            
            # Mark as read
            service.users().messages().modify(
                userId='me',
                id=msg['id'],
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
        
        return emails
    
    except Exception as e:
        logger.error(f"Error fetching unread emails: {e}")
        return []
