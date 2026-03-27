"""
Stratos Vektor Ingestion Service
FastAPI service for document extraction, chunking, embedding, and vector storage.

In production:
- Connector adapters for GitHub, Confluence, Slack, etc.
- Multiple embedding model support (OpenAI, Cohere, local)
- pgvector integration for vector storage
- BullMQ job queue integration
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List
import hashlib
import math
from datetime import datetime

app = FastAPI(
    title="Vektor Ingestion Service",
    description="Document ingestion and embedding pipeline for Stratos Vektor",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Models =====

class ChunkingConfig(BaseModel):
    strategy: str = "sentence"  # fixed, sentence, paragraph, semantic
    chunk_size: int = 512
    chunk_overlap: int = 50


class IngestRequest(BaseModel):
    datasource_id: str
    index_id: str
    org_id: str
    chunking: Optional[ChunkingConfig] = None


class IngestResponse(BaseModel):
    job_id: str
    status: str
    documents_processed: int
    chunks_created: int
    duration_ms: int


class EmbedRequest(BaseModel):
    texts: List[str]
    model: str = "text-embedding-3-small"


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    model: str
    dimensions: int
    total_tokens: int


class ChunkResult(BaseModel):
    chunks: List[str]
    total_chunks: int
    avg_chunk_size: int
    strategy: str


# ===== Chunking =====

def chunk_fixed(text: str, size: int, overlap: int) -> List[str]:
    chunks = []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i : i + size])
        if i + size >= len(text):
            break
    return chunks


def chunk_sentence(text: str, max_size: int, overlap: int) -> List[str]:
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) > max_size and current:
            chunks.append(current.strip())
            # Keep last part for overlap
            overlap_text = current[-overlap:] if overlap > 0 else ""
            current = overlap_text + " " + sent
        else:
            current += " " + sent
    if current.strip():
        chunks.append(current.strip())
    return chunks


def chunk_paragraph(text: str, max_size: int) -> List[str]:
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) > max_size and current:
            chunks.append(current.strip())
            current = para
        else:
            current += "\n\n" + para
    if current.strip():
        chunks.append(current.strip())
    return chunks


def chunk_text(text: str, config: ChunkingConfig) -> List[str]:
    if config.strategy == "fixed":
        return chunk_fixed(text, config.chunk_size, config.chunk_overlap)
    elif config.strategy == "sentence":
        return chunk_sentence(text, config.chunk_size, config.chunk_overlap)
    elif config.strategy == "paragraph":
        return chunk_paragraph(text, config.chunk_size)
    else:
        return chunk_sentence(text, config.chunk_size, config.chunk_overlap)


# ===== Mock Embedding =====

def mock_embed(texts: List[str], dimensions: int = 1536) -> List[List[float]]:
    """
    Mock embedding function.
    In production: call OpenAI text-embedding-3-small or Cohere embed-v3
    """
    import random
    return [
        [random.uniform(-1, 1) for _ in range(dimensions)]
        for _ in texts
    ]


# ===== Endpoints =====

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Vektor Ingestion Service", "version": "1.0.0"}


@app.post("/chunk", response_model=ChunkResult)
async def chunk_document(
    text: str = Form(...),
    strategy: str = Form("sentence"),
    chunk_size: int = Form(512),
    chunk_overlap: int = Form(50),
):
    """Chunk a document using the specified strategy."""
    config = ChunkingConfig(strategy=strategy, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = chunk_text(text, config)
    avg_size = sum(len(c) for c in chunks) // max(1, len(chunks))

    return ChunkResult(
        chunks=chunks,
        total_chunks=len(chunks),
        avg_chunk_size=avg_size,
        strategy=strategy,
    )


@app.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(request: EmbedRequest):
    """Generate embeddings for a list of texts."""
    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per request")

    dimensions = 1536 if "3-small" in request.model else 3072
    embeddings = mock_embed(request.texts, dimensions)
    total_tokens = sum(len(t.split()) for t in request.texts) * 2  # rough estimate

    return EmbedResponse(
        embeddings=embeddings,
        model=request.model,
        dimensions=dimensions,
        total_tokens=total_tokens,
    )


@app.post("/ingest", response_model=IngestResponse)
async def ingest_datasource(request: IngestRequest):
    """
    Trigger full ingestion pipeline for a data source.
    In production: this would be a BullMQ job that runs asynchronously.
    """
    start = datetime.utcnow()
    config = request.chunking or ChunkingConfig()

    # Mock: simulate processing 10 documents
    docs_processed = 10
    chunks_per_doc = math.ceil(2000 / config.chunk_size)
    total_chunks = docs_processed * chunks_per_doc

    duration_ms = int((datetime.utcnow() - start).total_seconds() * 1000) + 500

    return IngestResponse(
        job_id=f"ingest_{request.datasource_id}_{int(datetime.utcnow().timestamp())}",
        status="completed",
        documents_processed=docs_processed,
        chunks_created=total_chunks,
        duration_ms=duration_ms,
    )


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    index_id: str = Form(...),
    org_id: str = Form(...),
):
    """Upload and ingest a file directly."""
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    config = ChunkingConfig(strategy="sentence", chunk_size=512, chunk_overlap=50)
    chunks = chunk_text(text, config)
    embeddings = mock_embed(chunks)

    file_hash = hashlib.sha256(content).hexdigest()

    return {
        "status": "success",
        "filename": file.filename,
        "file_hash": file_hash,
        "file_size_bytes": len(content),
        "chunks_created": len(chunks),
        "embedding_dimensions": len(embeddings[0]) if embeddings else 0,
        "index_id": index_id,
    }


@app.get("/connectors")
async def list_connectors():
    """List available data source connectors."""
    return {
        "connectors": [
            {"type": "github", "name": "GitHub", "auth": "oauth2", "status": "available"},
            {"type": "confluence", "name": "Confluence", "auth": "api_token", "status": "available"},
            {"type": "slack", "name": "Slack", "auth": "oauth2", "status": "available"},
            {"type": "postgresql", "name": "PostgreSQL", "auth": "connection_string", "status": "available"},
            {"type": "web_crawler", "name": "Web Crawler", "auth": "none", "status": "available"},
            {"type": "file_upload", "name": "File Upload", "auth": "none", "status": "available"},
            {"type": "s3", "name": "Amazon S3", "auth": "aws_credentials", "status": "available"},
            {"type": "gcs", "name": "Google Cloud Storage", "auth": "service_account", "status": "available"},
            {"type": "notion", "name": "Notion", "auth": "oauth2", "status": "beta"},
            {"type": "google_drive", "name": "Google Drive", "auth": "oauth2", "status": "beta"},
            {"type": "custom_api", "name": "Custom API", "auth": "api_key", "status": "available"},
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
