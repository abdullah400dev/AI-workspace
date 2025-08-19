from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import re
import chromadb
from embedding import generate_embeddings
import ollama
import logging
import sys
import os
import json
import re
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize ChromaDB client
chroma_client = chromadb.PersistentClient(path="./chroma")
collection = chroma_client.get_or_create_collection(
    name="memory",  # Must match the collection name used in email_ingestion.py
    metadata={"hnsw:space": "cosine"}
)

@router.get("/search/emails")
async def search_emails(
    query: str = "all",
    from_email: Optional[str] = None,
    to: Optional[str] = None,
    subject: Optional[str] = None,
    days: int = 30,
    limit: int = 100,
    unread: Optional[bool] = None
):
    """
    Search emails using semantic search with filtering options.
    
    Args:
        query: Natural language search query or 'all' to get all emails
        from_email: Filter by sender's email
        to: Filter by recipient's email
        subject: Filter by subject line
        days: Only search emails from the last N days (0 for all)
        limit: Maximum number of results to return
        unread: Filter by read/unread status if specified
    """
    try:
        # Build the where clause based on filters
        filters = []
        
        # Always filter by source
        filters.append({"source": {"$eq": "gmail"}})
        
        # Helper function to create case-insensitive regex pattern
        def make_regex_pattern(value):
            return {"$regex": f"(?i){re.escape(value)}"}
        
        if from_email:
            filters.append({"from": make_regex_pattern(from_email)})
        
        if to:
            filters.append({"to": make_regex_pattern(to)})
            
        if subject:
            filters.append({"subject": make_regex_pattern(subject)})
            
        if unread is not None:
            filters.append({"read": {"$eq": not unread}})
        
        # Make date filtering optional based on the 'days' parameter
        # If days is 0 or negative, skip date filtering entirely
        if days > 0:
            try:
                # Calculate timestamp threshold (in milliseconds since epoch)
                threshold_ms = int((datetime.utcnow() - timedelta(days=days)).timestamp() * 1000)
                filters.append({"date": {"$gte": threshold_ms}})
                logger.debug(f"Applied date filter: >= {threshold_ms}")
            except Exception as e:
                logger.warning(f"Error applying date filter: {str(e)}")
                # Continue without date filtering if there's an error
        
        # Prepare query parameters
        query_params = {
            "n_results": limit,
            "include": ["documents", "metadatas", "distances"]
        }
        
        # If we have a search query, use it for semantic search
        if query and query.lower() != "all":
            query_embedding = generate_embeddings([query])[0]
            query_params["query_embeddings"] = [query_embedding]
        else:
            # For no query or 'all', we'll use a default query with just the filters
            default_query = "*"  # This will match all documents when combined with filters
            query_params["query_texts"] = [default_query]
        
        # Add where clause if we have any filters
        if filters:
            query_params["where"] = {"$and": filters} if len(filters) > 1 else filters[0]
        
        # Debug: Log the query parameters and collection info
        logger.debug(f"Searching with query: {query}")
        logger.debug(f"Query params: {query_params}")
        
        # Log collection info
        try:
            collection_info = collection.get()
            logger.debug(f"Collection info: {collection_info}")
            logger.debug(f"Collection count: {collection.count()}")
        except Exception as e:
            logger.error(f"Error getting collection info: {str(e)}")
        
        try:
            # Perform the search
            results = collection.query(**query_params)
            
            # Debug: Log the raw results
            logger.debug(f"Search results: {results}")
            if results and 'ids' in results and results['ids']:
                logger.debug(f"Found {len(results['ids'][0])} results")
                if 'distances' in results and results['distances']:
                    logger.debug(f"Distances: {results['distances']}")
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {str(e)}")
            raise
        
        # Format the results
        emails = []
        if results and 'documents' in results and results['documents'] and results['documents'][0]:
            for i in range(len(results['documents'][0])):
                try:
                    metadata = results['metadatas'][0][i] if results.get('metadatas') and results['metadatas'] and i < len(results['metadatas'][0]) else {}
                    content = results['documents'][0][i]
                    
                    # Truncate content for the list view
                    preview = (content[:200] + '...') if len(content) > 200 else content
                    
                    # Handle date formatting
                    date_str = ""
                    timestamp = metadata.get("date")
                    
                    if timestamp:
                        try:
                            # Try to parse as timestamp (milliseconds since epoch)
                            if isinstance(timestamp, (int, float)) or (isinstance(timestamp, str) and timestamp.isdigit()):
                                date_str = datetime.fromtimestamp(int(timestamp) / 1000).strftime('%Y-%m-%d %H:%M:%S')
                            # Fall back to string date if available
                            elif "date_str" in metadata and metadata["date_str"]:
                                date_str = metadata["date_str"]
                            else:
                                date_str = str(timestamp)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Error parsing date {timestamp}: {str(e)}")
                            date_str = metadata.get("date_str", "")
                    
                    # Extract email fields with better fallbacks
                    email_from = metadata.get("from") or metadata.get("sender") or ""
                    email_to = metadata.get("to") or metadata.get("recipient") or ""
                    email_subject = metadata.get("subject") or ""
                    
                    # Parse headers from the raw content
                    try:
                        if content:
                            # Clean up the content first
                            content = content.replace('\r\n', '\n').replace('\r', '\n')
                            lines = content.split('\n')
                            
                            # Special handling for Pinterest emails
                            if 'pinterest.com' in content.lower():
                                # Look for the company name in the email
                                email_from = 'Pinterest'
                                
                                # Look for a subject line in the first few non-empty lines
                                for line in lines[:20]:  # Check first 20 lines max
                                    line = line.strip()
                                    if not line:
                                        continue
                                    
                                    # Skip common header patterns
                                    if any(line.lower().startswith(prefix) for prefix in 
                                           ['from:', 'to:', 'subject:', 'date:', 'return-path:']):
                                        continue
                                        
                                    # Skip common footer patterns
                                    if any(term in line.lower() for term in 
                                           ['unsubscribe', 'privacy', 'policy', 'terms', 'conditions', 'copyright']):
                                        continue
                                        
                                    # If we find a line that looks like a subject, use it
                                    if 5 < len(line) < 100 and not email_subject:
                                        email_subject = line
                                        break
                            else:
                                # Standard email parsing for non-Pinterest emails
                                for i, line in enumerate(lines):
                                    line = line.strip()
                                    
                                    # Look for common email header patterns
                                    if line.lower().startswith('from:') and not email_from:
                                        email_from = line[5:].strip()
                                    elif line.lower().startswith('to:') and not email_to:
                                        email_to = line[3:].strip()
                                    elif line.lower().startswith('subject:') and not email_subject:
                                        email_subject = line[8:].strip()
                                    
                                    # Look for common email patterns in the body
                                    if not email_from and ('@' in line or 'from:' in line.lower()):
                                        # Try to extract an email address
                                        email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', line)
                                        if email_match and not email_from:
                                            email_from = email_match.group(0)
                                    
                                    # Look for the first meaningful line as a subject if we don't have one
                                    if not email_subject and line and len(line) < 100 and not line.startswith((' ', '\t', '-', '_', '*', '#')):
                                        # Skip common email footer/header patterns
                                        if not any(term in line.lower() for term in ['unsubscribe', 'privacy', 'policy', 'terms', 'conditions', 'copyright']):
                                            email_subject = line
                            
                            # If we still don't have a subject, try to extract it from the first few lines of the body
                            if not email_subject:
                                body_start = 0
                                for i, line in enumerate(lines):
                                    if not line.strip():
                                        body_start = i + 1
                                        break
                                
                                # Look at the first few lines after the headers
                                for line in lines[body_start:body_start+5]:
                                    line = line.strip()
                                    if line and len(line) < 100 and not line.startswith((' ', '\t', '-', '_', '*', '#')):
                                        if not any(term in line.lower() for term in ['unsubscribe', 'privacy', 'policy', 'terms']):
                                            email_subject = line
                                            break
                            
                            # Clean up the from field
                            if email_from:
                                # Remove any angle brackets and extra spaces
                                email_from = re.sub(r'<[^>]+>', '', email_from).strip()
                                email_from = re.sub(r'\s+', ' ', email_from).strip()
                                
                                # If it's just an email, extract the name part
                                if '@' in email_from and ' ' not in email_from:
                                    name_part = email_from.split('@')[0]
                                    if '.' in name_part:
                                        # Convert first.last@example.com to First Last
                                        email_from = ' '.join(part.capitalize() for part in name_part.split('.'))
                            
                            # Clean up the subject
                            if email_subject:
                                # Remove common prefixes and clean up the subject
                                email_subject = re.sub(r'^(re:|fw:|fwd:)\s*', '', email_subject, flags=re.IGNORECASE).strip()
                                email_subject = re.sub(r'\s+', ' ', email_subject).strip()
                                
                                # If the subject is too long, truncate it
                                if len(email_subject) > 100:
                                    email_subject = email_subject[:97] + '...'
                                        
                    except Exception as e:
                        logger.warning(f"Error parsing email content: {str(e)}")
                    
                    # Set default values if fields are still empty
                    email_from = email_from or "Unknown Sender"
                    email_subject = email_subject or "No Subject"
                    
                    emails.append({
                        "id": results['ids'][0][i] if results.get('ids') and results['ids'] and i < len(results['ids'][0]) else str(i),
                        "from": email_from,
                        "to": email_to,
                        "subject": email_subject,
                        "date": date_str,
                        "timestamp": timestamp,
                        "preview": preview,
                        "content": content,  # Full content for the detailed view
                        "raw_content": content  # Include raw content for client-side parsing
                    })
                except Exception as e:
                    logger.error(f"Error processing result {i}: {str(e)}")
        
        # Generate a natural language response using Ollama
        context = "\n---\n".join([
            f"From: {e['from']}\n"
            f"Subject: {e['subject']}\n"
            f"Date: {e['date']}\n"
            f"Preview: {e['preview']}" 
            for e in emails
        ])
        
        prompt = f"""You are an AI assistant helping with email search. 
        Based on the following email context, answer the user's question.
        
        User's question: {query}
        
        Email Context:
        {context}
        
        If the context doesn't contain relevant information, say "I couldn't find any relevant emails matching your query."
        Be concise and to the point in your response.
        """
        
        try:
            response = ollama.chat(
                model="llama3",
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant that helps users find and understand their emails."},
                    {"role": "user", "content": prompt}
                ]
            )
            answer = response['message']['content']
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            answer = "I found some emails but couldn't generate a response. Here are the matching emails:"
        
        return {
            "query": query,
            "answer": answer,
            "emails": emails,
            "count": len(emails)
        }
        
    except Exception as e:
        logger.error(f"Error in search_emails: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/emails/fast")
