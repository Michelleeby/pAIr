# tokenizer_init.py

import os
import regex
from SimpleBytePairEncoding import TokenizerService

def initialize_tokenizer():
    model_path = os.getenv("MODEL_PATH", "pair.pkl")
    training_data_path = os.getenv("TRAINING_DATA_PATH", "sample-training-data.log")
    pat_str = os.getenv("PAT_STR", r"""('s|'t|'re|'ve|'m|'ll|'d| ?[\p{L}]+| ?[\p{N}]+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)|(```[\s\S]*?```)|(`[^`]*`)|(\[[^\]]*\]\([^)]*\))""")

    if not os.path.exists(model_path):
        training_data = "Hello world!"
        if os.path.exists(training_data_path):
            with open(training_data_path, "r") as file:
                training_data = file.read()

        vocab_size = len(regex.findall(pat_str, training_data)) * 2

        # Round to the nearest multiple of 256
        if vocab_size % 256 < 128:
            vocab_size -= vocab_size % 256
        else:
            vocab_size += 256 - vocab_size % 256

        # This will train and save the model
        TokenizerService(model_path, training_data, vocab_size, pat_str)