from sentence_transformers import SentenceTransformer

# Load the model once at module level to avoid repeated loading
print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dimensional embeddings
print("Model loaded successfully.")

def get_embedding(text: str) -> list[float]:
    try:
        print(f"Generating embedding for text: '{text}'")
        embedding = model.encode(text, convert_to_numpy=True).tolist()
        print(f"Embedding created. First 5 values: {embedding[:5]}")
        return embedding
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return [0.0] * 384
