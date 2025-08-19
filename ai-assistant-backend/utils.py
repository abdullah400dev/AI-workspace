import os
import uuid
from fastapi import UploadFile, HTTPException
from typing import Optional

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# List of allowed file extensions
ALLOWED_EXTENSIONS = {'.txt', '.pdf', '.eml'}

def get_file_extension(filename: str) -> Optional[str]:
    """Extract and return the file extension in lowercase."""
    return os.path.splitext(filename)[1].lower()

async def save_uploaded_file(file: UploadFile) -> str:
    """
    Save an uploaded file to the uploads directory with its original extension.
    
    Args:
        file: The uploaded file object
        
    Returns:
        str: The path where the file was saved
        
    Raises:
        HTTPException: If the file type is not allowed or there's an error saving the file
    """
    try:
        # Get file extension and validate it
        file_extension = get_file_extension(file.filename)
        if not file_extension or file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Create a unique filename to prevent overwrites
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save the file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        return file_path
        
    except Exception as e:
        # Clean up the file if there was an error
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
