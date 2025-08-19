import os
import logging
import json
import re
from fastapi import APIRouter, HTTPException, Request, Depends, Header
from typing import Dict, Any, Optional, List
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.signature import SignatureVerifier
from urllib.parse import parse_qs
import requests

from embedding import generate_embeddings
from chroma_client import add_to_chroma

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(override=True)

# Slack app credentials (should be in environment variables)
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")
SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET")
SLACK_REDIRECT_URI = os.getenv("SLACK_REDIRECT_URI", "http://localhost:8000/api/slack/oauth/callback")

# Debug log environment variables
logger.info("Loading Slack environment variables:")
logger.info(f"SLACK_CLIENT_ID: {SLACK_CLIENT_ID[:5]}...{SLACK_CLIENT_ID[-5:] if SLACK_CLIENT_ID else 'Not set'}")
logger.info(f"SLACK_CLIENT_SECRET: {'Set' if SLACK_CLIENT_SECRET else 'Not set'}")
logger.info(f"SLACK_SIGNING_SECRET: {'Set' if SLACK_SIGNING_SECRET else 'Not set'}")
logger.info(f"SLACK_REDIRECT_URI: {SLACK_REDIRECT_URI}")

# Store tokens by team ID (in production, use a database)
slack_tokens = {}

@router.get("/slack/status")
async def slack_status():
    """Check if Slack is connected"""
    return {
        "connected": len(slack_tokens) > 0,
        "teams": list(slack_tokens.keys())
    }

# Initialize signature verifier
signature_verifier = SignatureVerifier(SLACK_SIGNING_SECRET)

def verify_slack_request(request: Request, x_slack_signature: str = Header(None), x_slack_request_timestamp: str = Header(None)):
    """Verify that the request is coming from Slack"""
    if not x_slack_signature or not x_slack_request_timestamp:
        raise HTTPException(status_code=401, detail="Missing Slack headers")
    
    # Get raw body as bytes
    body = request.body()
    
    if not signature_verifier.is_valid(
        body=body,
        timestamp=x_slack_request_timestamp,
        signature=x_slack_signature
    ):
        raise HTTPException(status_code=401, detail="Invalid Slack request signature")
    return True

@router.get("/slack/connect")
async def connect_slack():
    """Generate the Slack OAuth URL"""
    if not all([SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI]):
        raise HTTPException(status_code=500, detail="Slack integration not properly configured")
    
    return {
        "auth_url": (
            "https://slack.com/oauth/v2/authorize?"
            f"client_id={SLACK_CLIENT_ID}&"
            "scope=channels:history,channels:read,groups:history,im:history,mpim:history,files:read,links:read&"
            f"redirect_uri={SLACK_REDIRECT_URI}&"
            "user_scope=search:read"
        )
    }

@router.get("/slack/oauth/callback")
async def slack_oauth_callback(code: str):
    """Handle OAuth callback from Slack"""
    try:
        # Exchange the authorization code for an access token
        response = requests.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": SLACK_CLIENT_ID,
                "client_secret": SLACK_CLIENT_SECRET,
                "code": code,
                "redirect_uri": SLACK_REDIRECT_URI
            }
        )
        response.raise_for_status()
        
        data = response.json()
        if not data.get("ok", False):
            raise HTTPException(status_code=400, detail=f"Slack API error: {data.get('error', 'Unknown error')}")
        
        # Store the token (in production, use a database)
        team_id = data["team"]["id"]
        slack_tokens[team_id] = data["access_token"]
        
        return {"status": "success", "team_id": team_id}
    except Exception as e:
        logger.error(f"Error in Slack OAuth callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to authenticate with Slack")

@router.post("/slack/events")
async def slack_events(request: Request):
    """Handle Slack events (including URL verification)"""
    # Verify request is from Slack
    verify_slack_request(request)
    
    # Parse the request body
    body = await request.json()
    
    # Handle URL verification challenge
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}
    
    # Handle event callback
    if body.get("type") == "event_callback":
        event = body.get("event", {})
        
        # Handle message events
        if event.get("type") == "message" and not event.get("subtype"):
            await process_slack_message(event)
    
    return {"status": "ok"}

