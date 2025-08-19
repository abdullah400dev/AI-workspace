from fastapi import APIRouter, HTTPException
import chromadb
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

def get_chroma_collection():
    """Helper function to get the ChromaDB collection."""
    try:
        chroma_client = chromadb.PersistentClient(path="./chroma")
        return chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
    except Exception as e:
        logger.error(f"Error getting ChromaDB collection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/debug/chroma/count")
async def debug_chroma_count() -> Dict[str, Any]:
    """Debug endpoint to check the number of documents in ChromaDB."""
    try:
        collection = get_chroma_collection()
        count = collection.count()
        
        return {
            "status": "success",
            "collection": "documents",
            "document_count": count,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/debug/chroma/sample")
async def debug_chroma_sample(limit: int = 5) -> Dict[str, Any]:
    """Debug endpoint to get sample documents from ChromaDB."""
    try:
        collection = get_chroma_collection()
        count = collection.count()
        
        if count == 0:
            return {
                "status": "success",
                "message": "No documents in collection",
                "documents": []
            }
            
        # Get sample documents with their metadata
        results = collection.get(
            limit=min(limit, count),
            include=["metadatas", "documents"]
        )
        
        # Format the results
        documents = []
        if results and 'ids' in results:
            for i, doc_id in enumerate(results['ids']):
                doc = {
                    "id": doc_id,
                    "metadata": results['metadatas'][i] if 'metadatas' in results and len(results['metadatas']) > i else {},
                    "content": results['documents'][i] if 'documents' in results and len(results['documents']) > i else ""
                }
                documents.append(doc)
        
        return {
            "status": "success",
            "collection": "documents",
            "document_count": count,
            "sample_size": len(documents),
            "documents": documents
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/debug/chroma/search")
async def debug_chroma_search(
    query: str,
    n_results: int = 5,
    where: Optional[dict] = None
) -> Dict[str, Any]:
    """Debug endpoint to test ChromaDB search directly."""
    try:
        from embedding import generate_embeddings
        
        # Generate embedding for the query
        query_embedding = generate_embeddings([query])
        if not query_embedding:
            return {"status": "error", "error": "Failed to generate embedding"}
        
        collection = get_chroma_collection()
        
        # Prepare query parameters
        query_params = {
            "query_embeddings": query_embedding,
            "n_results": n_results,
            "include": ["metadatas", "documents", "distances"]
        }
        
        # Only add where clause if it's not empty
        if where:
            query_params["where"] = where
        
        # Perform the search
        results = collection.query(**query_params)
        
        # Format the results
        documents = []
        if results and 'ids' in results and results['ids']:
            for i in range(len(results['ids'][0])):
                doc = {
                    "id": results['ids'][0][i],
                    "metadata": results['metadatas'][0][i] if results.get('metadatas') and results['metadatas'][0] else {},
                    "content": results['documents'][0][i] if results.get('documents') and results['documents'][0] else "",
                    "distance": results['distances'][0][i] if results.get('distances') and results['distances'][0] else None
                }
                documents.append(doc)
        
        return {
            "status": "success",
            "query": query,
            "where": where if where else {},
            "results": documents
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
