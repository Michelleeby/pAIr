import os
import regex
from chatbot import ChatBotClass
from dotenv import load_dotenv

# Load environment vars
load_dotenv()

# Defaults
model_path = os.getenv("MODEL_PATH", "pair.pkl")
training_data_path = os.getenv("TRAINING_DATA_PATH", "chat.log")
training_data = "Hello world!"
vocab_size = 0
pat_str = r"""('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))"""

if not os.path.exists(model_path):
    # Read training data if it exists
    if os.path.exists(training_data_path):
        with open(training_data_path, "r") as file:
            training_data = file.read()

    vocab_size = len(regex.findall(pat_str, training_data)) * 2

    # Round to the nearest multiple of 256
    if vocab_size % 256 < 128:
        vocab_size -= vocab_size % 256 # Round down
    else:
        vocab_size += 256 - vocab_size % 256 # Round up

    chatbot = ChatBotClass(model_path, training_data_path, vocab_size, pat_str)
else:
    chatbot = ChatBotClass(model_path)


chatbot.chat_main_process()