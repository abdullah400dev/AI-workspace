import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException
from utils import save_uploaded_file
from file_parser import parse_file
from embedding import generate_embeddings
from chroma_client import add_to_chroma
import logging
import os
from uuid import uuid4
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "uploaded_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    return Path(filename).name  # Prevent directory traversal

async def save_uploaded_file(file: UploadFile) -> str:
    filename = sanitize_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)

    # Save file
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return file_path

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Step 1: Save file locally
        file_path = await save_uploaded_file(file)

        # Step 2: Parse file contents
        documents = parse_file(file_path)

        # Step 3: Generate embeddings
        embeddings = generate_embeddings(documents)

        # Step 4: Store in ChromaDB
        # For each document, store with its corresponding embedding
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = f"{file.filename}_{i}"
            add_to_chroma(
                doc_id=doc_id,
                content=doc,
                metadata={"source": file.filename, "doc_index": i},
                embedding=embedding
            )

        return {"status": "success", "message": f"{file.filename} processed"}
    
    except HTTPException as he:
        # Re-raise HTTP exceptions directly
        logger.error(f"Upload error: {he.detail}")
        raise
        
    except Exception as e:
        error_detail = f"{str(e)}\n\n{traceback.format_exc()}"
        logger.error(f"Upload error: {error_detail}")
        raise HTTPException(
            status_code=500, 
            detail={"error": "Internal server error during file processing"}
        )
