# chatbot_service.py

import os
from collections import deque
from SimpleBytePairEncoding import TokenizerService
from openai import OpenAI
from helpers import get_default_system_message
from typing import List, Optional
from pydantic import BaseModel

TOKEN_MAX_LIMIT = 1000000

class ChatSession:
    """
    Manages a single chat session with conversation history and token management.
    """
    def __init__(self, model_path, training_data=None, vocab_size=None, pat_str=None):
        self.tokenizer = TokenizerService(model_path, training_data, vocab_size, pat_str).tokenizer
        self.token_limit = TOKEN_MAX_LIMIT
        self.all_messages = deque()

    def count_tokens(self, text: str) -> int:
        return len(self.tokenizer.encode(text))

    def calculate_total_tokens(self):
        return sum([m['tokens'] for m in self.all_messages])

    def manage_token_limit(self, new_message_tokens: int):
        total_tokens = self.calculate_total_tokens()
        while total_tokens + new_message_tokens > self.token_limit and len(self.all_messages) > 1:
            removed_message = self.all_messages.popleft()
            total_tokens -= removed_message['tokens']
        return total_tokens

    def add_message(self, role, content):
        tokens = self.count_tokens(content)
        self.manage_token_limit(tokens)
        self.all_messages.append({"role": role, "content": content, "tokens": tokens})

    def get_messages(self):
        return [{"role": m["role"], "content": m["content"]} for m in self.all_messages]

    def set_system_message(self, content=None):
        if content is None:
            content = get_default_system_message()
        self.add_message("system", content)

    def get_system_message(self):
        for m in reversed(self.all_messages):
            if m["role"] == "system":
                return m["content"]
        return None

class ChatBotService:
    """
    Provides chat interaction using OpenAI API and manages chat sessions.
    """
    def __init__(self, model_path, openai_api_key, **kwargs):
        self.model_path = model_path
        self.openai_api_key = openai_api_key
        self.session = ChatSession(model_path, **kwargs)
        self.client = OpenAI(api_key=openai_api_key)
        # Ensure a system message is set at startup
        if not self.session.get_system_message():
            self.set_system_message()

    def set_system_message(self, content=None):
        self.session.set_system_message(content)

    def chat(self, user_message, context_file_contents=None, web_search_options=None, images=None):
        # If context file contents are provided, concatenate and prepend
        context_str = ""
        if context_file_contents:
            context_str = "\n".join(context_file_contents)
        # For vision: add images as message content parts
        user_content = []
        if context_file_contents:
            user_content.append({"type": "text", "text": f"CONTEXT:{context_str}\nPROMPT:{user_message}"})
        else:
            user_content.append({"type": "text", "text": user_message})
        if images:
            for img in images:
                import base64
                base64_data = base64.b64encode(img["content"]).decode("utf-8")
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{img['content_type']};base64,{base64_data}",
                        "detail": "auto"
                    }
                })
        # Store only the user prompt in history, not the context or images
        self.session.add_message("user", user_message)
        messages_to_send = self.session.get_messages()
        # Overwrite last user message in history
        if user_content and messages_to_send:
            messages_to_send[-1]["content"] = user_content

        response = self.client.chat.completions.create(
            model=os.getenv('GPT_MODEL_NAME', 'gpt-4.1'),
            messages=messages_to_send,
            **({"web_search_options": web_search_options} if web_search_options else {})
        )
        reply = response.choices[0].message.content
        self.session.add_message("system", reply)
        return reply

    def get_history(self):
        return self.session.get_messages()