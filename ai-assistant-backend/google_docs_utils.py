import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from urllib.parse import urlparse, parse_qs
import pickle
from typing import Dict, Tuple, List
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# If modifying these scopes, delete the token.pickle file.
SCOPES = [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
]

def get_credentials():
    """Get valid user credentials from storage or prompt for login."""
    creds = None
    # The file token.pickle stores the user's access and refresh tokens
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', 
                SCOPES,
                redirect_uri='http://localhost:8080/'
            )
            creds = flow.run_local_server(port=8080)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return creds

def extract_document_id(url: str) -> str:
    """Extract document ID from Google Docs URL."""
    try:
        parsed_url = urlparse(url)
        
        # Handle different URL formats
        if 'docs.google.com' in parsed_url.netloc:
            if '/document/d/' in parsed_url.path:
                # Format: https://docs.google.com/document/d/DOCUMENT_ID/edit
                parts = parsed_url.path.split('/')
                return parts[parts.index('d') + 1]
            elif 'id=' in parsed_url.query:
                # Format: https://docs.google.com/document/u/0/?id=DOCUMENT_ID
                return parse_qs(parsed_url.query)['id'][0]
        
        # If we get here, the URL format is not recognized
        raise ValueError("Invalid Google Docs URL format")
    except Exception as e:
        logger.error(f"Error extracting document ID: {str(e)}")
        raise ValueError("Could not extract document ID from URL")

def get_document_content(doc_id: str) -> Tuple[str, str]:
    """
    Get the title and text content of a Google Doc.
    
    Args:
        doc_id: The ID of the Google Doc
        
    Returns:
        Tuple of (title, content)
    """
    try:
        creds = get_credentials()
        service = build('docs', 'v1', credentials=creds)
        
        # Get document metadata to get the title
        drive_service = build('drive', 'v3', credentials=creds)
        file_metadata = drive_service.files().get(fileId=doc_id, fields='name').execute()
        title = file_metadata.get('name', 'Untitled Document')
        
        # Get document content
        doc = service.documents().get(documentId=doc_id).execute()
        
        # Extract text from the document
        content = []
        if 'body' in doc and 'content' in doc['body']:
            for element in doc['body']['content']:
                if 'paragraph' in element:
                    for text_run in element['paragraph'].get('elements', []):
                        if 'textRun' in text_run and 'content' in text_run['textRun']:
                            content.append(text_run['textRun']['content'])
        
        return title, '\n'.join(content)
    except Exception as e:
        logger.error(f"Error fetching document content: {str(e)}")
        raise Exception(f"Failed to fetch document content: {str(e)}")

def process_google_doc(url: str) -> Dict[str, str]:
    """
    Process a Google Docs URL and return its title and content.
    
    Args:
        url: URL of the Google Doc
        
    Returns:
        Dictionary with 'title' and 'content' keys
    """
    try:
        doc_id = extract_document_id(url)
        title, content = get_document_content(doc_id)
        return {
            'title': title,
            'content': content
        }
    except Exception as e:
        logger.error(f"Error processing Google Doc: {str(e)}")
        raise
