import chromadb
from chromadb.config import Settings
import os
from typing import List
from ollama_client import get_embedding
from ollama_client import get_embedding


# Ensure the chroma directory exists
os.makedirs("./chroma", exist_ok=True)

# Initialize the client with persistent storage
client = chromadb.PersistentClient(path="./chroma")

# Get or create the collection
collection = client.get_or_create_collection(
    name="memory",
    metadata={"hnsw:space": "cosine"}  # Using cosine distance for semantic search
)

def add_to_chroma(doc_id: str, content: str, metadata: dict, embedding: List[float]):
    """
    Add a document to the Chroma collection.
    
    Args:
        doc_id: Unique identifier for the document
        content: Text content of the document
        metadata: Dictionary of metadata
        embedding: Vector embedding of the document
    """
    try:
        collection.upsert(
            ids=[doc_id],
            documents=[content],
            embeddings=[embedding],
            metadatas=[metadata]
        )
    except Exception as e:
        print(f"Error adding to Chroma: {e}")
        raise

def query_chroma(query_embedding: List[float], top_k: int = 5):
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        include=["documents", "distances", "metadatas"]
    )
    return results


def search_similar_documents(query_text: str, top_k: int = 5):
    try:
        print(f"\n🔎 Searching Chroma for: {query_text}")
        
        # Step 1: Convert text to embedding
        embedding = get_embedding(query_text)
        
        # Step 2: Query Chroma using the local query_chroma function
        results = query_chroma(query_embedding=embedding, top_k=top_k)
        
        if results and 'documents' in results and results['documents'] and results['documents'][0]:
            # Step 3: Show results
            for i in range(len(results['documents'][0])):
                doc = results['documents'][0][i]
                meta = results['metadatas'][0][i] if results.get('metadatas') and results['metadatas'][0] else {}
                score = results['distances'][0][i] if results.get('distances') and results['distances'][0] else None
                
                print(f"\n📄 Match:\n{doc[:300]}...")  # Show 300 chars of the doc
                print(f"📌 Metadata: {meta}")
                if score is not None:
                    print(f"📊 Similarity Score (lower is better): {score:.4f}")
            
        return results

    except Exception as e:
        print(f"Error during similarity search: {e}")
        return None