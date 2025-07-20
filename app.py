# app.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, UploadFile, File, Form, Body
from tokenizer_init import initialize_tokenizer

initialize_tokenizer() # Initialize the tokenizer here to ensure the model is trained/exists for chatbot service.

from pydantic import BaseModel
import os
from chatbot_service import ChatBotService
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
    web_search_options: Optional[str] = Form(None)
):
    file_contents = []
    if context_files:
        for upload in context_files:
            content = (await upload.read()).decode("utf-8", errors="replace")
            file_contents.append(content)

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