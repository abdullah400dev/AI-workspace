from fastapi import APIRouter, HTTPException
from typing import List
import os
import logging
from chroma_client import client

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/documents/debug/list")
async def list_all_documents():
    """Debug endpoint to list all documents in the collection"""
    try:
        collection = client.get_collection("memory")
        # Get all documents with their metadata
        results = collection.get(include=["metadatas", "documents"])
        
        # Format the results for better readability
        formatted_results = []
        for i, doc_id in enumerate(results["ids"]):
            formatted_results.append({
                "id": doc_id,
                "metadata": results["metadatas"][i],
                "content_preview": (results["documents"][i][:100] + "...") if results["documents"][i] else ""
            })
        
        return {
            "status": "success",
            "count": len(results["ids"]),
            "documents": formatted_results
        }
        
    except Exception as e:
        error_msg = f"Error listing documents: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

@router.delete("/documents")
async def delete_document(name: str):
    """
    Delete all document chunks by document name.
    The name should be the original filename of the document.
    """
    logger.info(f"Attempting to delete document with name: {name}")
    
    try:
        # Get the collection
        collection = client.get_collection("memory")
        
        # First, get all documents to find the ones matching the filename
        all_docs = collection.get(include=["metadatas"])
        
        # Find all document chunks that match the filename in any of the possible fields
        matching_indices = []
        
        for i, meta in enumerate(all_docs["metadatas"]):
            if not meta:
                continue
                
            # Check all possible fields that might contain the filename
            possible_fields = [
                meta.get("original_filename"),
                meta.get("source"),
                meta.get("filename"),
                meta.get("file_path"),
                meta.get("title")  # For Google Docs
            ]
            
            # Check if any of the fields match the name (either directly or as a path)
            for field in possible_fields:
                if not field:
                    continue
                    
                # Get just the filename part if it's a path
                field_basename = os.path.basename(str(field))
                
                # Check for exact match or basename match
                if field == name or field_basename == name:
                    matching_indices.append(i)
                    break  # No need to check other fields for this document
        
        if not matching_indices:
            raise HTTPException(status_code=404, detail=f"No documents found with name: {name}")
        
        # Get all document IDs to delete
        doc_ids = [all_docs["ids"][i] for i in matching_indices if i < len(all_docs["ids"])]
        
        # Also find the source filename for the first matching document to delete the file
        source_filename = None
        for i in matching_indices:
            if i < len(all_docs["metadatas"]) and all_docs["metadatas"][i]:
                source_filename = all_docs["metadatas"][i].get("source")
                if source_filename:
                    break
        
        logger.info(f"Found {len(doc_ids)} document chunks to delete for: {name}")
        
        # Delete all matching documents
        if doc_ids:
            collection.delete(ids=doc_ids)
        
        # Delete the file if it exists
        file_path = os.path.join("uploads", source_filename) if source_filename else None
        if os.path.exists(file_path):
            logger.info(f"Removing file: {file_path}")
            os.remove(file_path)
        
        success_msg = f"Successfully deleted {len(doc_ids)} document chunks for: {name}"
        logger.info(success_msg)
        return {"status": "success", "message": success_msg, "deleted_count": len(doc_ids)}
        
    except HTTPException as he:
        logger.error(f"HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)