async def process_slack_message(event: Dict[str, Any]):
    """Process a Slack message and extract/save documents"""
    try:
        text = event.get("text", "")
        team_id = event.get("team")
        channel = event.get("channel")
        ts = event.get("ts")
        
        if not all([team_id, channel, ts]):
            return
        
        # Get the Slack client
        token = slack_tokens.get(team_id)
        if not token:
            logger.warning(f"No token found for team {team_id}")
            return
        
        client = WebClient(token=token)
        
        # Extract links from message
        links = extract_links(text)
        
        # Process each link
        for link in links:
            try:
                # Check if it's a document link
                if is_document_link(link):
                    # Download and process the document
                    await process_document(link, {"source": "slack", "channel": channel, "ts": ts})
            except Exception as e:
                logger.error(f"Error processing link {link}: {str(e)}")
        
        # Check for file attachments
        if "files" in event:
            for file_info in event["files"]:
                try:
                    if is_supported_file(file_info["name"]):
                        await process_slack_file(client, file_info, {"source": "slack", "channel": channel, "ts": ts})
                except Exception as e:
                    logger.error(f"Error processing file {file_info.get('name')}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error processing Slack message: {str(e)}")

def extract_links(text: str) -> List[str]:
    """Extract all URLs from text"""
    # This is a simple regex - you might need to adjust based on your needs
    url_pattern = r'https?://[^\s<>"]+|www\.[^\s<>"]+'
    return re.findall(url_pattern, text)

def is_document_link(url: str) -> bool:
    """Check if a URL points to a document"""
    doc_extensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.xls', '.xlsx', '.ppt', '.pptx']
    return any(url.lower().endswith(ext) for ext in doc_extensions)

def is_supported_file(filename: str) -> bool:
    """Check if a file is supported"""
    supported_extensions = ['.pdf', '.txt', '.md', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
    return any(filename.lower().endswith(ext) for ext in supported_extensions)

async def process_document(url: str, metadata: Dict[str, Any]):
    """Download and process a document from a URL"""
    try:
        # Download the file
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Get the filename from the URL or use a default
        filename = url.split("/")[-1].split("?")[0] or "document"
        
        # Save the file temporarily
        temp_path = f"/tmp/{filename}"
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Process the file (you'll need to implement this based on your file processing logic)
        # This is a placeholder - you'll need to implement the actual processing
        content = process_file(temp_path)
        
        # Generate embeddings
        embeddings = generate_embeddings([content])
        
        # Store in ChromaDB
        doc_id = f"slack_{metadata.get('channel')}_{metadata.get('ts')}"
        add_to_chroma(
            doc_id=doc_id,
            document=content,
            metadata={
                "source": "slack",
                "url": url,
                "filename": filename,
                "channel": metadata.get("channel"),
                "timestamp": metadata.get("ts"),
                **metadata
            },
            embedding=embeddings[0] if embeddings else None
        )
        
        logger.info(f"Processed document from {url}")
        
    except Exception as e:
        logger.error(f"Error processing document {url}: {str(e)}")
        raise

async def process_slack_file(client: WebClient, file_info: Dict[str, Any], metadata: Dict[str, Any]):
    """Process a file shared in Slack"""
    try:
        # Get the file URL
        file_url = file_info.get("url_private_download")
        if not file_url:
            logger.warning("No download URL available for file")
            return
        
        # Download the file
        response = client.files_getTemporaryUploadURLExternal(file=file_info["id"])
        if not response.get("ok"):
            logger.warning(f"Failed to get file download URL: {response.get('error', 'Unknown error')}")
            return
        
        # Process the file
        await process_document(response["url"], {
            **metadata,
            "filename": file_info.get("name", "file"),
            "filetype": file_info.get("filetype", ""),
            "user": file_info.get("user", ""),
            "title": file_info.get("title", "")
        })
    
    except SlackApiError as e:
        logger.error(f"Slack API error: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing Slack file: {str(e)}")

def process_file(file_path: str) -> str:
    """Process a file and return its content as text"""
    # This is a placeholder - implement based on your file processing needs
    # You might want to use libraries like PyPDF2, python-docx, etc.
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        # Handle binary files
        with open(file_path, 'rb') as f:
            return f.read().decode('utf-8', errors='ignore')