async def fast_search_emails(
    query: str = "",
    limit: int = 100,
    days: int = 0
):
    """
    Fast email search without embeddings - returns complete email data.
    
    Args:
        query: Text to search in email content (optional)
        limit: Maximum number of results to return
        days: Only search emails from the last N days (0 for all)
    """
    try:
        # Directory where emails are stored
        emails_dir = Path("./emails")
        if not emails_dir.exists():
            logger.warning(f"Emails directory not found: {emails_dir.absolute()}")
            return {"emails": []}
            
        results = []
        current_time = datetime.utcnow()
        
        # Get all JSON files in the emails directory, sorted by modification time (newest first)
        email_files = sorted(emails_dir.glob("*.json"), 
                           key=lambda f: f.stat().st_mtime, 
                           reverse=True)
        
        logger.info(f"Found {len(email_files)} email files to process")
        
        for email_file in email_files:
            if len(results) >= limit:
                break
                
            try:
                with open(email_file, 'r', encoding='utf-8') as f:
                    email_data = json.load(f)
                
                # Skip if email_data is not a dictionary
                if not isinstance(email_data, dict):
                    logger.warning(f"Skipping non-dictionary email data in {email_file}")
                    continue
                
                # Get the raw content (try multiple possible field names)
                raw_content = (
                    email_data.get('content') or 
                    email_data.get('body') or 
                    email_data.get('text') or 
                    email_data.get('raw_content', '')
                )
                
                # Extract headers from raw content if needed
                headers = {}
                if isinstance(raw_content, str):
                    # Try to parse headers from raw content
                    header_end = raw_content.find('\n\n')
                    if header_end > 0:
                        header_text = raw_content[:header_end]
                        for line in header_text.split('\n'):
                            if ':' in line:
                                key, value = line.split(':', 1)
                                headers[key.strip().lower()] = value.strip()
                
                # Extract basic fields with fallbacks
                from_email = (
                    email_data.get('from') or 
                    email_data.get('sender') or 
                    headers.get('from', '')
                )
                
                # Special handling for LinkedIn invitation emails
                if isinstance(raw_content, str) and 'linkedin.com/invite/' in raw_content:
                    # Try to extract sender name from LinkedIn URL
                    import re
                    linkedin_match = re.search(r'View profile:https?:\/\/[^\s]+\/in\/([^?\/]+)', raw_content)
                    if linkedin_match:
                        from_email = linkedin_match.group(1).replace('-', ' ').title()
                    
                    # If still no sender, try to get it from the content
                    if not from_email or from_email == 'Unknown Sender':
                        name_match = re.search(r'Hi [^,]+,\s*([^\n]+) would like to connect', raw_content)
                        if name_match:
                            from_email = name_match.group(1).strip()
                
                # Clean up the from_email if it's in angle brackets
                if '<' in from_email and '>' in from_email:
                    from_email = from_email.split('<')[-1].split('>')[0].strip()
                
                # If we still don't have a sender, try to extract from content
                if not from_email or from_email == 'Unknown Sender':
                    if isinstance(raw_content, str):
                        # Look for common email patterns in the content
                        email_match = re.search(r'From:\s*([^\n<]+)', raw_content, re.IGNORECASE)
                        if email_match:
                            from_email = email_match.group(1).strip()
                
                to_email = (
                    email_data.get('to') or 
                    headers.get('to', '')
                )
                
                subject = (
                    email_data.get('subject') or 
                    headers.get('subject', 'No Subject')
                )
                
                # Clean up subject if it starts with 'Re:' or 'Fwd:'
                if isinstance(subject, str):
                    subject = re.sub(r'^(Re:|Fwd:)\s*', '', subject).strip()
                
                # Handle date parsing
                date_str = email_data.get('date') or headers.get('date', '')
                timestamp = 0
                
                if date_str:
                    try:
                        # Try to parse the date string
                        if isinstance(date_str, (int, float)):
                            # Handle Unix timestamp (in seconds or milliseconds)
                            if date_str > 1e12:  # Likely milliseconds
                                date_obj = datetime.fromtimestamp(date_str / 1000.0)
                            else:  # Likely seconds
                                date_obj = datetime.fromtimestamp(date_str)
                        else:
                            # Handle ISO format or other string formats
                            date_str_clean = date_str.replace('Z', '+00:00')
                            date_obj = datetime.fromisoformat(date_str_clean)
                        
                        timestamp = int(date_obj.timestamp() * 1000)  # Convert to milliseconds
                        
                        # Apply date filter if specified
                        if days > 0 and (current_time - date_obj).days > days:
                            continue
                            
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse date '{date_str}': {str(e)}")
                
                # Create email entry
                email_entry = {
                    'id': str(email_file.stem),
                    'from': from_email,
                    'to': to_email,
                    'subject': subject,
                    'content': raw_content,
                    'date': date_str,
                    'timestamp': timestamp,
                    'raw_content': raw_content  # Include full raw content for parsing on client
                }
                
                # If query is provided, search in relevant fields
                if query:
                    query = query.lower()
                    search_fields = [
                        str(subject).lower(),
                        str(from_email).lower(),
                        str(to_email).lower(),
                        str(raw_content).lower()
                    ]
                    if not any(query in field for field in search_fields):
                        continue
                
                results.append(email_entry)
                
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON in {email_file}: {str(e)}")
                continue
            except Exception as e:
                logger.error(f"Error processing {email_file}: {str(e)}", exc_info=True)
                continue
        
        logger.info(f"Returning {len(results)} emails")
        return {"emails": results}
        
    except Exception as e:
        logger.error(f"Error in fast_search_emails: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
