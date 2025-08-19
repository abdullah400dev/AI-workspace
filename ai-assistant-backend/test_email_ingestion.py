#!/usr/bin/env python3
"""
Test script for the email ingestion service.

This script demonstrates how to use the email ingestion service to:
1. Connect to Gmail API
2. Fetch recent emails
3. Process and store them in ChromaDB
4. Check the status of the service
"""
import os
import sys
import time
import json
import requests
from email_ingestion import EmailIngestionService

# Configuration
BASE_URL = "http://localhost:8000"
CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "token_gmail.pickle"

def test_api_endpoints():
    """Test the email-related API endpoints."""
    print("\n=== Testing API Endpoints ===")
    
    # Check service status
    try:
        response = requests.get(f"{BASE_URL}/api/emails/status")
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error checking status: {e}")
    
    # Trigger email ingestion
    try:
        response = requests.post(f"{BASE_URL}/api/emails/ingest?max_results=5")
        print(f"\nIngest response: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error triggering ingestion: {e}")

def test_direct_service():
    """Test the email ingestion service directly."""
    print("\n=== Testing Direct Service ===")
    
    # Initialize the service
    service = EmailIngestionService(poll_interval=10)  # 10 seconds for testing
    
    # Test connection
    if not service.connect():
        print("Failed to connect to Gmail API")
        return
    
    # Test fetching recent emails
    try:
        print("\nFetching recent emails...")
        count = service.ingest_recent_emails(max_results=5)
        print(f"Successfully processed {count} recent emails")
    except Exception as e:
        print(f"Error fetching recent emails: {e}")
    
    # Test checking for new emails
    try:
        print("\nChecking for new emails...")
        count = service.check_new_emails()
        print(f"Processed {count} new unread emails")
    except Exception as e:
        print(f"Error checking for new emails: {e}")

def main():
    """Main function to run the test script."""
    print("=== Email Ingestion Service Test ===")
    
    # Check for required files
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Error: {CREDENTIALS_FILE} not found.")
        print("Please download it from Google Cloud Console and save it in the project root.")
        sys.exit(1)
    
    # Test API endpoints if server is running
    try:
        test_api_endpoints()
    except Exception as e:
        print(f"API test failed: {e}")
    
    # Test direct service
    test_direct_service()
    
    print("\nTest completed!")

if __name__ == "__main__":
    main()
