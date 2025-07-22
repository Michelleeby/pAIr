# app.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, UploadFile, File, Form, Body, HTTPException
from tokenizer_init import initialize_tokenizer

initialize_tokenizer() # Initialize the tokenizer here to ensure the model is trained/exists for chatbot service.

from pydantic import BaseModel
import os
from chatbot_service import ChatBotService
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from SimpleBytePairEncoding import TokenizerService

# Tokenizer for counting tokens (independent of chatbot session)
tokenizer_count_service = None
app = FastAPI()

# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

# Initialize the chatbot service (adjust model_path and API key as needed)
chatbot = ChatBotService(
    model_path=os.getenv("MODEL_PATH", "pair.pkl"),
    openai_api_key=os.environ["OPENAI_API_KEY"]
)

# Initialize the tokenizer for counting tokens (independent of chatbot session)
tokenizer_count_service = TokenizerService(
    model_path=os.getenv("MODEL_PATH", "pair.pkl"),
    training_data=None,
    vocab_size=None,
    pat_str=None
)

class MessageRequest(BaseModel):
    message: str
    context_files: Optional[List[str]] = None  # List of file paths (relative or absolute)

class SystemMessageRequest(BaseModel):
    system_message: str

@app.post("/chat")
async def chat_endpoint(
    message: str = Form(...),
    context_files: Optional[List[UploadFile]] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    web_search_options: Optional[str] = Form(None),
    trim_history: bool = Form(False)
):
    file_contents, context_file_token_counts, total_context_tokens = [], [], 0
    if context_files:
        for upload in context_files:
            content = (await upload.read()).decode("utf-8", errors="replace")
            file_contents.append(content)
            tokens = tokenizer_count_service.tokenizer.encode(content)
            context_file_token_counts.append({
                "filename": upload.filename,
                "token_count": len(tokens)
            })
            total_context_tokens += len(tokens)

    user_message_tokens = tokenizer_count_service.tokenizer.encode(message)
    total_tokens = total_context_tokens + len(user_message_tokens)
    
    TOKEN_MAX_LIMIT = chatbot.session.tokenizer.token_limit if hasattr(chatbot.session.tokenizer, 'token_limit') else 1000000

    # Also count previous conversation, if desired (depends on design)
    history_tokens = chatbot.session.calculate_total_tokens()
    full_total = total_tokens + history_tokens
    
    if full_total > TOKEN_MAX_LIMIT:
        # Do NOT allow sending! Return warning and breakdown
        return JSONResponse({
            "error": "Token limit exceeded",
            "token_limit": TOKEN_MAX_LIMIT,
            "total_tokens": full_total,
            "history_tokens": history_tokens,
            "user_message_tokens": len(user_message_tokens),
            "context_file_token_counts": context_file_token_counts,
            "tokens_over": full_total - TOKEN_MAX_LIMIT
        }, status_code=413)

    image_datas = []
    if images:
        for img in images:
            content = await img.read()
            image_datas.append({
                "filename": img.filename,
                "content": content,
                "content_type": img.content_type
            })

    import json
    ws_opts = None
    if web_search_options:
        try:
            ws_opts = json.loads(web_search_options)
        except Exception:
            ws_opts = None

    reply = chatbot.chat(
        message,
        context_file_contents=file_contents,
        web_search_options=ws_opts,
        images=image_datas
    )
    return {"response": reply}

@app.post("/set_system")
async def set_system_endpoint(request: SystemMessageRequest):
    chatbot.set_system_message(request.system_message)
    return {"status": "system message set"}

@app.get("/history")
async def history_endpoint():
    # Only return user and system (bot) messages, skip the first system message (system prompt)
    history = chatbot.get_history()
    filtered = []
    for idx, msg in enumerate(history):
        if msg["role"] == "system" and idx == 0:
            continue  # skip system prompt
        if msg["role"] in ("user", "system"):
            msg["tokens"] = tokenizer_count_service.tokenizer.encode(msg["content"])
            filtered.append(msg)
    return {"history": filtered}

# --- PATCH: Add endpoint for resetting the chat session ---
@app.post("/reset_session")
async def reset_session():
    """
    Resets the current chat session, both on backend and for the client's next chat.
    """
    global chatbot
    # Re-instantiate the chatbot session object
    chatbot = ChatBotService(
        model_path=os.getenv("MODEL_PATH", "pair.pkl"),
        openai_api_key=os.environ["OPENAI_API_KEY"]
    )
    return {"status": "session reset"}

@app.post("/token_count")
async def get_token_count_endpoint(
    text: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None)
):
    """Return token count for text and for each file."""
    result = {}
    if text is not None:
        result["text_tokens"] = tokenizer_count_service.tokenizer.encode(text)
        result["text_token_count"] = len(result["text_tokens"])
    if files:
        file_counts = []
        for upload in files:
            try:
                content = (await upload.read()).decode("utf-8", errors="replace")
                tokens = tokenizer_count_service.tokenizer.encode(content)
                file_counts.append({
                    "filename": upload.filename,
                    "token_count": len(tokens),
                    "token_ids": tokens
                })
            except Exception as e:
                file_counts.append({
                    "filename": upload.filename,
                    "error": str(e)
                })
        result["files"] = file_counts
    return JSONResponse(result)