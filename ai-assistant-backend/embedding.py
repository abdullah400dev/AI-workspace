def generate_embeddings(documents: list[str]) -> list[list[float]]:
    from ollama_client import get_embedding

    return [get_embedding(text) for text in documents]
