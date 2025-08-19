from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from chroma_client import query_chroma, search_similar_documents
from embedding import generate_embeddings
from ollama_client import get_embedding
import ollama  # Using the correct Ollama client import
from uuid import uuid4
from PyPDF2 import PdfReader

router = APIRouter()

@router.get("/search")
async def search_documents(query: str, top_k: int = 5):
    """
    Search for documents similar to the query
    """
    try:
        # Generate embedding for the query
        query_embedding = generate_embeddings([query])[0]
        
        # Query ChromaDB
        results = query_chroma(query_embedding, top_k=top_k)
        
        # Format results
        formatted_results = []
        if results and 'documents' in results:
            for i in range(len(results['documents'][0])):
                doc = {
                    'content': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i] if results.get('metadatas') else {},
                    'distance': results['distances'][0][i] if results.get('distances') else None
                }
                formatted_results.append(doc)
        
        return {"query": query, "results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import os
from pathlib import Path
from fastapi import HTTPException
from datetime import datetime

UPLOAD_DIR = "uploaded_docs"
@router.get("/documents")
async def list_documents(limit: int = 10, offset: int = 0):
    """
    List documents in the upload directory with content extraction.
    """
    try:
        upload_path = Path(UPLOAD_DIR)
        if not upload_path.exists():
            return {
                "total": 0,
                "documents": [],
                "limit": limit,
                "offset": offset
            }

        all_files = []
        for index, file_path in enumerate(sorted(upload_path.glob('*'))):
            if file_path.is_file():
                stat = file_path.stat()
                file_type = file_path.suffix.lower().lstrip('.')

                # Default content
                content = "No preview available."

                try:
                    if file_type == "pdf":
                        reader = PdfReader(str(file_path))
                        text = ""
                        for page in reader.pages[:2]:  # Limit to first 2 pages
                            text += page.extract_text() or ""
                        content = text.strip() if text.strip() else "No content extracted from PDF."
                    elif file_type == "txt":
                        content = file_path.read_text(encoding="utf-8")[:1000]  # limit to 1000 chars
                except Exception as e:
                    content = f"Could not extract content: {str(e)}"

                all_files.append({
                    "id": str(uuid4()),  # Unique UUID
                    "name": file_path.name,
                    "path": str(file_path),
                    "size_bytes": stat.st_size,
                    "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "type": file_type,
                    "content": content
                })

        total = len(all_files)
        paginated_files = all_files[offset:offset + limit]

        return {
            "total": total,
            "documents": paginated_files,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/search-similar")
async def search_similar(query: str, top_k: int = 3):
    try:
        # Get embedding for the query
        embedding = get_embedding(query)

        # Query ChromaDB
        results = query_chroma(query_embedding=embedding, top_k=top_k)

        if not results or 'documents' not in results or not results['documents']:
            return {"status": "success", "query": query, "results": [], "ollama_answer": "No relevant information found."}

        # Format the results
        formatted_results = []
        documents = []
        for i in range(len(results['documents'][0])):
            doc = results['documents'][0][i]
            documents.append(doc)
            meta = results['metadatas'][0][i] if results.get('metadatas') and results['metadatas'][0] else {}
            score = results['distances'][0][i] if results.get('distances') and results['distances'][0] else None

            formatted_results.append({
                "content": doc,
                "metadata": meta,
                "score": score
            })

        # Prepare context for Ollama
        context = "\n\n".join(documents)
        prompt = f"""You are an assistant that extracts specific answers based on files and documents.:

        \"\"\"
        {context}
        \"\"\"
        
Answer this question briefly and clearly: "{query}"
"""

        # Send to Ollama (llama3 model)
        response = ollama.chat(model="llama3", messages=[
            {"role": "system", "content": "You are an assistant that extracts specific answers based on files and documents."},
            {"role": "user", "content": prompt}
        ])

        return {
            "status": "success",
            # "query": query,
            # "results": formatted_results,
            "ollama_answer": response['message']['content']
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in similarity search: {str(e)}")