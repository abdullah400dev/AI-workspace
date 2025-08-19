import logging
import time
import json
import threading
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from pathlib import Path

from email_utils import get_gmail_service, get_recent_emails, get_unread_emails
from chroma_client import add_to_chroma
from embedding import generate_embeddings

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Directory to store processed emails state
PROCESSED_EMAILS_DIR = Path("./processed_emails")
PROCESSED_EMAILS_DIR.mkdir(exist_ok=True)

class EmailIngestionService:
    def __init__(self, email: str, poll_interval: int = 300):
        """Initialize the email ingestion service for a specific email account.
        
        Args:
            email: The email address of the account
            poll_interval: How often to check for new emails (in seconds)
        """
        self.email = email
        self.poll_interval = poll_interval
        self.service = None
        self._stop_event = threading.Event()
        self._processed_emails: Set[str] = set()
        self._load_processed_emails()
    
    def _get_processed_emails_file(self) -> Path:
        """Get the path to the processed emails file for this account."""
        safe_email = self.email.replace('@', '_').replace('.', '_')
        return PROCESSED_EMAILS_DIR / f"{safe_email}_processed.json"
    
    def _load_processed_emails(self) -> None:
        """Load the set of processed email IDs from disk."""
        processed_file = self._get_processed_emails_file()
        if processed_file.exists():
            try:
                with open(processed_file, 'r') as f:
                    data = json.load(f)
                    self._processed_emails = set(data.get('processed_emails', []))
                logger.info(f"Loaded {len(self._processed_emails)} processed emails for {self.email}")
            except Exception as e:
                logger.error(f"Error loading processed emails for {self.email}: {e}")
                self._processed_emails = set()
    
    def _save_processed_emails(self) -> None:
        """Save the set of processed email IDs to disk."""
        processed_file = self._get_processed_emails_file()
        try:
            with open(processed_file, 'w') as f:
                json.dump({
                    'email': self.email,
                    'last_updated': datetime.utcnow().isoformat(),
                    'processed_emails': list(self._processed_emails)
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving processed emails for {self.email}: {e}")
    
    def connect(self, max_retries: int = 3) -> bool:
        """Connect to Gmail API for the specific account.
        
        Args:
            max_retries: Maximum number of connection attempts
            
        Returns:
            bool: True if connection was successful, False otherwise
        """
        last_error = None
        
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"[{self.email}] Connecting to Gmail API (attempt {attempt}/{max_retries})...")
                self.service = get_gmail_service(self.email)
                
                # Test the connection by making a simple API call
                profile = self.service.users().getProfile(userId='me').execute()
                logger.info(f"[{self.email}] Successfully connected to Gmail API as {profile.get('emailAddress')}")
                return True
                
            except Exception as e:
                last_error = str(e)
                logger.error(f"[{self.email}] Attempt {attempt}/{max_retries} failed to connect to Gmail API: {e}")
                
                # If it's an authentication error, don't retry
                if 'invalid_grant' in str(e).lower() or 'invalid_credentials' in str(e).lower():
                    logger.error("Authentication error. Please check your credentials and try again.")
                    if os.path.exists('token_gmail.pickle'):
                        try:
                            os.remove('token_gmail.pickle')
                            logger.info("Removed invalid token file. Please re-authenticate.")
                        except Exception as e:
                            logger.error(f"Error removing token file: {e}")
                    return False
                    
                if attempt < max_retries:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error("Max retries reached. Could not connect to Gmail API.")
                    
                    # Provide troubleshooting steps for common errors
                    if 'quota' in str(e).lower():
                        logger.error("Gmail API quota may have been exceeded. Please check your Google Cloud Console.")
                    elif 'connection' in str(e).lower():
                        logger.error("Network connection issue. Please check your internet connection.")
        
        # If we get here, all retries failed
        if last_error:
            logger.error(f"Final error: {last_error}")
        return False
    
    def load_processed_emails(self):
        """Load set of already processed email IDs."""
        try:
            if os.path.exists('processed_emails.txt'):
                with open('processed_emails.txt', 'r') as f:
                    self.processed_emails = set(line.strip() for line in f)
            logger.info(f"Loaded {len(self.processed_emails)} processed email IDs")
        except Exception as e:
            logger.error(f"Error loading processed emails: {e}")
            self.processed_emails = set()
    
    def save_processed_email(self, email_id: str):
        """Save processed email ID to file."""
        try:
            with open('processed_emails.txt', 'a') as f:
                f.write(f"{email_id}\n")
            self.processed_emails.add(email_id)
        except Exception as e:
            logger.error(f"Error saving processed email {email_id}: {e}")
    
    def process_email(self, email: Dict[str, Any]) -> bool:
        """Process a single email and store it in ChromaDB."""
        try:
            email_id = email.get('id')
            if not email_id:
                logger.error("Email missing ID")
                return False
            
            if email_id in self.processed_emails:
                logger.debug(f"Email {email_id} already processed, skipping")
                return False
            
            # Create document content for embedding
            content = f"""
            From: {email.get('from', '')}
            To: {email.get('to', '')}
            Subject: {email.get('subject', '')}
            Date: {email.get('date', '')}
            
            {email.get('body', '')}
            """.strip()
            
            # Generate embedding
            embeddings = generate_embeddings([content])
            if not embeddings:
                logger.error(f"Failed to generate embedding for email {email_id}")
                return False
            
            # Parse the email date to a timestamp
            email_date = email.get('date', '')
            try:
                # Try to parse the email date string to a datetime object
                from email.utils import parsedate_to_datetime
                email_dt = parsedate_to_datetime(email_date)
                timestamp = int(email_dt.timestamp() * 1000)  # Convert to milliseconds
            except (ValueError, TypeError, AttributeError):
                # If parsing fails, use current time
                timestamp = int(datetime.utcnow().timestamp() * 1000)
                logger.warning(f"Could not parse date: {email_date}, using current time")
            
            # Store in ChromaDB with numeric timestamp
            metadata = {
                'source': 'gmail',
                'email_id': email_id,
                'from': email.get('from', ''),
                'to': email.get('to', ''),
                'subject': email.get('subject', ''),
                'date': timestamp,  # Store as numeric timestamp (milliseconds since epoch)
                'date_str': email_date,  # Keep original string for display
                'type': 'email',
                'processed_at': int(datetime.utcnow().timestamp() * 1000)  # Also numeric
            }
            
            add_to_chroma(
                doc_id=f"email_{email_id}",
                content=content,
                metadata=metadata,
                embedding=embeddings[0]
            )
            
            # Mark as processed
            self.save_processed_email(email_id)
            logger.info(f"Processed email: {email.get('subject', 'No subject')}")
            return True
        except Exception as e:
            logger.error(f"Error processing email: {e}")
            return False
            
    def process_new_emails(self, max_results: int = 10) -> None:
        """Process new unread emails.
        
        Args:
            max_results: Maximum number of emails to process in one batch
        """
        try:
            # Get recent unread emails
            emails = get_unread_emails(self.service, max_results=max_results)
            
            if not emails:
                logger.info(f"[{self.email}] No new unread emails found.")
                return
            
            logger.info(f"[{self.email}] Found {len(emails)} new unread emails. Processing...")
            
            # Process each email
            processed_count = 0
            for email in emails:
                if self._stop_event.is_set():
                    break
                    
                try:
                    # Skip if we've already processed this email
                    if email['id'] in self._processed_emails:
                        continue
                    
                    # Prepare metadata
                    metadata = {
                        'source': 'gmail',
                        'email_account': self.email,
                        'from': email.get('from', ''),
                        'to': email.get('to', ''),
                        'subject': email.get('subject', 'No Subject'),
                        'date': email.get('date', ''),
                        'message_id': email['id']
                    }
                    
                    # Generate embedding for the email
                    content = email.get('snippet', '')[:1000]  # Limit content length
                    
                    # Add to ChromaDB
                    add_to_chroma(
                        content=content,
                        metadata=metadata
                    )
                    
                    # Mark as processed
                    self._processed_emails.add(email['id'])
                    processed_count += 1
                    
                    # Periodically save processed emails to disk
                    if processed_count % 10 == 0:
                        self._save_processed_emails()
                    
                    logger.debug(f"[{self.email}] Processed email: {metadata['subject']} (ID: {email['id']})")
                    
                except Exception as e:
                    logger.error(f"[{self.email}] Error processing email {email.get('id', 'unknown')}: {e}")
            
            # Save processed emails to disk
            if processed_count > 0:
                self._save_processed_emails()
            
            logger.info(f"[{self.email}] Processed {processed_count} new emails.")
            
        except Exception as e:
            logger.error(f"[{self.email}] Error in process_new_emails: {e}")
            raise
    
    def stop(self):
        """Stop the email ingestion service."""
        logger.info(f"[{self.email}] Stopping email ingestion service...")
        self._stop_event.set()
        self._save_processed_emails()
    
    def is_running(self) -> bool:
        """Check if the service is running."""
        return not self._stop_event.is_set()
    
    def run_continuous(self):
        """Run the email ingestion service continuously until stopped."""
        logger.info(f"[{self.email}] Starting continuous email ingestion service...")
        
        while not self._stop_event.is_set():
            try:
                if not self.service and not self.connect():
                    logger.error(f"[{self.email}] Failed to connect to Gmail API. Retrying in 60 seconds...")
                    self._stop_event.wait(60)
                    continue
                
                # Process new emails
                self.process_new_emails()
                
                # Wait for the next polling interval or until stopped
                self._stop_event.wait(self.poll_interval)
                
            except Exception as e:
                logger.error(f"[{self.email}] Error in email ingestion service: {e}")
                self._stop_event.wait(60)  # Wait before retrying on error
        
        logger.info(f"[{self.email}] Email ingestion service stopped")


def start_email_ingestion(email: str, poll_interval: int = 300):
    """Start the email ingestion service for a specific email.
    
    Args:
        email: The email address to ingest emails for
        poll_interval: How often to check for new emails (in seconds)
    """
    service = EmailIngestionService(email=email, poll_interval=poll_interval)
    service.run_continuous()


if __name__ == "__main__":
    # This is just for testing - in production, use the API endpoints
    import sys
    if len(sys.argv) < 2:
        print("Usage: python email_ingestion.py <email> [poll_interval]")
        sys.exit(1)
    
    email = sys.argv[1]
    poll_interval = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    start_email_ingestion(email=email, poll_interval=poll_interval)
